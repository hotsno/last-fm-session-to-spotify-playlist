import { auth } from "@/auth"
import { matchTracks } from "@/lib/spotify"
import type { TrackQuery } from "@/lib/types"

export const maxDuration = 60

const MAX_BATCH = 50

/** Resolves a batch of tracks to Spotify URIs. The client calls this in chunks. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.accessToken || session.error) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tracks } = (await req.json()) as { tracks: TrackQuery[] }
  if (!Array.isArray(tracks) || tracks.length > MAX_BATCH) {
    return Response.json({ error: "Invalid batch" }, { status: 400 })
  }

  const uris = await matchTracks(session.accessToken, tracks)
  return Response.json({ uris })
}
