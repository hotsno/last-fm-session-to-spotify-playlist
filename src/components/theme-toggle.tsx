"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const options = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const

const noopSubscribe = () => () => {}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  // The stored theme is only known on the client; avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex items-center gap-0.5 rounded-lg border p-0.5", className)}
    >
      {options.map(({ value, label, Icon }) => {
        const active = mounted && theme === value
        return (
          <Button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            variant="ghost"
            size="icon-xs"
            className={cn("text-muted-foreground", active && "bg-muted text-foreground")}
            onClick={() => setTheme(value)}
          >
            <Icon />
          </Button>
        )
      })}
    </div>
  )
}
