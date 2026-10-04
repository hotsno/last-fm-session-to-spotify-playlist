# Last.fm session → Spotify playlist

Sign in with Spotify, enter a Last.fm username and a date, pull the surrounding days of scrobbles, check the tracks you want, and create a playlist.

## Setup

1. `cp .env.example .env.local` and fill it in:
   - `AUTH_SECRET`: run `npx auth secret`
   - `AUTH_SPOTIFY_ID` / `AUTH_SPOTIFY_SECRET`: from the [Spotify dashboard](https://developer.spotify.com/dashboard). Add the redirect URI `http://127.0.0.1:3000/api/auth/callback/spotify` (plus `https://<your-app>.vercel.app/api/auth/callback/spotify` for production). While the app is in Development Mode, add each user under *User Management*.
   - `LASTFM_API_KEY`: from <https://www.last.fm/api/account/create>
2. `npm install && npm run dev`, then open <http://127.0.0.1:3000>.

## Deploying

Import the repo in Vercel and set the same four environment variables.

## Using the table

- Click a row to select it; Shift-click selects a range; Cmd/Ctrl-click toggles individual rows.
- "Check selected" / "Uncheck selected" apply to the selected rows. Toggling a checkbox inside a multi-row selection applies to the whole selection.
- The header checkbox checks or unchecks everything.
