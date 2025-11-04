import { useEffect, useMemo, useState } from 'react'
import { useFPLStore } from '../../store/fplStore'
import { getEntryPicks } from '../../services/fplApi'
import type { EntryEventPicks } from '../../types/fpl.types'

export default function EntryLineup({ entryId }: { entryId: number }) {
  const { currentEvent, players, bootstrap, live } = useFPLStore()
  const [picks, setPicks] = useState<EntryEventPicks | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentEvent?.id) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const p = await getEntryPicks(entryId, currentEvent.id)
        if (!cancelled) setPicks(p)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load lineup')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [entryId, currentEvent?.id])

  const teamCodeById = useMemo(() => {
    const map: Record<number, number> = {}
    bootstrap?.teams.forEach((t) => { (map as any)[t.id] = (t as any).code })
    return map
  }, [bootstrap])

  const starters = useMemo(() => {
    if (!picks) return []
    return picks.picks.filter((p) => p.position <= 11).sort((a, b) => a.position - b.position)
  }, [picks])

  const bench = useMemo(() => {
    if (!picks) return []
    return picks.picks.filter((p) => p.position > 11).sort((a, b) => a.position - b.position)
  }, [picks])

  if (loading) return <div className="text-sm text-zinc-500">Loading lineup…</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>
  if (!picks || !players) return null

  const Tile = ({ elementId, badge }: { elementId: number; badge?: boolean }) => {
    const pl = players[elementId]
    if (!pl) return null
    const code = teamCodeById[pl.team]
    const shirt = code ? `/assets/shirts/${code}.png` : undefined
    const pts = live?.[elementId]?.total_points ?? 0
    const isC = picks.picks.find((p) => p.element === elementId)?.is_captain
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-14 h-14 flex items-center justify-center">
          {shirt ? <img src={shirt} alt="shirt" className="object-contain max-h-14" /> : <div className="w-10 h-10 bg-zinc-300 rounded" />}
          {badge && <div className="absolute -top-1 -right-1 text-[10px] bg-amber-400 rounded px-1">★</div>}
          {isC && <div className="absolute -bottom-1 -right-1 text-[10px] bg-black text-white rounded-full w-4 h-4 flex items-center justify-center">C</div>}
        </div>
        <div className="mt-1 text-[14px] text-center text-white max-w-16">{pl.web_name}</div>
        <div className="mt-0.5 text-[13px] font-semibold text-white bg-fplPurple rounded px-2">{pts}</div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 p-3 bg-[#5f873a]">
      <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
        {starters.map((p) => (
          <Tile key={p.element} elementId={p.element} />
        ))}
      </div>
      <div className="mt-3 text-lg text-white">Bench</div>
      <div className="mt-1 grid grid-cols-4 gap-3">
        {bench.map((p, i) => (
          <Tile key={p.element} elementId={p.element} badge={i === 3} />
        ))}
      </div>
    </div>
  )
}
