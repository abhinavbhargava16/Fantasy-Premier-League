import { useEffect, useMemo, useState } from 'react'
import type { EntryEventPicks, EntrySummary } from '../../types/fpl.types'
import { useFPLStore } from '../../store/fplStore'
import { calculatePoints } from '../../services/scoreCalculator'
import { getEntryHistory } from '../../services/fplApi'

export default function RankDetails({ picks, entry }: { picks?: EntryEventPicks; entry?: EntrySummary }) {
  const { players, live, currentEvent } = useFPLStore()
  const { bootstrap } = useFPLStore()
  const [oldRank, setOldRank] = useState<number | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!entry?.id) return
      try {
        setLoadingHistory(true)
        const hist = await getEntryHistory(entry.id)
        // Find previous GW overall_rank from current season history
        const gw = currentEvent?.id ?? undefined
        const past = (hist?.current ?? hist?.history ?? hist?.past ?? hist?.season_history ?? hist?.events ?? []) as any[]
        // Attempt to find event gw-1
        const prev = gw && Array.isArray(hist?.current) ? hist.current.find((i: any) => i.event === gw - 1) : null
        const prevRank = prev?.overall_rank ?? hist?.current?.slice(-1)?.[0]?.overall_rank ?? null
        if (!cancelled) setOldRank(prevRank ?? null)
      } catch {
        if (!cancelled) setOldRank(null)
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [entry?.id, currentEvent?.id])

  const data = useMemo(() => {
    if (!picks || !players || !live) return null
    const calc = calculatePoints(picks, live, players)
    const gwNet = picks.entry_history.points
    const transfersCost = picks.entry_history.event_transfers_cost || 0
    const gwGross = gwNet + transfersCost
    const tv = (picks.entry_history.value ?? entry?.value ?? 0) / 10
    const gwRank = picks.entry_history.rank ?? null
    const totalPoints = picks.entry_history.total_points ?? entry?.summary_overall_points ?? null
    const gwLive = calc.totalOnField + (calc.appliedChip === 'bboost' ? calc.benchTotal : 0)
    const overallRank = entry?.summary_overall_rank ?? null
    return {
      gwLive,
      bench: calc.benchTotal,
      gwNet,
      gwGross,
      teamValue: tv,
      overallRank,
      gwRank,
      totalPoints,
      chip: calc.appliedChip,
    }
  }, [picks, players, live, entry])

  if (!data) return null

  const totalPlayers = (bootstrap as any)?.total_players as number | undefined
  const rankPercent = data.overallRank && totalPlayers ? (data.overallRank / totalPlayers) * 100 : null
  const ranksGained = oldRank && data.overallRank ? oldRank - data.overallRank : null
  const changePct = oldRank && ranksGained != null ? (ranksGained / oldRank) * 100 : null
  const gained = ranksGained != null && ranksGained > 0
  const dropped = ranksGained != null && ranksGained < 0
  const arrow = gained ? '▲' : dropped ? '▼' : '•'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      <div className="px-4 py-4 bg-gradient-to-r from-sky-100 via-indigo-100 to-fuchsia-100 border-b border-zinc-200">
        <div className="flex items-center justify-center gap-3">
          <div className="text-xl font-bold text-zinc-800">Rank Details</div>
          <div className="text-base text-zinc-600">GW {currentEvent?.id ?? ''}</div>
          {data.chip && (
            <div className="ml-2 text-xs bg-violet-600 text-white rounded-lg px-2 py-0.5">{data.chip.toUpperCase()}</div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 text-zinc-900">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="GW Live" value={fmtPts(data.gwLive)} sub={data.chip === 'bboost' ? `Incl bench` : undefined} />
          <Stat label="Total" value={data.totalPoints != null ? fmtPts(data.totalPoints) : '—'} />
          <Stat label="GW Net" value={fmtPts(data.gwNet)} />
          <Stat label="GW Gross" value={fmtPts(data.gwGross)} />
          <Stat label="Benched" value={fmtPts(data.bench)} />
          <Stat label="Team Value" value={data.teamValue ? `£${data.teamValue.toFixed(1)}m` : '—'} />
          <Stat label="GW Rank" value={data.gwRank ? data.gwRank.toLocaleString() : '—'} />
          <Stat label="Overall Rank" value={data.overallRank ? data.overallRank.toLocaleString() : '—'} />
        </div>
      </div>

      <div className="px-4 py-2 bg-gradient-to-r from-sky-100 via-indigo-100 to-fuchsia-100 border-y border-zinc-200 text-zinc-800 font-semibold">
        <span>📈 Ranks Gained:</span>
        <span className={`ml-2 ${gained ? 'text-emerald-700' : dropped ? 'text-red-600' : 'text-zinc-800'}`}>
          {arrow} {ranksGained != null ? ranksGained.toLocaleString() : '—'}
        </span>
      </div>

      <div className="px-4 py-3 text-zinc-900">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Rank Pre-Subs" value={oldRank ? oldRank.toLocaleString() : '—'} />
          <Stat label="Old Rank" value={oldRank ? oldRank.toLocaleString() : '—'} />
          <Stat
            label="Change %"
            value={changePct != null ? `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
            valueClass={changePct != null ? (changePct > 0 ? 'text-emerald-600' : changePct < 0 ? 'text-red-500' : 'text-zinc-900') : ''}
          />
          <Stat label="Rank Post-Subs" value={data.overallRank ? data.overallRank.toLocaleString() : '—'} />
          <Stat label="GW Rank" value={data.gwRank ? data.gwRank.toLocaleString() : '—'} />
          <Stat label="Rank %" value={rankPercent != null ? `Top ${rankPercent.toFixed(2)}%` : '—'} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, valueClass = '' }: { label: string; value: string | number; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-xl font-semibold text-zinc-900 ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
    </div>
  )
}

function fmtPts(n: number) {
  return Number.isFinite(n) ? `${Math.round(n)}` : '—'
}
