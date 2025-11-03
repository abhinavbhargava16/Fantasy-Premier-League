// src/App.tsx
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom'
import { useBootstrap } from './hooks/useFPLData'
import { useLiveScores } from './hooks/useLiveScores'
import { useFPLStore } from './store/fplStore'
import Dashboard from './components/Dashboard/Dashboard'
import LiveFixtures from './components/Fixtures/LiveFixtures'
import { getEntry, getEntryPicks } from './services/fplApi'
import type { EntryEventPicks } from './types/fpl.types'
import type { EntrySummary } from './types/fpl.types'


export default function App() {
  useBootstrap()
  useLiveScores({ intervalMs: 30000 })
  const { loading, error, currentEvent, setTeamId } = useFPLStore()
  const [teamInput, setTeamInput] = useState<string>('')
  const [picks, setPicks] = useState<EntryEventPicks | undefined>()
  const [entry, setEntry] = useState<EntrySummary | undefined>()
  const [busy, setBusy] = useState(false)


  async function loadTeam() {
    if (!teamInput || !currentEvent?.id) return
    setBusy(true)
    try {
      // Save entry id globally so other widgets (e.g., leagues) can render
      setTeamId(Number(teamInput))
      const [summary, data] = await Promise.all([
        getEntry(Number(teamInput)),
        getEntryPicks(Number(teamInput), currentEvent.id),
      ])
      setEntry(summary)
      setPicks(data)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to load team')
    } finally { setBusy(false) }
  }


  return (
    <BrowserRouter>
      <div className="min-h-dvh bg-fplPurple">
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-200">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-extrabold text-fplPurple">
              <img src="/assets/prem-league-logo.png" alt="FPL Live" className="h-7 w-auto" />
              <span className="text-lg tracking-tight">FPL Live</span>
            </Link>
            <nav className="flex items-center gap-2 text-base">
              <NavLink
                to="/"
                className={({ isActive }) => [
                  'px-3 py-1.5 rounded-xl border transition-colors',
                  isActive
                    ? 'border-fplPurple text-fplPurple bg-fplPurple/10'
                    : 'border-fplPurple/30 text-fplPurple hover:border-fplPurple/70 hover:bg-fplPurple/10'
                ].join(' ')}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/fixtures"
                className={({ isActive }) => [
                  'px-3 py-1.5 rounded-xl border transition-colors',
                  isActive
                    ? 'border-fplPurple text-fplPurple bg-fplPurple/10'
                    : 'border-fplPurple/30 text-fplPurple hover:border-fplPurple/70 hover:bg-fplPurple/10'
                ].join(' ')}
              >
                Fixtures
              </NavLink>
            </nav>
          </div>
        </header>


        <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center gap-2">
            <input
              value={teamInput}
              onChange={(e) => setTeamInput(e.target.value)}
              placeholder="Enter your Team ID (entry)"
              className="bg-white border border-zinc-300 rounded-xl text-sm w-56 px-2 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button onClick={loadTeam} disabled={busy || !currentEvent?.id || !teamInput || loading} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-60">
              {busy ? 'Loading…' : 'Load Team'}
            </button>
          </div>

          {entry && (
            <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur rounded-xl px-4 py-2 shadow-sm border border-zinc-200">
              <span className="font-extrabold text-zinc-900 text-lg">{entry.player_first_name} {entry.player_last_name}</span>
              <span className="text-zinc-400">•</span>
              <span className="text-zinc-700 text-lg font-medium">{entry.name}</span>
            </div>
          )}


          {loading && <div className="text-sm text-white/80">Loading bootstrap…</div>}
          {error && <div className="text-sm text-red-300">{error}</div>}


          <Routes>
            <Route path="/" element={<Dashboard picks={picks} entry={entry} busy={busy} />} />
            <Route path="/fixtures" element={<LiveFixtures />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
