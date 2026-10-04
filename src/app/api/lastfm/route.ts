import { auth } from "@/auth"
import type { Scrobble } from "@/lib/types"

export const maxDuration = 60

const MAX_PAGES = 50 // 200 per page → 10k scrobbles

type LastfmTrack = {
  name: string
  artist: { "#text": string }
  album: { "#text": string }
  date?: { uts: string }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.LASTFM_API_KEY
  if (!apiKey) {
    return Response.json({ error: "LASTFM_API_KEY is not set" }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const user = searchParams.get("user")?.trim()
  const from = Number(searchParams.get("from"))
  const to = Number(searchParams.get("to"))
  if (!user || !Number.isFinite(from) || !Number.isFinite(to)) {
    return Response.json({ error: "Missing user, from or to" }, { status: 400 })
  }

  const fetchPage = async (page: number) => {
    const url = new URL("https://ws.audioscrobbler.com/2.0/")
    url.search = new URLSearchParams({
      method: "user.getrecenttracks",
      user,
      api_key: apiKey,
      format: "json",
      limit: "200",
      from: String(from),
      to: String(to),
      page: String(page),
    }).toString()
    const res = await fetch(url, { cache: "no-store" })
    const data = await res.json()
    if (data.error) throw new Error(data.message ?? "Last.fm error")
    return data.recenttracks as {
      track: LastfmTrack[]
      "@attr": { totalPages: string }
    }
  }

  try {
    const first = await fetchPage(1)
    const totalPages = Math.min(Number(first["@attr"].totalPages), MAX_PAGES)
    const rest = await Promise.all(
      Array.from({ length: Math.max(totalPages - 1, 0) }, (_, i) =>
        fetchPage(i + 2)
      )
    )

    const scrobbles: Scrobble[] = [first, ...rest]
      .flatMap((p) => p.track)
      .filter((t) => t.date) // drops the "now playing" entry
      .map((t, i) => ({
        id: `${t.date!.uts}-${i}`,
        name: t.name,
        artist: t.artist["#text"],
        album: t.album["#text"],
        uts: Number(t.date!.uts),
      }))
      .sort((a, b) => b.uts - a.uts)

    return Response.json({
      scrobbles,
      truncated: Number(first["@attr"].totalPages) > MAX_PAGES,
    })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Last.fm request failed" },
      { status: 502 }
    )
  }
}
