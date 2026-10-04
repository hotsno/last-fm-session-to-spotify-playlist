import { auth } from "@/auth"
import { spotifyFetch } from "@/lib/spotify"

export const maxDuration = 60

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.accessToken || session.error) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const token = session.accessToken

  const { name, description, isPublic, uris } = (await req.json()) as {
    name: string
    description?: string
    isPublic: boolean
    uris: string[]
  }
  if (!name?.trim() || !Array.isArray(uris) || uris.length === 0) {
    return Response.json({ error: "Name and tracks are required" }, { status: 400 })
  }

  const created = await spotifyFetch(token, "/me/playlists", {
    method: "POST",
    body: JSON.stringify({
      name: name.trim(),
      description: description?.trim() ?? "",
      public: isPublic,
    }),
  })
  if (!created.ok) {
    return Response.json(
      { error: `Spotify refused to create the playlist (${created.status})` },
      { status: 502 }
    )
  }
  const playlist = await created.json()

  for (let i = 0; i < uris.length; i += 100) {
    const added = await spotifyFetch(token, `/playlists/${playlist.id}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    })
    if (!added.ok) {
      return Response.json(
        {
          error: `Playlist created but adding tracks failed (${added.status})`,
          url: playlist.external_urls?.spotify,
        },
        { status: 502 }
      )
    }
  }

  return Response.json({ url: playlist.external_urls?.spotify as string })
}
