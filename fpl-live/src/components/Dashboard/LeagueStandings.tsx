import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchManagerLeagues, fetchLeagueStandings } from '../../services/fplApi';
import { motion, AnimatePresence } from 'framer-motion';

interface League {
  id: number;
  name: string;
}
interface Standing {
  entry: number;
  entry_name: string;
  player_name: string;
  total: number;
  event_total: number;
  rank: number;
  last_rank: number;
}

export default function LeagueStandings({ teamId }: { teamId: number }) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Standing | null>(null);
  const navigate = useNavigate();

  // Fetch all leagues for the given team
  useEffect(() => {
    fetchManagerLeagues(teamId)
      .then(setLeagues)
      .catch((err) => console.error('Failed to fetch leagues:', err));
  }, [teamId]);

  // Fetch standings when a league is selected
  useEffect(() => {
    if (!selectedLeague) return;
    fetchLeagueStandings(selectedLeague)
      .then(setStandings)
      .catch((err) => console.error('Failed to fetch standings:', err));
  }, [selectedLeague]);

  const filtered = standings.filter(
    (s) =>
      s.player_name.toLowerCase().includes(search.toLowerCase()) ||
      s.entry_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 text-zinc-800">
      <h2 className="text-lg font-semibold mb-4">Mini-League Standings</h2>

      {/* League Dropdown */}
      <select
        className="w-full mb-3 bg-white text-zinc-800 rounded-lg px-3 py-2 outline-none border border-zinc-300 focus:border-violet-500"
        value={selectedLeague ?? ''}
        onChange={(e) => setSelectedLeague(Number(e.target.value))}
      >
        <option value="">Select a League</option>
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      {/* Search */}
      <input
        type="text"
        placeholder="Search manager..."
        className="w-full mb-3 bg-white text-zinc-800 rounded-lg px-3 py-2 outline-none border border-zinc-300 focus:border-violet-500"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Actions */}
      <div className="flex justify-end mb-2">
        {selectedLeague && (
          <button
            onClick={() => navigate(`/league/${selectedLeague}`)}
            className="px-3 py-1.5 rounded-lg bg-fplPurple text-white text-sm"
          >
            View detailed table
          </button>
        )}
      </div>

      {/* Standings */}
      <div className="overflow-y-auto max-h-[400px] rounded-lg border border-zinc-200">
        {filtered.map((s) => {
          const rankDiff = s.last_rank - s.rank;
          const color =
            rankDiff > 0
              ? 'text-emerald-400'
              : rankDiff < 0
              ? 'text-red-400'
              : 'text-gray-400';
          const arrow =
            rankDiff > 0 ? '▲' : rankDiff < 0 ? '▼' : '•';

          return (
            <motion.div
              key={s.entry}
              className="flex justify-between items-center border-b border-zinc-200 p-3 hover:bg-zinc-100 cursor-pointer transition-colors"
              onClick={() => setSelectedPlayer(s)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div>
                <span className={`font-semibold ${color}`}>
                  {s.rank} {arrow}
                </span>
                <span className="block text-xs text-zinc-500">
                  {s.player_name}
                </span>
              </div>
              <div className="text-right">
                <p className="font-medium">{s.event_total} pts</p>
                <p className="text-xs text-zinc-500">{s.total} total</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Mini-league comparison modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPlayer(null)}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full text-zinc-800 border border-zinc-200"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <h3 className="text-lg font-semibold mb-2">
                {selectedPlayer.player_name}
              </h3>
              <p className="text-sm mb-2 text-gray-400">
                {selectedPlayer.entry_name}
              </p>
              <p className="mb-1">Current Rank: {selectedPlayer.rank}</p>
              <p className="mb-1">Total Points: {selectedPlayer.total}</p>
              <p className="mb-3">GW Points: {selectedPlayer.event_total}</p>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 rounded-lg py-2 text-white transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
