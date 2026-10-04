export type Scrobble = {
  /** Unique per row (uts + index), since the same track can be scrobbled twice in a second. */
  id: string
  name: string
  artist: string
  album: string
  /** Unix seconds */
  uts: number
}

export type TrackQuery = { id: string; name: string; artist: string }
