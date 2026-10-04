"use client"

import { useMemo, useState } from "react"
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns"
import { CalendarIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TrackTable } from "@/components/track-table"
import type { Scrobble } from "@/lib/types"

type Loaded = {
  id: number
  username: string
  scrobbles: Scrobble[]
  focusRange: { from: number; to: number }
  truncated: boolean
}

type Result = {
  url: string
  added: number
  unmatched: { name: string; artist: string }[]
}

const MATCH_BATCH = 50
const unix = (d: Date) => Math.floor(d.getTime() / 1000)
const trackKey = (s: Scrobble) => `${s.artist}\u0000${s.name}`.toLowerCase()

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    toast.error("Your Spotify session expired. Please sign in again.")
    await signOut()
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

export function SessionApp() {
  const [username, setUsername] = useState("")
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [days, setDays] = useState("3")
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [dedupe, setDedupe] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  async function load(e: React.FormEvent) {
    e.preventDefault()
    const n = Math.max(0, Math.floor(Number(days) || 0))
    if (!username.trim() || !date) return
    setLoading(true)
    setResult(null)
    try {
      const from = unix(startOfDay(subDays(date, n)))
      const to = unix(endOfDay(addDays(date, n)))
      const data = await api<{ scrobbles: Scrobble[]; truncated: boolean }>(
        `/api/lastfm?${new URLSearchParams({
          user: username.trim(),
          from: String(from),
          to: String(to),
        })}`
      )
      const focusRange = { from: unix(startOfDay(date)), to: unix(endOfDay(date)) }
      setLoaded({ id: Date.now(), username: username.trim(), focusRange, ...data })
      // Start with the picked day checked; surrounding days are there for context.
      setChecked(
        new Set(
          data.scrobbles
            .filter((s) => s.uts >= focusRange.from && s.uts <= focusRange.to)
            .map((s) => s.id)
        )
      )
      setName(`Listening session – ${format(date, "MMM d, yyyy")}`)
      setDescription(
        `${username.trim()}'s Last.fm scrobbles around ${format(date, "MMM d, yyyy")}`
      )
      if (data.scrobbles.length === 0) toast.info("No scrobbles in that range.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load history")
    } finally {
      setLoading(false)
    }
  }

  const selectedTracks = useMemo(
    () =>
      (loaded?.scrobbles ?? [])
        .filter((s) => checked.has(s.id))
        .sort((a, b) => a.uts - b.uts), // playlist plays in listening order
    [loaded, checked]
  )

  async function createPlaylist() {
    const tracks = dedupe
      ? selectedTracks.filter(
          (s, i, arr) => arr.findIndex((o) => trackKey(o) === trackKey(s)) === i
        )
      : selectedTracks

    // Search once per unique track, then expand back out to the playlist order.
    const unique = [...new Map(tracks.map((s) => [trackKey(s), s])).values()]
    const uriByKey = new Map<string, string | null>()
    setResult(null)
    try {
      for (let i = 0; i < unique.length; i += MATCH_BATCH) {
        setCreating(`Matching tracks ${Math.min(i + MATCH_BATCH, unique.length)}/${unique.length}`)
        const batch = unique.slice(i, i + MATCH_BATCH)
        const { uris } = await api<{ uris: Record<string, string | null> }>(
          "/api/spotify/match",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tracks: batch.map((s) => ({ id: s.id, name: s.name, artist: s.artist })),
            }),
          }
        )
        for (const s of batch) uriByKey.set(trackKey(s), uris[s.id] ?? null)
      }

      const uris = tracks.flatMap((s) => uriByKey.get(trackKey(s)) ?? [])
      const unmatched = unique
        .filter((s) => !uriByKey.get(trackKey(s)))
        .map(({ name, artist }) => ({ name, artist }))
      if (uris.length === 0) throw new Error("None of the tracks were found on Spotify.")

      setCreating("Creating playlist")
      const { url } = await api<{ url: string }>("/api/spotify/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isPublic, uris }),
      })
      setResult({ url, added: uris.length, unmatched })
      toast.success("Playlist created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create playlist")
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pick a listening session</CardTitle>
          <CardDescription>
            Choose a date and we&apos;ll pull your Last.fm history around it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={load} className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Last.fm username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="hotsno"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="w-48 justify-start font-normal" />
                  }
                >
                  <CalendarIcon />
                  {date ? format(date, "PPP") : "Pick a date"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={{ after: new Date() }}
                    defaultMonth={date}
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Days before &amp; after</Label>
              <Input
                id="days"
                type="number"
                min={0}
                max={30}
                className="w-28"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading || !username.trim() || !date}>
              {loading && <Loader2Icon className="animate-spin" />}
              Load history
            </Button>
          </form>
        </CardContent>
      </Card>

      {loaded && loaded.scrobbles.length > 0 && (
        <>
          {loaded.truncated && (
            <p className="text-sm text-destructive">
              This range has more than 10,000 scrobbles; only the first 10,000 pages worth were loaded.
            </p>
          )}
          <TrackTable
            key={loaded.id}
            scrobbles={loaded.scrobbles}
            checked={checked}
            onCheckedChange={setChecked}
            focusRange={loaded.focusRange}
          />

          <Card>
            <CardHeader>
              <CardTitle>Create Spotify playlist</CardTitle>
              <CardDescription>
                {selectedTracks.length} checked tracks, added in the order you played them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-8">
                <div className="flex items-center gap-2">
                  <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
                  <Label htmlFor="public">Public playlist</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="dedupe" checked={dedupe} onCheckedChange={setDedupe} />
                  <Label htmlFor="dedupe">Remove repeated tracks</Label>
                </div>
              </div>
              <Button
                onClick={createPlaylist}
                disabled={!!creating || !name.trim() || selectedTracks.length === 0}
              >
                {creating && <Loader2Icon className="animate-spin" />}
                {creating ?? "Create playlist"}
              </Button>

              {result && (
                <div className="space-y-2 rounded-md border p-4 text-sm">
                  <p>
                    Added {result.added} tracks.{" "}
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium underline"
                    >
                      Open in Spotify <ExternalLinkIcon className="size-3" />
                    </a>
                  </p>
                  {result.unmatched.length > 0 && (
                    <div>
                      <p className="text-muted-foreground">
                        {result.unmatched.length} tracks couldn&apos;t be found on Spotify:
                      </p>
                      <ul className="mt-1 list-disc pl-5">
                        {result.unmatched.map((t, i) => (
                          <li key={i}>
                            {t.artist} – {t.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
