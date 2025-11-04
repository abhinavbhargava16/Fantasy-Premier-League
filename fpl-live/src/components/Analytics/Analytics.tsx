import { useMemo, useState } from 'react'
import { getPlayerXG, getTeamXG } from '../../services/analyticsApi'
import { useFPLStore } from '../../store/fplStore'

type PlayerResp = {
  player: string
  totalXG: number
  totalXA: number
  matches: any[]
  error?: string
  // optional fields from backend for nicer UI
  playerName?: string
  badgeUrl?: string
}
type TeamResp = {
  team: string
  xG: number
  xGA: number
  xCS: number
  error?: string
  // optional branding
  badgeUrl?: string
}

export default function Analytics() {
  const { bootstrap } = useFPLStore()
  const [playerId, setPlayerId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerMode, setPlayerMode] = useState<'id' | 'name'>('id')
  const [teamName, setTeamName] = useState('')
  const [playerData, setPlayerData] = useState<PlayerResp | null>(null)
  const [teamData, setTeamData] = useState<TeamResp | null>(null)
  const [loadingP, setLoadingP] = useState(false)
  const [loadingT, setLoadingT] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const teamOptions = useMemo(() => bootstrap?.teams ?? [], [bootstrap])

  async function fetchPlayer() {
    const query = playerMode === 'id' ? playerId.trim() : playerName.trim()
    if (!query) return
    setLoadingP(true)
    setErr(null)
    setPlayerData(null)
    try {
      const data = await getPlayerXG(query)
      if (data?.error) setErr(data.error)
      setPlayerData(data)
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to fetch player analytics')
    } finally {
      setLoadingP(false)
    }
  }

  async function fetchTeam() {
    if (!teamName) return
    setLoadingT(true)
    setErr(null)
    setTeamData(null)
    try {
      const data = await getTeamXG(teamName)
      if (data?.error) setErr(data.error)
      setTeamData(data)
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to fetch team analytics')
    } finally {
      setLoadingT(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 space-y-3">
          <div className="font-extrabold text-fplPurple text-lg">Player xG/xA</div>
          <div className="flex items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="pmode" checked={playerMode==='id'} onChange={() => setPlayerMode('id')} />
              By ID
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="pmode" checked={playerMode==='name'} onChange={() => setPlayerMode('name')} />
              By Name
            </label>
          </div>
          {playerMode === 'id' ? (
            <div className="flex items-center gap-2">
              <input
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                placeholder="Understat player_id (e.g., 209244)"
                className="bg-white border border-zinc-300 rounded-xl text-sm w-56 px-2 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button onClick={fetchPlayer} disabled={!playerId || loadingP} className="px-3 py-2 rounded-xl bg-fplPurple text-white text-sm disabled:opacity-60">
                {loadingP ? 'Loading…' : 'Fetch Player'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Player name (e.g., Erling Haaland)"
                className="bg-white border border-zinc-300 rounded-xl text-sm w-72 px-2 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button onClick={fetchPlayer} disabled={!playerName || loadingP} className="px-3 py-2 rounded-xl bg-fplPurple text-white text-sm disabled:opacity-60">
                {loadingP ? 'Loading…' : 'Fetch Player'}
              </button>
            </div>
          )}
          {playerData && !playerData.error && (
            <div className="text-sm text-zinc-800 space-y-1">
              <div className="flex items-center gap-2">
                {playerData.badgeUrl && <img src={playerData.badgeUrl} alt="badge" className="h-5 w-5" />}
                <span>Player: <span className="font-semibold">{playerData.playerName ?? playerData.player}</span></span>
              </div>
              <div>Total xG: <span className="font-semibold">{playerData.totalXG}</span></div>
              <div>Total xA: <span className="font-semibold">{playerData.totalXA}</span></div>
              <div>Matches: <span className="font-semibold">{playerData.matches?.length ?? 0}</span></div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 space-y-3">
          <div className="font-extrabold text-fplPurple text-lg">Team xG/xGA/xCS</div>
          <p className="text-sm text-zinc-600">Pick a team or type a name/slug.</p>
          <div className="flex items-center gap-2">
            <select
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="bg-white border border-zinc-300 rounded-xl text-sm w-64 px-2 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select Premier League team…</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Or type team name or slug"
              className="bg-white border border-zinc-300 rounded-xl text-sm w-64 px-2 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button onClick={fetchTeam} disabled={!teamName || loadingT} className="px-3 py-2 rounded-xl bg-fplPurple text-white text-sm disabled:opacity-60">
              {loadingT ? 'Loading…' : 'Fetch Team'}
            </button>
          </div>
          {teamData && !teamData.error && (
            <div className="text-sm text-zinc-800 space-y-1">
              <div className="flex items-center gap-2">
                {teamData.badgeUrl && <img src={teamData.badgeUrl} alt="badge" className="h-5 w-5" />}
                <span>Team: <span className="font-semibold">{teamData.team}</span></span>
              </div>
              <div>xG: <span className="font-semibold">{teamData.xG}</span></div>
              <div>xGA: <span className="font-semibold">{teamData.xGA}</span></div>
              <div>xCS (sum of P(0)): <span className="font-semibold">{teamData.xCS}</span></div>
            </div>
          )}
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}
    </div>
  )
}
