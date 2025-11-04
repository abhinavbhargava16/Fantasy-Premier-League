import type { EntryEventPicks, EntrySummary } from '../../types/fpl.types';
import { useFPLStore } from '../../store/fplStore';
import { useEffect, useMemo, useState } from 'react';
import { calculatePoints } from '../../services/scoreCalculator';
import { getEntryPicks, getLive } from '../../services/fplApi';
// import pitchBg from '../../assets/pitch-bg.png';

export default function TeamView({ picks, entry, mode = 'live', planGw }: { picks?: EntryEventPicks, entry?: EntrySummary, mode?: 'live' | 'plan', planGw?: number }) {
  const { players, bootstrap, live, fixtures, currentEvent, teamId } = useFPLStore();
  const initialGw = (mode === 'plan' ? (planGw ?? currentEvent?.id) : currentEvent?.id);
  const [activeGW, setActiveGW] = useState<number | undefined>(initialGw);
  const [localPicks, setLocalPicks] = useState<EntryEventPicks | undefined>();
  const [localLive, setLocalLive] = useState<any | undefined>();
  const [loadingGw, setLoadingGw] = useState(false);
  // Initialize activeGW when bootstrap/currentEvent loads
  useEffect(() => {
    if (mode === 'plan') {
      // Keep GW in sync with external planner controls
      if (planGw && planGw !== activeGW) setActiveGW(planGw);
      return;
    }
    if (currentEvent?.id && !activeGW) setActiveGW(currentEvent.id);
  }, [currentEvent, activeGW, mode, planGw]);

  // Fetch historic picks/live when browsing a different GW
  useEffect(() => {
    const wantGw = activeGW;
    if (!wantGw || !teamId) return;
    // In planner mode, we deliberately do not fetch historic/future picks or live
    if (mode === 'plan') {
      setLocalPicks(undefined);
      setLocalLive(undefined);
      return;
    }
    const isCurrent = currentEvent?.id === wantGw;
    if (isCurrent) {
      setLocalPicks(undefined);
      setLocalLive(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingGw(true);
        const [p, l] = await Promise.all([
          getEntryPicks(teamId, wantGw),
          getLive(wantGw),
        ]);
        if (cancelled) return;
        // live to index by player id
        const liveIndex = l.elements.reduce((acc: any, el: any) => {
          acc[el.id] = el.stats;
          return acc;
        }, {} as Record<number, any>);
        setLocalPicks(p);
        setLocalLive(liveIndex);
      } catch (e) {
        console.error('Failed to fetch GW data', e);
      } finally {
        if (!cancelled) setLoadingGw(false);
      }
    })();
    return () => { cancelled = true };
  }, [activeGW, teamId, currentEvent?.id, mode]);

  const usingPicks = (mode === 'plan') ? (picks) : (localPicks ?? picks);
  const usingLive = (mode === 'plan') ? ({} as any) : ((localPicks ? localLive : live) as any);

  // Only guard when no picks yet
  if (!usingPicks) return null;
  const teamCodeById = useMemo(() => {
    const map: Record<number, number> = {};
    bootstrap?.teams.forEach((t) => { map[t.id] = (t as any).code; });
    return map;
  }, [bootstrap]);

  const calc = useMemo(() => {
    if (!usingPicks || !usingLive || !players) return null;
    return calculatePoints(usingPicks, usingLive, players);
  }, [usingPicks, usingLive, players]);

  const calcPointsById = useMemo(() => {
    const out: Record<number, number> = {};
    if (!calc) return out;
    for (const b of calc.breakdown) out[b.element] = b.points;
    return out;
  }, [calc]);

  const oppByTeam = useMemo(() => {
    const out: Record<number, { opp: string; ha: 'H' | 'A'; started?: boolean; finished?: boolean } | undefined> = {};
    const gw = activeGW ?? currentEvent?.id;
    if (!gw || !fixtures || !bootstrap) return out;
    const teamShort: Record<number, string> = {};
    bootstrap.teams.forEach((t) => (teamShort[t.id] = t.short_name));
    fixtures
      .filter((f) => f.event === gw)
      .forEach((f) => {
        out[f.team_h] = { opp: teamShort[f.team_a], ha: 'H', started: f.started, finished: f.finished };
        out[f.team_a] = { opp: teamShort[f.team_h], ha: 'A', started: f.started, finished: f.finished };
      });
    return out;
  }, [fixtures, bootstrap, activeGW, currentEvent]);
  const starters = usingPicks.picks
    .filter((p) => p.position <= 11)
    .sort((a, b) => a.position - b.position);
  const bench = usingPicks.picks
    .filter((p) => p.position > 11)
    .sort((a, b) => a.position - b.position);

  // For starters, only show C/VC (no generic XI badge)
  const getBadge = (p: any) => (p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : '');

  const getBenchBadge = (elementId: number) => {
    const et = players?.[elementId]?.element_type;
    if (et === 1) return 'GK';
    if (et === 2) return 'DEF';
    if (et === 3) return 'MID';
    if (et === 4) return 'FWD';
    return 'SUB';
  };

  const tile = (id: number, badge: string) => {
    const player = players?.[id];
    if (!player) return null;

    const codeOrId = teamCodeById[player.team] ?? player.team;
    const points = calcPointsById[id] ?? (usingLive?.[id]?.total_points ?? 0);
    const liveStats = usingLive?.[id];
    const fix = oppByTeam[player.team];
    const status = player.status; // 'a' active, 'd' doubt, 'i' injured, 's' suspended
    const statusLabel = status === 'd' ? '75%' : status === 'i' ? 'INJ' : status === 's' ? 'SUS' : '';
    const nameBg = status === 's' || status === 'i' ? 'bg-red-500 text-white' : status === 'd' ? 'bg-amber-300 text-black' : 'bg-white text-zinc-900';

    const showFixtureInsteadOfZero = (!liveStats || (liveStats.minutes ?? 0) === 0) && fix && !fix.started && !fix.finished;
    const pointsDisplay: string | number = showFixtureInsteadOfZero ? `${fix.opp} (${fix.ha})` : points;

    return (
      <div className="group relative flex flex-col items-center text-center w-24 text-white">
        <div className="absolute inset-0 rounded-xl bg-white/10 blur-[1px] -z-10" />
        <img
          src={`/assets/shirts/${codeOrId}.jpg`}
          alt={player.web_name}
          className="w-14 h-14 object-contain mb-1"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.dataset.fallback !== 'png') {
              img.dataset.fallback = 'png';
              img.src = `/assets/shirts/${codeOrId}.png`;
            } else {
              img.style.display = 'none';
            }
          }}
        />
        {badge && (
          <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
            {badge}
          </span>
        )}
        {statusLabel && (
          <span className="absolute -top-1 -left-1 bg-amber-400 text-black text-[9px] font-bold px-1 rounded shadow-md">
            {statusLabel}
          </span>
        )}
        {/* Stacked rectangular chips: Name, Points/Fixture, Selection */}
        <div className={`w-full text-[11px] font-semibold ${nameBg} rounded-t-md px-2 py-1 shadow-sm`}
        >
          {player.web_name}
        </div>
        <div className="w-full px-2 py-1 text-[11px] font-semibold bg-violet-700 text-white shadow rounded-none">
          {pointsDisplay}
        </div>
        {player.selected_by_percent && (
          <div className="w-full text-[10px] bg-black/70 px-2 py-1 text-white/90 rounded-b-md">
            Sel: {player.selected_by_percent}%
          </div>
        )}
        {/* Hover tooltip with events */}
        <div className="hidden group-hover:block absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-white text-zinc-800 text-[11px] rounded-md shadow-lg px-3 py-2 w-max max-w-[180px]">
          <div className="font-semibold mb-1">{player.web_name}</div>
          <div className="space-y-0.5 text-left">
            <div>Minutes: {usingLive?.[id]?.minutes ?? 0}</div>
            <div>Goals: {usingLive?.[id]?.goals_scored ?? 0}</div>
            <div>Assists: {usingLive?.[id]?.assists ?? 0}</div>
            <div>Clean Sheet: {usingLive?.[id]?.clean_sheets ?? 0}</div>
          </div>
        </div>
      </div>
    );
  };

  // Group starters by element type to reflect actual formation
  const gkRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 1), [starters, players]);
  const defRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 2), [starters, players]);
  const midRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 3), [starters, players]);
  const fwdRow = useMemo(() => starters.filter((p) => players?.[p.element]?.element_type === 4), [starters, players]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-lg p-0 border border-zinc-700 bg-[#2b0630] text-white"
      style={{ minHeight: '520px' }}
    >
      {/* Top status bar */}
      <div className="px-6 pt-5 pb-4 border-b border-white/10 bg-[#3a0a3f]">
        <div className="flex items-center justify-between mb-3 text-white">
          <div className="flex items-center gap-3">
            <button
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20"
              disabled={!activeGW || activeGW <= 1 || loadingGw}
              onClick={() => setActiveGW((g) => (g ? Math.max(1, g - 1) : g))}
            >
              ‹
            </button>
            <div className="text-lg font-semibold text-white">Gameweek {activeGW ?? ''}</div>
            <button
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20"
              disabled={!activeGW || activeGW >= 38 || loadingGw}
              onClick={() => setActiveGW((g) => (g ? Math.min(38, g + 1) : g))}
            >
              ›
            </button>
            {loadingGw && <span className="text-xs text-white/70">Loading…</span>}
          </div>
        </div>

        {calc && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-stretch">
            {/* Left metrics */}
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <div className="text-2xl font-bold">{bootstrap?.events.find(e => e.id === activeGW)?.average_entry_score ?? '—'}</div>
              <div className="text-[11px] text-white/80">Average Points</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <div className="text-2xl font-bold">{bootstrap?.events.find(e => e.id === activeGW)?.highest_score ?? '—'}</div>
              <div className="text-[11px] text-white/80">Highest Points</div>
            </div>
            {/* Center latest points */}
            <div className="rounded-2xl bg-gradient-to-br from-sky-400 to-violet-600 p-4 text-center shadow">
              <div className="text-4xl font-extrabold text-white">{calc.totalOnField + calc.benchTotal}</div>
              <div className="text-[11px] text-white/90 mt-0.5">Latest Points</div>
            </div>
            {/* Right metrics */}
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <div className="text-2xl font-bold">{usingPicks.entry_history.rank ?? '—'}</div>
              <div className="text-[11px] text-white/80">GW Rank</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <div className="text-2xl font-bold">{usingPicks.entry_history.event_transfers ?? 0}</div>
              <div className="text-[11px] text-white/80">Transfers</div>
            </div>
          </div>
        )}
      </div>

      {/* Pitch background */}
      <div
        className="px-6 pt-28 pb-14 lg:pt-32"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.18)), url(/assets/pitch-bg.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      >
      {/* No image-based overlay required; we render only when players are ready */}
      {/* Header with manager info (optional) */}
      {false && (
        <div className="mb-4 flex items-center justify-between text-white/90">
          <div className="text-sm">
            <div className="text-xs uppercase tracking-wide text-white/70">Gameweek {bootstrap?.events.find(e => e.is_current)?.id ?? ''}</div>
            {entry && (
              <div className="font-semibold">
                {entry?.player_first_name} {entry?.player_last_name}
                <span className="mx-2 text-white/60">•</span>
                <span className="text-white/80">{entry?.name}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-300 drop-shadow">{(calc?.totalOnField ?? 0) + (calc?.benchTotal ?? 0)}</div>
            <div className="text-[11px] text-white/70">Live GW Points</div>
          </div>
        </div>
      )}

      {!players && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-sm text-white/90 bg-black/30 px-3 py-1 rounded-full">Loading players…</div>
        </div>
      )}
      {/* Starters with dynamic formation */}
      <div className="space-y-8">
        {/* Goalkeeper */}
        <div className="flex justify-center gap-4">
          {gkRow.map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Defenders */}
        <div className="flex justify-center gap-4 flex-wrap">
          {defRow.map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Midfielders */}
        <div className="flex justify-center gap-4 flex-wrap">
          {midRow.map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Forwards */}
        <div className="flex justify-center gap-4 flex-wrap">
          {fwdRow.map((p) => tile(p.element, getBadge(p)))}
        </div>
      </div>

      {/* Bench */}
      <div className="mt-8">
        <div className="mb-2">
          <span className="inline-block text-sm font-semibold text-white bg-white/15 px-3 py-1 rounded-lg shadow-sm">Substitutes</span>
        </div>
        <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
          <div className="grid grid-cols-4 gap-2">
            {bench.map((p) => tile(p.element, getBenchBadge(p.element)))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
