// src/components/Fixtures/FixturesList.tsx
import { useEffect, useState } from 'react';
import { fetchBootstrap, fetchFixtures } from '../../services/fplApi';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Fixture {
  event: number;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  kickoff_time: string | null;
  finished: boolean;
}

interface Team {
  id: number;
  name: string;
  short_name: string;
}

export default function FixturesList() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Record<number, Team>>({});
  const [currentGW, setCurrentGW] = useState<number>(1);
  const [activeGW, setActiveGW] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  // Fetch fixtures and teams
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [bootstrap, fix] = await Promise.all([
        fetchBootstrap(),
        fetchFixtures(),
      ]);
      const teamMap = Object.fromEntries(
        bootstrap.teams.map((t: Team) => [t.id, t])
      );
      const gw = bootstrap.events.find((e: any) => e.is_current)?.id || 1;
      setTeams(teamMap);
      setCurrentGW(gw);
      setActiveGW(gw);
      setFixtures(fix);
      setLoading(false);
    }
    loadData().catch(console.error);
  }, []);

  const currentFixtures = fixtures.filter((f) => f.event === activeGW);

  const handlePrev = () => setActiveGW((gw) => Math.max(1, gw - 1));
  const handleNext = () => setActiveGW((gw) => Math.min(38, gw + 1));

  if (loading) return <div className="text-gray-400">Loading fixtures...</div>;

  return (
    <div className="bg-zinc-900 p-4 rounded-2xl shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-gray-100">
          Fixtures – GW {activeGW}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            disabled={activeGW <= 1}
            className="p-1.5 rounded-full bg-zinc-800 text-gray-300 hover:bg-zinc-700 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNext}
            disabled={activeGW >= 38}
            className="p-1.5 rounded-full bg-zinc-800 text-gray-300 hover:bg-zinc-700 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {currentFixtures.length === 0 ? (
        <p className="text-gray-400 text-sm">No fixtures available.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {currentFixtures.map((f) => {
            const home = teams[f.team_h]?.short_name || 'H';
            const away = teams[f.team_a]?.short_name || 'A';
            const date =
              f.kickoff_time &&
              format(new Date(f.kickoff_time), 'EEE, MMM d – HH:mm');
            const isFinished = f.finished;

            return (
              <div
                key={`${f.team_h}-${f.team_a}-${f.event}`}
                className="flex justify-between items-center bg-zinc-800 px-3 py-2 rounded-lg hover:bg-zinc-700/60 transition-colors"
              >
                <span className="text-gray-100 font-medium">
                  {home} <span className="text-gray-500">vs</span> {away}
                </span>
                {isFinished ? (
                  <span className="text-sm text-gray-300">
                    {f.team_h_score} - {f.team_a_score}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">{date}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeGW !== currentGW && (
        <p className="mt-2 text-xs text-gray-400 text-right italic">
          {activeGW > currentGW ? 'Upcoming fixtures' : 'Past fixtures'}
        </p>
      )}
    </div>
  );
}
