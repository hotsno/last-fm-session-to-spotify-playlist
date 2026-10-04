import NextAuth from "next-auth"
import Spotify from "next-auth/providers/spotify"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    error?: "RefreshTokenError"
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    error?: "RefreshTokenError"
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Spotify({
      // Must be a full URL string: an object with only `params` replaces the
      // provider's default URL, and Auth.js then fails with "Invalid URL".
      authorization:
        "https://accounts.spotify.com/authorize?scope=playlist-modify-public playlist-modify-private",
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        }
      }
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) {
        return token
      }
      if (!token.refreshToken) return { ...token, error: "RefreshTokenError" }

      try {
        const res = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${process.env.AUTH_SPOTIFY_ID}:${process.env.AUTH_SPOTIFY_SECRET}`
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: token.refreshToken,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw data
        return {
          ...token,
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? token.refreshToken,
          expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
          error: undefined,
        }
      } catch {
        return { ...token, error: "RefreshTokenError" }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.error = token.error
      return session
    },
  },
})
