import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchLeagueStandings, getEntry, getEntryPicks } from '../../services/fplApi'
import { useFPLStore } from '../../store/fplStore'
import type { EntryEventPicks } from '../../types/fpl.types'
import EntryLineup from './EntryLineup'

type StandingRow = {
  entry: number
  entry_name: string
  player_name: string
  rank: number
  last_rank: number
  total: number
  event_total?: number
}

type EnrichedRow = StandingRow & {
  gwNet: number | null
  gwGross: number | null
  teamValue: number | null
  overallRank: number | null
}

const CONCURRENCY = 5

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = idx++
      if (i >= items.length) break
      results[i] = await mapper(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

export default function LeagueDetails() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const { currentEvent } = useFPLStore()
  const [rows, setRows] = useState<EnrichedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'total' | 'gwNet' | 'gwGross' | 'teamValue' | 'overallRank'>('total')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!leagueId) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const base = await fetchLeagueStandings(Number(leagueId)) as any as StandingRow[]
        const gw = currentEvent?.id
        const enriched = await mapWithConcurrency(base, CONCURRENCY, async (s) => {
          let gwNet: number | null = null
          let gwGross: number | null = null
          let teamValue: number | null = null
          let overallRank: number | null = null
          try {
            // Summary for value and overall rank
            const summary = await getEntry(s.entry)
            teamValue = summary.value / 10
            overallRank = summary.summary_overall_rank
          } catch {}
          try {
            if (gw) {
              const picks: EntryEventPicks = await getEntryPicks(s.entry, gw)
              gwNet = picks.entry_history.points
              gwGross = picks.entry_history.points + (picks.entry_history.event_transfers_cost || 0)
            }
          } catch {}
          return { ...s, gwNet: gwNet ?? s.event_total ?? null, gwGross, teamValue, overallRank }
        })
        if (!cancelled) setRows(enriched)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load league details')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [leagueId, currentEvent?.id])

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = (a as any)[sortKey] ?? -Infinity
      const bv = (b as any)[sortKey] ?? -Infinity
      if (av === bv) return 0
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })
    return copy
  }, [rows, sortKey, sortDir])

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 text-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">League Details</h2>
        <Link to="/" className="text-fplPurple hover:underline">Back</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="text-sm text-zinc-600">Sort by</label>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} className="bg-white border border-zinc-300 rounded-lg px-2 py-1 text-sm">
          <option value="total">Total Points</option>
          <option value="gwNet">GW Net</option>
          <option value="gwGross">GW Gross</option>
          <option value="teamValue">Team Value</option>
          <option value="overallRank">Overall Rank</option>
        </select>
        <button onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))} className="px-2 py-1 text-sm rounded-lg border border-zinc-300">
          {sortDir === 'desc' ? 'Desc' : 'Asc'}
        </button>
      </div>

      {loading && <div className="text-sm text-zinc-500">Loading league details…</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sorted.map((s) => {
            const rankDiff = s.last_rank - s.rank
            const arrow = rankDiff > 0 ? '▲' : rankDiff < 0 ? '▼' : '•'
            const color = rankDiff > 0 ? 'text-emerald-600' : rankDiff < 0 ? 'text-red-500' : 'text-zinc-400'
            return (
              <div
                key={s.entry}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm cursor-pointer"
                onClick={() => setExpanded(expanded === s.entry ? null : s.entry)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-zinc-900">{s.player_name}</div>
                    <div className="text-xs text-zinc-500">{s.entry_name}</div>
                  </div>
                  <div className={`font-semibold ${color}`}>{s.rank} {arrow}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <div className="text-zinc-500">GW Net</div>
                    <div className="text-zinc-900 font-semibold">{s.gwNet ?? '—'}</div>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <div className="text-zinc-500">GW Gross</div>
                    <div className="text-zinc-900 font-semibold">{s.gwGross ?? '—'}</div>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <div className="text-zinc-500">Team Value</div>
                    <div className="text-zinc-900 font-semibold">{s.teamValue ? `£${s.teamValue.toFixed(1)}m` : '—'}</div>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <div className="text-zinc-500">Overall Rank</div>
                    <div className="text-zinc-900 font-semibold">{s.overallRank ?? '—'}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="text-zinc-600">GW: {s.event_total ?? s.gwNet ?? '—'}</div>
                  <div className="text-zinc-900 font-semibold">Total: {s.total}</div>
                </div>
                {expanded === s.entry && (
                  <EntryLineup entryId={s.entry} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
