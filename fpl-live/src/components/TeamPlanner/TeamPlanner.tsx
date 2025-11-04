// src/components/TeamPlanner/TeamPlanner.tsx
import { useEffect, useMemo, useState } from 'react';
import type { EntryEventPicks, EntrySummary } from '../../types/fpl.types';
import { useFPLStore } from '../../store/fplStore';
import { getLive } from '../../services/fplApi';
import { calculatePoints } from '../../services/scoreCalculator';

export default function TeamPlanner({ picks, entry }: { picks?: EntryEventPicks, entry?: EntrySummary }) {
  const { players, bootstrap, fixtures, currentEvent, live } = useFPLStore();
  const events = bootstrap?.events ?? [];
  const maxGw = useMemo(() => (events.length ? Math.max(...events.map(e => e.id)) : 38), [events]);
  const currentGw = currentEvent?.id ?? 1;
  const defaultGw = Math.min((currentGw || 1) + 1, maxGw);
  const [gw, setGw] = useState<number>(defaultGw);
  const [localLive, setLocalLive] = useState<Record<number, any> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // keep gw in bounds when bootstrap arrives
    const desired = Math.min((currentGw || 1) + 1, maxGw);
    if (gw < 1 || gw > maxGw) setGw(desired);
  }, [currentGw, maxGw]);

  useEffect(() => {
    const want = gw;
    if (!want) return;
    if (!currentGw || want > currentGw) { setLocalLive(null); return; }
    // current gw: use store live, past gw: fetch
    if (want === currentGw && live) { setLocalLive(live as any); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const l = await getLive(want);
        if (cancelled) return;
        const idx = l.elements.reduce((acc: any, el: any) => { acc[el.id] = el.stats; return acc; }, {} as Record<number, any>);
        setLocalLive(idx);
      } catch (e) {
        setLocalLive(null);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true };
  }, [gw, currentGw, live]);

  const teamCodeById = useMemo(() => {
    const map: Record<number, number> = {};
    bootstrap?.teams.forEach((t) => { (map as any)[t.id] = (t as any).code; });
    return map;
  }, [bootstrap]);

  const oppByTeam = useMemo(() => {
    const out: Record<number, { opp: string; ha: 'H' | 'A'; started?: boolean; finished?: boolean } | undefined> = {};
    if (!fixtures || !bootstrap) return out;
    const short: Record<number, string> = {};
    bootstrap.teams.forEach((t) => (short[t.id] = t.short_name));
    fixtures.filter(f => f.event === gw).forEach((f) => {
      out[f.team_h] = { opp: short[f.team_a], ha: 'H', started: (f as any).started, finished: (f as any).finished };
      out[f.team_a] = { opp: short[f.team_h], ha: 'A', started: (f as any).started, finished: (f as any).finished };
    });
    return out;
  }, [fixtures, bootstrap, gw]);

  const starters = useMemo(() => {
    if (!picks) return [] as any[];
    return picks.picks.filter(p => p.position <= 11).sort((a,b)=>a.position-b.position);
  }, [picks]);
  const bench = useMemo(() => {
    if (!picks) return [] as any[];
    return picks.picks.filter(p => p.position > 11).sort((a,b)=>a.position-b.position);
  }, [picks]);

  const calc = useMemo(() => {
    if (!players || !picks || !localLive) return null;
    return calculatePoints(picks, localLive, players);
  }, [players, picks, localLive]);

  const pointsById = useMemo(() => {
    const out: Record<number, number> = {};
    if (!calc) return out;
    for (const b of calc.breakdown) out[b.element] = b.points;
    return out;
  }, [calc]);

  const tile = (id: number, badge?: string) => {
    const pl = players?.[id];
    if (!pl) return null;
    const code = teamCodeById[pl.team];
    const shirt = code ? `/assets/shirts/${code}.png` : undefined;
    const fix = oppByTeam[pl.team];
    const liveStats = localLive?.[id];
    const hasNotStartedGw = gw > currentGw;
    const matchNotStarted = !!fix && !fix.started && !fix.finished;
    const showTbd = hasNotStartedGw || matchNotStarted;
    const pts = (pointsById[id] ?? liveStats?.total_points ?? 0) as number;

    // Card UI aligned with TeamView/EntryLineup style
    return (
      <div className="group relative flex flex-col items-center text-center w-24">
        <div className="relative w-16 h-16 flex items-center justify-center">
          {shirt ? (
            <img src={shirt} alt="shirt" className="object-contain max-h-16" />
          ) : (
            <div className="w-12 h-12 bg-zinc-300 rounded" />
          )}
          {badge && (
            <div className="absolute -top-1 -right-1 text-[10px] bg-violet-600 text-white rounded px-1 shadow">{badge}</div>
          )}
        </div>
        {/* Stacked rectangular chips */}
        <div className="w-full text-[11px] font-semibold bg-white text-zinc-900 rounded-t-md px-2 py-1 shadow-sm">
          {pl.web_name}
        </div>
        <div className="w-full px-2 py-1 text-[11px] font-semibold bg-violet-700 text-white shadow rounded-none">
          {showTbd ? 'TBD' : pts}
        </div>
        {typeof pl.selected_by_percent !== 'undefined' && (
          <div className="w-full text-[10px] bg-black/70 px-2 py-1 text-white/90 rounded-b-md">
            Sel: {pl.selected_by_percent}%
          </div>
        )}
        {fix && (
          <div className="mt-0.5 text-[10px] text-zinc-700">{fix.opp} ({fix.ha})</div>
        )}
      </div>
    );
  };

  const gkRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 1), [starters, players]);
  const defRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 2), [starters, players]);
  const midRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 3), [starters, players]);
  const fwdRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 4), [starters, players]);

  if (!picks) return <div className="p-4 text-sm text-zinc-600">Load a team to use the planner.</div>;

  const headerPoints = gw > currentGw ? 'TBD' : calc ? String((calc.totalOnField ?? 0) + (calc.benchTotal ?? 0)) : '0';

  return (
    <div className="grid grid-cols-1 gap-6 p-6 min-h-screen">
      <div className="bg-white rounded-2xl p-0 shadow-sm border border-zinc-200 min-h-[360px] overflow-hidden">
        <div
          className="px-6 pt-24 pb-10"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.06), rgba(0,0,0,0.06)), url(/assets/pitch-bg.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'top center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGw((g) => Math.max(1, g - 1))}
                className="p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-zinc-800"
                aria-label="Previous gameweek"
              >
                ‹
              </button>
              <div className="text-base sm:text-lg font-semibold text-zinc-900">Gameweek {gw}</div>
              <button
                onClick={() => setGw((g) => Math.min(maxGw, g + 1))}
                className="p-1.5 rounded-full bg-black/10 hover:bg-black/20 text-zinc-800"
                aria-label="Next gameweek"
              >
                ›
              </button>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center justify-center rounded-xl px-3 py-2 shadow-sm ${headerPoints === 'TBD' ? 'bg-emerald-600/10 text-emerald-700' : 'bg-gradient-to-br from-sky-400 to-violet-600 text-white'}`}>
                <span className="text-xl font-extrabold">{headerPoints}</span>
              </div>
              <div className="text-[11px] mt-1 text-zinc-800">Latest Points</div>
            </div>
          </div>

          {loading && <div className="text-xs text-zinc-700 mb-3">Loading live points…</div>}

          <div className="space-y-8">
            <div className="flex justify-center gap-4">
              {gkRow.map((p) => tile(p.element, p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : undefined))}
            </div>
            <div className="flex justify-center gap-4 flex-wrap">
              {defRow.map((p) => tile(p.element, p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : undefined))}
            </div>
            <div className="flex justify-center gap-4 flex-wrap">
              {midRow.map((p) => tile(p.element, p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : undefined))}
            </div>
            <div className="flex justify-center gap-4 flex-wrap">
              {fwdRow.map((p) => tile(p.element, p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : undefined))}
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2"><span className="inline-block text-sm font-semibold text-zinc-700 bg-zinc-100 px-3 py-1 rounded-lg">Substitutes</span></div>
            <div className="rounded-2xl bg-white/80 backdrop-blur p-3 border border-white/60">
              <div className="grid grid-cols-4 gap-2">
                {bench.map((p) => tile(p.element))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
