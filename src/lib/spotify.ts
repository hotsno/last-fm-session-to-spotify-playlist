const API = "https://api.spotify.com/v1"

/** fetch against the Spotify API, waiting out 429s once or twice. */
export async function spotifyFetch(
  token: string,
  path: string,
  init: RequestInit = {},
  attempt = 0
): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
  if (res.status === 429 && attempt < 3) {
    const wait = Number(res.headers.get("Retry-After") ?? 1)
    await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000))
    return spotifyFetch(token, path, init, attempt + 1)
  }
  return res
}

const clean = (s: string) => s.replace(/["']/g, " ").replace(/\s+/g, " ").trim()

async function searchOne(token: string, name: string, artist: string) {
  const queries = [
    `track:${clean(name)} artist:${clean(artist)}`,
    `${clean(name)} ${clean(artist)}`,
  ]
  for (const q of queries) {
    const res = await spotifyFetch(
      token,
      `/search?${new URLSearchParams({ q, type: "track", limit: "1" })}`
    )
    if (!res.ok) continue
    const data = await res.json()
    const uri = data.tracks?.items?.[0]?.uri as string | undefined
    if (uri) return uri
  }
  return null
}

/** Resolve tracks to Spotify URIs with bounded concurrency. */
export async function matchTracks(
  token: string,
  tracks: { id: string; name: string; artist: string }[],
  concurrency = 5
) {
  const results: Record<string, string | null> = {}
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < tracks.length) {
        const t = tracks[next++]
        results[t.id] = await searchOne(token, t.name, t.artist)
      }
    })
  )
  return results
}
