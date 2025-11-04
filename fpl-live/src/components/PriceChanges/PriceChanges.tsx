import { useMemo, useState } from 'react'
import { useFPLStore } from '../../store/fplStore'

type Row = {
  id: number
  name: string
  teamId: number
  teamName: string
  teamCode?: number
  position: number
  price: number
  netTransfers: number
  weeklyUps: number
  weeklyDowns: number
  progress: number // 0..>1 (rise) or negative for fall progress (abs indicates magnitude)
  direction: 'up' | 'down' | 'flat'
}

export default function PriceChanges() {
  const { bootstrap } = useFPLStore()
  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all')

  const teamById = useMemo(() => {
    const map: Record<number, { name: string; code?: number }> = {}
    bootstrap?.teams.forEach((t) => (map[t.id] = { name: t.name, code: (t as any).code }))
    return map
  }, [bootstrap])

  const rows: Row[] = useMemo(() => {
    if (!bootstrap) return []
    const THRESHOLD_RISE = 90000 // heuristic
    const THRESHOLD_FALL = 90000 // heuristic
    const items: Row[] = bootstrap.elements.map((el) => {
      const transfersIn = (el as any).transfers_in_event ?? 0
      const transfersOut = (el as any).transfers_out_event ?? 0
      const weeklyUps = Math.max(0, (el as any).cost_change_event ?? 0) // in 0.1 steps
      const weeklyDowns = Math.max(0, (el as any).cost_change_event_fall ?? 0) // in 0.1 steps
      const net = transfersIn - transfersOut
      let progress = 0
      let dir: Row['direction'] = 'flat'
      if (net > 0) {
        progress = net / THRESHOLD_RISE
        dir = 'up'
      } else if (net < 0) {
        progress = -Math.abs(net) / THRESHOLD_FALL
        dir = 'down'
      }
      const t = teamById[el.team]
      return {
        id: el.id,
        name: el.web_name,
        teamId: el.team,
        teamName: t?.name ?? '',
        teamCode: t?.code,
        position: el.element_type,
        price: el.now_cost / 10,
        netTransfers: net,
        weeklyUps,
        weeklyDowns,
        progress,
        direction: dir,
      }
    })
    return items
  }, [bootstrap, teamById])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => (teamFilter === 'all' ? true : r.teamId === teamFilter))
      .filter((r) => (q ? r.name.toLowerCase().includes(q) || r.teamName.toLowerCase().includes(q) : true))
      .sort((a, b) => (Math.abs(b.progress) - Math.abs(a.progress)))
      .slice(0, 300)
  }, [rows, query, teamFilter])

  function predict(r: Row) {
    const capReached = r.direction === 'up' ? r.weeklyUps >= 3 : r.weeklyDowns >= 3
    const pct = Math.round(Math.abs(r.progress) * 100)
    if (capReached) return { label: 'Cap reached', tone: 'text-zinc-500' }
    if (pct >= 100) return { label: 'Tonight likely', tone: 'text-emerald-600' }
    if (pct >= 70) return { label: 'Possible tonight', tone: 'text-amber-600' }
    return { label: '> 2 days', tone: 'text-zinc-600' }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-zinc-200 p-4">
        <div className="text-xl font-bold text-center text-zinc-900">Live Price Changes</div>
        <div className="mt-2 text-s text-zinc-600 text-center">
          Prices move by £0.1m steps overnight; max ~£0.3m per GW. Progress is an estimate based on net transfers today.
        </div>
        <div className="mt-4 flex flex-wrap gap-2 items-center justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player or team"
            className="bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm w-64"
          />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-white border border-zinc-300 rounded-lg px-2 py-2 text-sm"
          >
            <option value="all">All Teams</option>
            {bootstrap?.teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-600">
          <div className="col-span-4">Player</div>
          <div className="col-span-2">Team</div>
          <div className="col-span-3">Progress Now</div>
          <div className="col-span-2">Prediction</div>
          <div className="col-span-1 text-right pr-1">Price</div>
        </div>
        {filtered.map((r) => {
          const pct = Math.max(0, Math.round(Math.min(1, Math.abs(r.progress)) * 100))
          const pred = predict(r)
          const shirt = r.teamCode ? `/assets/shirts/${r.teamCode}.png` : undefined
          return (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-100 items-center text-sm">
              <div className="col-span-4 flex items-center gap-3">
                {shirt ? <img src={shirt} className="h-6 w-6" /> : <div className="h-6 w-6 bg-zinc-200 rounded" />}
                <div>
                  <div className="font-medium text-zinc-900">{r.name}</div>
                  <div className={`text-s ${r.direction==='down' ? 'text-red-400' : 'text-emerald-500'} font-bold`}>{posLabel(r.position)} £{r.price.toFixed(1)}</div>
                </div>
              </div>
              <div className="col-span-2 text-zinc-700">{r.teamName}</div>
              <div className="col-span-3">
                <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${r.direction==='down' ? 'bg-red-400' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-s text-zinc-500 mt-1">
                  {Math.round(Math.abs(r.progress) * 100)}% ({r.netTransfers.toLocaleString()} net)
                </div>
              </div>
              <div className={`col-span-2 text-sm ${pred.tone}`}>{pred.label}</div>
              <div className="col-span-1 text-right font-semibold">£{r.price.toFixed(1)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function posLabel(et: number) {
  if (et === 1) return 'GKP'
  if (et === 2) return 'DEF'
  if (et === 3) return 'MID'
  if (et === 4) return 'FWD'
  return ''
}

