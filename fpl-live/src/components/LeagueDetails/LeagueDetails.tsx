import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchLeagueStandings, getEntry, getEntryPicks, getClassicLeague } from '../../services/fplApi'
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
  const { currentEvent, bootstrap, teamId } = useFPLStore()
  const [rows, setRows] = useState<EnrichedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'total' | 'gwNet' | 'gwGross' | 'teamValue' | 'overallRank'>('total')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [monthFilter, setMonthFilter] = useState<string>('')
  const [monthlyPoints, setMonthlyPoints] = useState<Record<number, number>>({})
  const [, setLoadingMonth] = useState(false)
  const [leagueName, setLeagueName] = useState<string>('')

  useEffect(() => {
    if (!leagueId) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const base = await fetchLeagueStandings(Number(leagueId)) as any as StandingRow[]
        // fetch league name from classic league endpoint
        try {
          const league = await getClassicLeague(Number(leagueId)) as any
          const name: string | undefined = (league as any)?.league?.name
          if (!cancelled && name) setLeagueName(name)
        } catch {}
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

  // Month options from bootstrap events
  function monthKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  function monthLabel(key: string) {
    const [y, m] = key.split('-').map(Number)
    const date = new Date(y, (m || 1) - 1, 1)
    return date.toLocaleString(undefined, { month: 'long', year: 'numeric' })
  }
  const monthOptions = useMemo(() => {
    if (!bootstrap?.events?.length) return [] as { key: string; label: string }[]
    const curKey = monthKey(new Date())
    const keys = Array.from(
      new Set(
        bootstrap.events
          .map((e) => monthKey(new Date(e.deadline_time)))
          .filter((k) => k <= curKey)
      )
    )
      .sort() // ascending
      .reverse() // latest first
    return keys.map((k) => ({ key: k, label: monthLabel(k) }))
  }, [bootstrap])

  // Compute monthly totals per entry
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!monthFilter || !bootstrap || rows.length === 0) { setMonthlyPoints({}); return }
      setLoadingMonth(true)
      try {
        const monthEventIds = bootstrap.events
          .filter((e) => {
            const d = new Date(e.deadline_time)
            const k = monthKey(d)
            return k === monthFilter
          })
          .map((e) => e.id)
        const res: Record<number, number> = {}
        let idx = 0
        const LIMIT = 5
        async function worker() {
          while (true) {
            const i = idx++
            if (i >= rows.length) break
            const r = rows[i]
            try {
              const hist: any = await (await import('../../services/fplApi')).getEntryHistory(r.entry)
              const current = Array.isArray(hist?.current) ? hist.current : []
              const sum = current.filter((h: any) => monthEventIds.includes(h.event)).reduce((a: number, h: any) => a + (h.points ?? 0), 0)
              res[r.entry] = sum
            } catch {
              res[r.entry] = 0
            }
          }
        }
        await Promise.all(new Array(Math.min(LIMIT, rows.length)).fill(0).map(() => worker()))
        if (!cancelled) setMonthlyPoints(res)
      } finally {
        if (!cancelled) setLoadingMonth(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [monthFilter, rows, bootstrap])

  const sorted = useMemo(() => {
    const copy = [...rows]
    if (monthFilter) {
      copy.sort((a, b) => (monthlyPoints[b.entry] ?? -Infinity) - (monthlyPoints[a.entry] ?? -Infinity))
      return copy
    }
    copy.sort((a, b) => {
      const av = (a as any)[sortKey] ?? -Infinity
      const bv = (b as any)[sortKey] ?? -Infinity
      if (av === bv) return 0
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })
    return copy
  }, [rows, sortKey, sortDir, monthFilter, monthlyPoints])

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 text-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold">League Details - {leagueName}</h2>
          {/* {leagueName && <div className="text-sm text-zinc-500">{leagueName}</div>} */}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="bg-white border border-zinc-300 rounded-lg px-2 py-1 text-sm"
          >
            <option value="">Overall</option>
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <Link to="/" className="text-fplPurple hover:underline">Back</Link>
        </div>
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

      {loading && (
        <div className="mb-4">
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 p-4 bg-white shadow-sm animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-40 bg-zinc-200 rounded" />
                    <div className="h-3 w-32 bg-zinc-200 rounded" />
                  </div>
                  <div className="h-5 w-12 bg-zinc-200 rounded" />
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <div className="h-3 w-20 bg-zinc-200 rounded mb-2" />
                      <div className="h-4 w-12 bg-zinc-200 rounded" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="h-3 w-24 bg-zinc-200 rounded" />
                  <div className="h-4 w-20 bg-zinc-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {loading && <div className="sr-only">Loading league details…</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4">
          {sorted.map((s) => {
            const rankDiff = s.last_rank - s.rank
            const arrow = rankDiff > 0 ? '▲' : rankDiff < 0 ? '▼' : '•'
            const color = rankDiff > 0 ? 'text-emerald-600' : rankDiff < 0 ? 'text-red-500' : 'text-zinc-400'
            return (
              <div
                key={s.entry}
                className={[
                  'rounded-xl border border-zinc-200 p-4 shadow-sm cursor-pointer',
                  s.entry === teamId
                    ? 'bg-gradient-to-r from-sky-200 via-indigo-200 to-fuchsia-200'
                    : 'bg-white'
                ].join(' ')}
                onClick={() => setExpanded(expanded === s.entry ? null : s.entry)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-zinc-900">{s.player_name}</div>
                    <div className="text-xs text-zinc-500">{s.entry_name}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${color}`}>{s.rank?.toLocaleString?.() ?? s.rank} {arrow}</div>
                    <div className={`text-xs ${rankDiff > 0 ? 'text-emerald-600' : rankDiff < 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                      {rankDiff > 0 ? '+' : rankDiff < 0 ? '-' : ''}{Math.abs(rankDiff).toLocaleString()}
                    </div>
                  </div>
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
                  <div className="text-zinc-900 font-semibold flex items-center gap-3">
                    {monthFilter && (
                      <span className="text-zinc-700">{monthOptions.find((o) => o.key === monthFilter)?.label || monthFilter}: <span className="font-semibold">{(monthlyPoints[s.entry] ?? 0)}</span></span>
                    )}
                    <span>Total: {s.total}</span>
                  </div>
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
