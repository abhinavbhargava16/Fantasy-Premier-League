import { useEffect, useMemo, useState } from 'react';
import { useFPLStore } from '../../store/fplStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function FixturesPanel() {
  const { fixtures, bootstrap, currentEvent, players, live } = useFPLStore();
  const [activeGW, setActiveGW] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (currentEvent?.id && activeGW === undefined) setActiveGW(currentEvent.id);
  }, [currentEvent, activeGW]);

  const teamById = useMemo(() => {
    const map: Record<number, { short: string; code?: number }> = {};
    bootstrap?.teams.forEach((t) => (map[t.id] = { short: t.short_name, code: (t as any).code }));
    return map;
  }, [bootstrap]);

  const list = useMemo(() => {
    if (!activeGW) return [] as any[];
    return (fixtures ?? []).filter((f) => f.event === activeGW);
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

  const name = (id: number) => players?.[id]?.web_name ?? '';

  const buildExpanded = (f: any) => {
    if (!players || !live || activeGW !== currentEvent?.id) return null as null | { hGoals: any[]; aGoals: any[]; hAssists: any[]; aAssists: any[] };
    const teamToEls: Record<number, number[]> = {};
    Object.values(players).forEach((p) => { (teamToEls[p.team] ||= []).push(p.id); });
    const statsFor = (els: number[]) => els.map((id) => ({ id, s: (live as any)[id]! })).filter((x) => !!x.s);
    const hStats = statsFor(teamToEls[f.team_h] ?? []);
    const aStats = statsFor(teamToEls[f.team_a] ?? []);
    const toList = (list: { id: number; s: any }[], key: 'goals_scored' | 'assists') =>
      list.filter((x) => (x.s[key] ?? 0) > 0).map((x) => ({ id: x.id, n: x.s[key] }));
    return {
      hGoals: toList(hStats, 'goals_scored'),
      aGoals: toList(aStats, 'goals_scored'),
      hAssists: toList(hStats, 'assists'),
      aAssists: toList(aStats, 'assists'),
    };
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-zinc-800">Fixtures — GW {activeGW ?? ''}</h2>
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
            const date = f.kickoff_time && format(new Date(f.kickoff_time), 'EEE, MMM d – HH:mm');
            const isOpen = expanded === f.id;
            const expandedData = isOpen ? buildExpanded(f) : null;
            return (
              <div key={f.id} className="bg-zinc-100 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded((cur) => (cur === f.id ? null : f.id))}
                  className="w-full flex justify-between items-center px-3 py-2 hover:bg-zinc-200 transition-colors"
                >
                  <div className="flex items-center gap-2 text-zinc-800 font-medium">
                    {badge(f.team_h)}
                    <span>{home}</span>
                    <span className="text-zinc-400">vs</span>
                    {badge(f.team_a)}
                    <span>{away}</span>
                  </div>
                  {f.finished ? (
                    <span className="text-sm text-zinc-700">{f.team_h_score} - {f.team_a_score}</span>
                  ) : f.started ? (
                    <span className="text-sm text-amber-700">
                      {f.team_h_score ?? 0} - {f.team_a_score ?? 0} <span className="ml-1 inline-block text-[10px] px-1 py-0.5 rounded bg-amber-100">Live</span>
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">{date}</span>
                  )}
                </button>

                {isOpen && expandedData && (
                  <div className="px-3 pb-3">
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs font-semibold text-zinc-600 mb-1">Home</div>
                        {expandedData.hGoals.length === 0 && expandedData.hAssists.length === 0 ? (
                          <div className="text-xs text-zinc-500">—</div>
                        ) : (
                          <>
                            {expandedData.hGoals.map((g: any, i: number) => (
                              <div key={`hgs-${g.id}-${i}`}>{name(g.id)} <span className="ml-1">⚽×{g.n}</span></div>
                            ))}
                            {expandedData.hAssists.map((a: any, i: number) => (
                              <div key={`has-${a.id}-${i}`}>{name(a.id)} <span className="ml-1">🅰️×{a.n}</span></div>
                            ))}
                          </>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-600 mb-1">Away</div>
                        {expandedData.aGoals.length === 0 && expandedData.aAssists.length === 0 ? (
                          <div className="text-xs text-zinc-500">—</div>
                        ) : (
                          <>
                            {expandedData.aGoals.map((g: any, i: number) => (
                              <div key={`ags-${g.id}-${i}`}>{name(g.id)} <span className="ml-1">⚽×{g.n}</span></div>
                            ))}
                            {expandedData.aAssists.map((a: any, i: number) => (
                              <div key={`aas-${a.id}-${i}`}>{name(a.id)} <span className="ml-1">🅰️×{a.n}</span></div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
