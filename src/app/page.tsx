import { auth, signIn, signOut } from "@/auth"
import { SessionApp } from "@/components/session-app"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function Home() {
  const session = await auth()

  if (!session || session.error) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <ThemeToggle className="fixed top-4 right-4" />
        <h1 className="text-3xl font-semibold tracking-tight">
          Last.fm session → Spotify playlist
        </h1>
        <p className="text-muted-foreground">
          Turn any stretch of your Last.fm listening history into a Spotify playlist.
        </p>
        <form
          action={async () => {
            "use server"
            await signIn("spotify")
          }}
        >
          <Button type="submit" size="lg">Sign in with Spotify</Button>
        </form>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          Last.fm session → Spotify playlist
        </h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form
            action={async () => {
              "use server"
              await signOut()
            }}
            className="flex items-center gap-3 text-sm text-muted-foreground"
          >
            {session.user?.name}
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <SessionApp />
    </main>
  )
}
