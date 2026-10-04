import type { NextRequest } from "next/server"
import { handlers } from "@/auth"

// NextRequest rewrites 127.0.0.1 to localhost in `req.url`, so the callback's
// redirect_uri wouldn't match the one sent at sign-in (which uses the real Host
// header) and Spotify rejects the token exchange. Rebuild the URL from the Host
// header and hand Auth.js a plain Request that keeps it as-is.
function withRealHost(handler: (req: NextRequest) => Promise<Response>) {
  return (req: NextRequest) => {
    const host = req.headers.get("host")
    if (!host) return handler(req)
    const url = new URL(req.url)
    url.host = host
    return handler(new Request(url, req) as NextRequest)
  }
}

export const GET = withRealHost(handlers.GET)
export const POST = withRealHost(handlers.POST)
