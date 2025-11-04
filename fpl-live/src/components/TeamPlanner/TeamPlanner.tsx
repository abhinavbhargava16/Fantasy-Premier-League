// src/components/TeamPlanner/TeamPlanner.tsx
import { useEffect, useMemo, useState } from 'react';
import type { EntryEventPicks, EntrySummary } from '../../types/fpl.types';
import { useFPLStore } from '../../store/fplStore';
import { getLive } from '../../services/fplApi';
import { calculatePoints } from '../../services/scoreCalculator';

export default function TeamPlanner({ picks, entry: _entry }: { picks?: EntryEventPicks, entry?: EntrySummary }) {
  const { players, bootstrap, fixtures, currentEvent, live } = useFPLStore();
  const events = bootstrap?.events ?? [];
  const maxGw = useMemo(() => (events.length ? Math.max(...events.map(e => e.id)) : 38), [events]);
  const currentGw = currentEvent?.id ?? 1;
  const defaultGw = Math.min((currentGw || 1) + 1, maxGw);
  const [gw, setGw] = useState<number>(defaultGw);
  const [localLive, setLocalLive] = useState<Record<number, any> | null>(null);
  // Local working copy of picks for planner swaps
  const [planPicks, setPlanPicks] = useState<EntryEventPicks | undefined>(picks);
  // Currently selected starter to swap out
  const [selectedStarter, setSelectedStarter] = useState<number | null>(null);
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

  // Keep local plan picks in sync when source changes
  useEffect(() => { setPlanPicks(picks); }, [picks]);

  const starters = useMemo(() => {
    if (!planPicks) return [] as any[];
    return planPicks.picks.filter(p => p.position <= 11).sort((a,b)=>a.position-b.position);
  }, [planPicks]);
  const bench = useMemo(() => {
    if (!planPicks) return [] as any[];
    return planPicks.picks.filter(p => p.position > 11).sort((a,b)=>a.position-b.position);
  }, [planPicks]);

  const counts = useMemo(() => {
    const c = { gk: 0, def: 0, mid: 0, fwd: 0 };
    for (const s of starters) {
      const et = players?.[s.element]?.element_type;
      if (et === 1) c.gk++;
      else if (et === 2) c.def++;
      else if (et === 3) c.mid++;
      else if (et === 4) c.fwd++;
    }
    return c;
  }, [starters, players]);

  const minByType = { def: 3, mid: 2, fwd: 1 } as const;

  const isBenchEligibleForSelected = (benchElementId: number) => {
    if (!selectedStarter || !players) return true;
    const selType = players[selectedStarter]?.element_type;
    const bType = players[benchElementId]?.element_type;
    if (!selType || !bType) return false;
    if (selType === 1) return bType === 1; // GK only for GK
    // Outfield: ensure minimums after removing selected
    if (selType === 2 && counts.def <= minByType.def) return bType === 2;
    if (selType === 3 && counts.mid <= minByType.mid) return bType === 3;
    if (selType === 4 && counts.fwd <= minByType.fwd) return bType === 4;
    // otherwise any outfield
    return bType !== 1;
  };

  const eligibleBench = useMemo(() => {
    if (!selectedStarter) return bench;
    return bench.filter((b) => isBenchEligibleForSelected(b.element));
  }, [bench, selectedStarter, players, counts]);

  const calc = useMemo(() => {
    if (!players || !planPicks || !localLive) return null;
    return calculatePoints(planPicks, localLive, players);
  }, [players, planPicks, localLive]);

  const pointsById = useMemo(() => {
    const out: Record<number, number> = {};
    if (!calc) return out;
    for (const b of calc.breakdown) out[b.element] = b.points;
    return out;
  }, [calc]);

  const tile = (id: number, badge?: string, opts?: { onClick?: () => void; active?: boolean; disabled?: boolean }) => {
    const pl = players?.[id];
    if (!pl) return null;
    const code = teamCodeById[pl.team];
    const shirt = code ? `/assets/shirts/${code}.png` : undefined;
    const fix = oppByTeam[pl.team];
    const isFinished = !!fix?.finished;
    const liveStats = localLive?.[id];
    const hasNotStartedGw = gw > currentGw;
    const matchNotStarted = !!fix && !fix.started && !fix.finished;
    const showTbd = hasNotStartedGw || matchNotStarted;
    const pts = (pointsById[id] ?? liveStats?.total_points ?? 0) as number;

    // Card UI aligned with TeamView/EntryLineup style
    const clickable = !!opts?.onClick;
    const classes = [
      'group relative flex flex-col items-center text-center w-[5.75rem] transition-all',
      opts?.active ? 'ring-2 ring-white/90 rounded-xl bg-white/10' : '',
      opts?.disabled ? 'opacity-50 pointer-events-none' : '',
      clickable ? 'cursor-pointer hover:scale-[1.02]' : ''
    ].join(' ');

    return (
      <div className={classes} onClick={opts?.onClick}>
        <div className="relative w-[4rem] h-[4rem] flex items-center justify-center">
          {shirt ? (
            <img src={shirt} alt="shirt" className="object-contain max-h-[4rem]" />
          ) : (
            <div className="w-[4rem] h-[4rem] bg-zinc-300 rounded" />
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
          {showTbd ? (fix ? `${fix.opp} (${fix.ha})` : 'TBD') : pts}
        </div>
        {typeof pl.selected_by_percent !== 'undefined' && (
          <div className={`w-full text-[10px] bg-black/70 px-2 py-1 text-white/90 ${isFinished ? 'rounded-none' : 'rounded-b-md'}`}>
            Sel: {pl.selected_by_percent}%
          </div>
        )}
        {fix && !showTbd && (
          isFinished ? (
            <div className="w-full px-2 py-1 text-[11px] font-semibold bg-emerald-600 text-white shadow rounded-b-md">{fix.opp} ({fix.ha})</div>
          ) : (
            <div className="mt-0.5 text-[10px] text-zinc-700">{fix.opp} ({fix.ha})</div>
          )
        )}
      </div>
    );
  };

  const benchBadge = (elementId: number) => {
    const et = players?.[elementId]?.element_type;
    if (et === 1) return 'GK';
    if (et === 2) return 'DEF';
    if (et === 3) return 'MID';
    return 'FWD';
  };

  const renderStarter = (p: any) => {
    const id = p.element;
    const isActive = selectedStarter === id;
    const onClick = () => setSelectedStarter((cur) => (cur === id ? null : id));
    return tile(id, p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : undefined, { onClick, active: isActive });
  };

  const swapWithBench = (benchElementId: number) => {
    setPlanPicks((prev) => {
      if (!prev || !selectedStarter) return prev;
      const next = { ...prev, picks: prev.picks.map((x) => ({ ...x })) } as EntryEventPicks;
      const sIdx = next.picks.findIndex((x) => x.position <= 11 && x.element === selectedStarter);
      const bIdx = next.picks.findIndex((x) => x.position > 11 && x.element === benchElementId);
      if (sIdx >= 0 && bIdx >= 0) {
        const sPos = next.picks[sIdx].position;
        const bPos = next.picks[bIdx].position;
        const s = next.picks[sIdx];
        const b = next.picks[bIdx];
        next.picks[sIdx] = { ...b, position: sPos, is_captain: s.is_captain && players?.[b.element]?.element_type !== 1 ? s.is_captain : false, is_vice_captain: s.is_vice_captain && players?.[b.element]?.element_type !== 1 ? s.is_vice_captain : false, multiplier: 1 } as any;
        next.picks[bIdx] = { ...s, position: bPos, is_captain: false, is_vice_captain: false, multiplier: 1 } as any;
      }
      return next;
    });
    setSelectedStarter(null);
  };

  const renderBench = (p: any) => {
    const id = p.element;
    const eligible = isBenchEligibleForSelected(id);
    const onClick = selectedStarter && eligible ? () => swapWithBench(id) : undefined;
    return tile(id, benchBadge(id), { onClick, disabled: selectedStarter ? !eligible : false });
  };

  const gkRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 1), [starters, players]);
  const defRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 2), [starters, players]);
  const midRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 3), [starters, players]);
  const fwdRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 4), [starters, players]);

  if (!planPicks) return <div className="p-4 text-sm text-zinc-600">Load a team to use the planner.</div>;

  const headerPoints = gw > currentGw ? 'TBD' : calc ? String((calc.totalOnField ?? 0) + (calc.benchTotal ?? 0)) : '0';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6 p-6 min-h-screen">
      <div className="bg-white rounded-2xl p-0 shadow-sm border border-zinc-200 min-h-[360px] overflow-hidden order-1">
        {/* Top bar (dashboard style) */}
        <div className="px-6 pt-5 pb-4 border-b border-white/10 bg-[#3a0a3f]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <button
                onClick={() => setGw((g) => Math.max(1, g - 1))}
                disabled={loading}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
                aria-label="Previous gameweek"
              >
                ‹
              </button>
              <div className="text-lg md:text-xl font-semibold text-white">Gameweek {gw}</div>
              <button
                onClick={() => setGw((g) => Math.min(maxGw, g + 1))}
                disabled={loading}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
                aria-label="Next gameweek"
              >
                ›
              </button>
            </div>
            <div className="text-right">
              <div className={`inline-block rounded-2xl px-3 py-1.5 shadow ${headerPoints === 'TBD' ? 'bg-emerald-600/20' : 'bg-gradient-to-br from-sky-400 to-violet-600'} text-white`}>
                <span className="text-2xl font-bold">{headerPoints}</span>
              </div>
              <div className="text-[15px] mt-0.5 text-white/90">Latest Points</div>
            </div>
          </div>
        </div>

        {/* Pitch / team view */}
        {/* Pitch area only */}
        <div
          className="px-6 pt-32 pb-16"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.06), rgba(0,0,0,0.06)), url(/assets/pitch-bg.png)`,
            // First layer (gradient) covers container, second layer (pitch) is slightly taller to fit cards
            backgroundSize: '100% 100%, 100% 120%',
            backgroundPosition: 'top center, top center',
            backgroundRepeat: 'no-repeat, no-repeat',
          }}
        >
          <div className="relative">
            {selectedStarter && (
              <div className="absolute inset-0 backdrop-blur-sm bg-black/10 pointer-events-none rounded-2xl z-0" />
            )}
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-sm" aria-busy="true" aria-live="polite">
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/80 text-zinc-700 shadow border border-zinc-200">
                  <div className="h-5 w-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                  <span className="text-sm">Updating planner…</span>
                </div>
              </div>
            )}

            <div className="relative z-0 space-y-7">
              <div className="flex justify-center gap-3">
                {gkRow.map((p) => renderStarter(p))}
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                {defRow.map((p) => renderStarter(p))}
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                {midRow.map((p) => renderStarter(p))}
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                {fwdRow.map((p) => renderStarter(p))}
              </div>
            </div>

          </div>
        </div>
      </div>
      {/* Substitutes bench rendered outside the team view container */}
      <aside className="order-2 lg:order-1">
        <div className="mb-2"><span className="inline-block text-sm font-semibold text-white bg-white/15 px-3 py-1 rounded-lg shadow-sm">Substitutes</span></div>
        <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-1 lg:gap-3 place-items-center">
            {(selectedStarter ? eligibleBench : bench).map((p, i) => (
              <div key={i}>{renderBench(p)}</div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
