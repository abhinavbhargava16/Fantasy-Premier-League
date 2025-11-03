// src/App.tsx
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useBootstrap } from './hooks/useFPLData'
import { useLiveScores } from './hooks/useLiveScores'
import { useFPLStore } from './store/fplStore'
import Dashboard from './components/Dashboard/Dashboard'
import ChatPanel from './components/Chat/ChatPanel'
import { getEntryPicks } from './services/fplApi'
import type { EntryEventPicks } from './types/fpl.types'


export default function App() {
  useBootstrap()
  useLiveScores({ intervalMs: 30000 })
  const { loading, error, currentEvent, setTeamId } = useFPLStore()
  const [teamInput, setTeamInput] = useState<string>('')
  const [picks, setPicks] = useState<EntryEventPicks | undefined>()
  const [busy, setBusy] = useState(false)


  async function loadTeam() {
    if (!teamInput || !currentEvent?.id) return
    setBusy(true)
    try {
      // Save entry id globally so other widgets (e.g., leagues) can render
      setTeamId(Number(teamInput))
      const data = await getEntryPicks(Number(teamInput), currentEvent.id)
      setPicks(data)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to load team')
    } finally { setBusy(false) }
  }


  return (
    <BrowserRouter>
      <div className="min-h-dvh bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-10 backdrop-blur bg-zinc-950/70 border-b border-zinc-900">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="font-bold">FPL Live</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/" className="hover:text-emerald-400">Dashboard</Link>
              <Link to="/chat" className="hover:text-emerald-400">Chat</Link>
            </nav>
          </div>
        </header>


        <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center gap-2">
            <input
              value={teamInput}
              onChange={(e) => setTeamInput(e.target.value)}
              placeholder="Enter your Team ID (entry)"
              className="bg-zinc-900 border-zinc-800 rounded-xl text-sm w-56"
            />
            <button onClick={loadTeam} disabled={busy} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-60">
              {busy ? 'Loading…' : 'Load Team'}
            </button>
          </div>


          {loading && <div className="text-sm text-zinc-400">Loading bootstrap…</div>}
          {error && <div className="text-sm text-red-400">{error}</div>}


          <Routes>
            <Route path="/" element={<Dashboard picks={picks} />} />
            <Route path="/chat" element={<ChatPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
