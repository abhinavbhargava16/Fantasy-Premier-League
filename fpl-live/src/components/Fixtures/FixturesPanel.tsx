import { useEffect, useMemo, useState } from 'react';
import { useFPLStore } from '../../store/fplStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function FixturesPanel() {
  const { fixtures, bootstrap, currentEvent } = useFPLStore();
  const [activeGW, setActiveGW] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (currentEvent?.id && activeGW === undefined) setActiveGW(currentEvent.id);
  }, [currentEvent, activeGW]);

  const teamById = useMemo(() => {
    const map: Record<number, { short: string; code?: number }> = {};
    bootstrap?.teams.forEach((t) => (map[t.id] = { short: t.short_name, code: (t as any).code }));
    return map;
  }, [bootstrap]);

  const list = useMemo(() => {
    if (!activeGW || !fixtures) return [] as typeof fixtures;
    return fixtures.filter((f) => f.event === activeGW);
  }, [fixtures, activeGW]);

  const badge = (teamId: number) => {
    const t = teamById[teamId];
    const code = t?.code ?? teamId;
    const src = `/assets/badges/${code}.png`;
    return (
      <img
        src={src}
        alt={t?.short ?? ''}
        className="w-5 h-5 object-contain"
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (img.dataset.fallback !== 'shirts') {
            img.dataset.fallback = 'png';
            img.src = `/assets/shirts/${code}.png`;
          } else {
            img.style.display = 'none';
          }
        }}
      />
    );
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-zinc-800">Fixtures – GW {activeGW ?? ''}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveGW((g) => (g ? Math.max(1, g - 1) : g))}
            disabled={!activeGW || activeGW <= 1}
            className="p-1.5 rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setActiveGW((g) => (g ? Math.min(38, g + 1) : g))}
            disabled={!activeGW || activeGW >= 38}
            className="p-1.5 rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {!activeGW ? (
        <div className="text-zinc-500 text-sm">Loading fixtures…</div>
      ) : list.length === 0 ? (
        <p className="text-zinc-500 text-sm">No fixtures available.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((f) => {
            const home = teamById[f.team_h]?.short ?? 'H';
            const away = teamById[f.team_a]?.short ?? 'A';
            const date = f.kickoff_time && format(new Date(f.kickoff_time), 'EEE, MMM d • HH:mm');
            const isFinished = f.finished;
            return (
              <div
                key={`${f.team_h}-${f.team_a}-${f.event}`}
                className="flex justify-between items-center bg-zinc-100 px-3 py-2 rounded-lg hover:bg-zinc-200 transition-colors"
              >
                <div className="flex items-center gap-2 text-zinc-800 font-medium">
                  {badge(f.team_h)}
                  <span>{home}</span>
                  <span className="text-zinc-400">vs</span>
                  {badge(f.team_a)}
                  <span>{away}</span>
                </div>
                {isFinished ? (
                  <span className="text-sm text-zinc-700">
                    {f.team_h_score} - {f.team_a_score}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">{date}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}




