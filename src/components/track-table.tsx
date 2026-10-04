"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { Scrobble } from "@/lib/types"

type Props = {
  scrobbles: Scrobble[]
  checked: Set<string>
  onCheckedChange: (next: Set<string>) => void
  /** Unix seconds bounds of the date the user picked; rows inside are highlighted and scrolled to. */
  focusRange: { from: number; to: number }
}

type RowProps = {
  scrobble: Scrobble
  index: number
  selected: boolean
  checked: boolean
  inFocus: boolean
  onRowClick: (e: React.MouseEvent, index: number) => void
  onToggle: (index: number, value: boolean) => void
}

const Row = memo(function Row({
  scrobble,
  index,
  selected,
  checked,
  inFocus,
  onRowClick,
  onToggle,
}: RowProps) {
  return (
    <TableRow
      data-index={index}
      data-selected={selected}
      onClick={(e) => onRowClick(e, index)}
      className={cn(
        "cursor-default",
        inFocus && "bg-muted/40",
        selected && "bg-primary/15 hover:bg-primary/20"
      )}
    >
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onToggle(index, v === true)}
          aria-label={`Include ${scrobble.name}`}
        />
      </TableCell>
      <TableCell className="max-w-64 truncate font-medium">
        {scrobble.name}
      </TableCell>
      <TableCell className="max-w-48 truncate">{scrobble.artist}</TableCell>
      <TableCell className="max-w-48 truncate text-muted-foreground">
        {scrobble.album}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {format(new Date(scrobble.uts * 1000), "MMM d, h:mm a")}
      </TableCell>
    </TableRow>
  )
})

export function TrackTable({
  scrobbles,
  checked,
  onCheckedChange,
  focusRange,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const anchor = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Refs let the row callbacks stay stable so memoized rows don't all re-render.
  const stateRef = useRef({ selected, checked, scrobbles, onCheckedChange })
  useLayoutEffect(() => {
    stateRef.current = { selected, checked, scrobbles, onCheckedChange }
  })

  // The parent remounts this component per load, so this runs once per data set:
  // jump to the top of the chosen date.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const target = scrobbles.findIndex((s) => s.uts <= focusRange.to)
    const row = container.querySelector<HTMLElement>(
      `tr[data-index="${Math.max(target, 0)}"]`
    )
    const head = container.querySelector("thead")
    if (!row) return
    const top =
      row.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      (head?.offsetHeight ?? 0)
    container.scrollTo({ top })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onRowClick = useCallback((e: React.MouseEvent, index: number) => {
    const additive = e.metaKey || e.ctrlKey
    if (e.shiftKey) {
      const [a, b] = [anchor.current, index].sort((x, y) => x - y)
      const range = Array.from({ length: b - a + 1 }, (_, i) => a + i)
      setSelected((prev) => new Set(additive ? [...prev, ...range] : range))
    } else if (additive) {
      anchor.current = index
      setSelected((prev) => {
        const next = new Set(prev)
        if (!next.delete(index)) next.add(index)
        return next
      })
    } else {
      anchor.current = index
      setSelected(new Set([index]))
    }
  }, [])

  const applyChecked = useCallback((indices: Iterable<number>, value: boolean) => {
    const { checked, scrobbles, onCheckedChange } = stateRef.current
    const next = new Set(checked)
    for (const i of indices) {
      if (value) next.add(scrobbles[i].id)
      else next.delete(scrobbles[i].id)
    }
    onCheckedChange(next)
  }, [])

  // Toggling a checkbox inside a multi-row selection applies to the whole selection.
  const onToggle = useCallback(
    (index: number, value: boolean) => {
      const { selected } = stateRef.current
      applyChecked(selected.has(index) ? selected : [index], value)
    },
    [applyChecked]
  )

  const allChecked = scrobbles.length > 0 && checked.size === scrobbles.length
  const someChecked = checked.size > 0 && !allChecked

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {checked.size} of {scrobbles.length} checked
          {selected.size > 0 && ` · ${selected.size} rows selected`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => applyChecked(selected, true)}
          >
            Check selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => applyChecked(selected, false)}
          >
            Uncheck selected
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table containerRef={containerRef} containerClassName="max-h-[60vh] overflow-y-auto">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onCheckedChange={() =>
                    onCheckedChange(
                      allChecked ? new Set() : new Set(scrobbles.map((s) => s.id))
                    )
                  }
                  aria-label="Check or uncheck all"
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Album</TableHead>
              <TableHead>Played</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="select-none">
            {scrobbles.map((s, i) => (
              <Row
                key={s.id}
                scrobble={s}
                index={i}
                selected={selected.has(i)}
                checked={checked.has(s.id)}
                inFocus={s.uts >= focusRange.from && s.uts <= focusRange.to}
                onRowClick={onRowClick}
                onToggle={onToggle}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
