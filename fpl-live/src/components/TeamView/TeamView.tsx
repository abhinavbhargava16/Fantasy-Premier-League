import type { EntryEventPicks, EntrySummary } from '../../types/fpl.types';
import { useFPLStore } from '../../store/fplStore';
import { useMemo } from 'react';
import { calculatePoints } from '../../services/scoreCalculator';
// import pitchBg from '../../assets/pitch-bg.png';

export default function TeamView({ picks, entry }: { picks?: EntryEventPicks, entry?: EntrySummary }) {
  const { players, bootstrap, live, fixtures, currentEvent } = useFPLStore();
  // Only guard when no picks; when players still loading, we render a lightweight shell
  if (!picks) return null;
  const teamCodeById = useMemo(() => {
    const map: Record<number, number> = {};
    bootstrap?.teams.forEach((t) => { map[t.id] = (t as any).code; });
    return map;
  }, [bootstrap]);

  const calc = useMemo(() => {
    if (!picks || !live || !players) return null;
    return calculatePoints(picks, live, players);
  }, [picks, live, players]);

  const calcPointsById = useMemo(() => {
    const out: Record<number, number> = {};
    if (!calc) return out;
    for (const b of calc.breakdown) out[b.element] = b.points;
    return out;
  }, [calc]);

  const oppByTeam = useMemo(() => {
    const out: Record<number, { opp: string; ha: 'H' | 'A' } | undefined> = {};
    const gw = currentEvent?.id;
    if (!gw || !fixtures || !bootstrap) return out;
    const teamShort: Record<number, string> = {};
    bootstrap.teams.forEach((t) => (teamShort[t.id] = t.short_name));
    fixtures
      .filter((f) => f.event === gw)
      .forEach((f) => {
        out[f.team_h] = { opp: teamShort[f.team_a], ha: 'H' };
        out[f.team_a] = { opp: teamShort[f.team_h], ha: 'A' };
      });
    return out;
  }, [fixtures, bootstrap, currentEvent]);
  const starters = picks.picks
    .filter((p) => p.position <= 11)
    .sort((a, b) => a.position - b.position);
  const bench = picks.picks
    .filter((p) => p.position > 11)
    .sort((a, b) => a.position - b.position);

  const getBadge = (p: any) =>
    p.is_captain ? 'C' : p.is_vice_captain ? 'VC' : 'XI';

  const tile = (id: number, badge: string) => {
    const player = players?.[id];
    if (!player) return null;

    const codeOrId = teamCodeById[player.team] ?? player.team;
    const points = calcPointsById[id] ?? (live?.[id]?.total_points ?? 0);
    const fix = oppByTeam[player.team];
    const status = player.status; // 'a' active, 'd' doubt, 'i' injured, 's' suspended
    const statusLabel = status === 'd' ? '75%' : status === 'i' ? 'INJ' : status === 's' ? 'SUS' : '';

    return (
      <div className="group relative flex flex-col items-center text-center w-24 text-white">
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
        {/* Name chip and points pattern */}
        <div className="text-[11px] font-semibold bg-white text-zinc-900 rounded-md px-2 py-0.5 shadow-sm">
          {player.web_name}
        </div>
        <div className="mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-700 text-white shadow">
          {points}
        </div>
        {player.selected_by_percent && (
          <div className="mt-1 text-[10px] bg-black/70 px-2 py-0.5 rounded text-white/90">
            Sel: {player.selected_by_percent}%
          </div>
        )}
        {/* Hover tooltip with events */}
        <div className="hidden group-hover:block absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-white text-zinc-800 text-[11px] rounded-md shadow-lg px-3 py-2 w-max max-w-[180px]">
          <div className="font-semibold mb-1">{player.web_name}</div>
          <div className="space-y-0.5 text-left">
            <div>Minutes: {live?.[id]?.minutes ?? 0}</div>
            <div>Goals: {live?.[id]?.goals_scored ?? 0}</div>
            <div>Assists: {live?.[id]?.assists ?? 0}</div>
            <div>Clean Sheet: {live?.[id]?.clean_sheets ?? 0}</div>
          </div>
        </div>
        {fix && (
          <div className="text-[10px] text-white/80 mt-0.5">
            {fix.opp} ({fix.ha})
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-lg p-6 border border-zinc-200"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15)), url(/assets/pitch-bg.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '420px',
      }}
    >
      {/* No image-based overlay required; we render only when players are ready */}
      {/* Header with points and manager info */}
      {calc && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-stretch">
          <div className="col-span-2 sm:col-span-1">
            <div className="text-xs uppercase tracking-wide text-white/70">Gameweek {bootstrap?.events.find(e => e.is_current)?.id ?? ''}</div>
            {entry?.player_first_name && (
              <div className="font-semibold text-white/90">
                {entry.player_first_name} {entry.player_last_name}
                <span className="mx-2 text-white/60">•</span>
                <span className="text-white/80">{entry.name}</span>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-white text-zinc-900 p-3 text-center shadow-sm">
            <div className="text-3xl font-extrabold bg-gradient-to-br from-sky-500 to-violet-600 bg-clip-text text-transparent">{calc.totalOnField + calc.benchTotal}</div>
            <div className="text-[11px] text-zinc-600 mt-0.5">Latest Points</div>
          </div>
          <div className="rounded-xl bg-black/30 text-white p-3 text-center">
            <div className="text-xl font-bold">{bootstrap?.events.find(e => e.is_current)?.average_entry_score ?? '—'}</div>
            <div className="text-[11px] text-white/80">Average Points</div>
          </div>
          <div className="rounded-xl bg-black/30 text-white p-3 text-center">
            <div className="text-xl font-bold">{picks.entry_history.rank ?? '—'}</div>
            <div className="text-[11px] text-white/80">GW Rank</div>
          </div>
        </div>
      )}
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
      {/* Starters */}
      <div className="space-y-6">
        {/* Goalkeeper */}
        <div className="flex justify-center">
          {starters.slice(0, 1).map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Defenders */}
        <div className="flex justify-center gap-4">
          {starters.slice(1, 5).map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Midfielders */}
        <div className="flex justify-center gap-4">
          {starters.slice(5, 9).map((p) => tile(p.element, getBadge(p)))}
        </div>

        {/* Forwards */}
        <div className="flex justify-center gap-4">
          {starters.slice(9, 11).map((p) => tile(p.element, getBadge(p)))}
        </div>
      </div>

      {/* Bench */}
      <div className="mt-6">
        <div className="text-xs text-white mb-2 font-semibold">Bench</div>
        <div className="grid grid-cols-4 gap-2">
          {bench.map((p) => tile(p.element, p.position === 15 ? 'GK' : 'S'))}
        </div>
      </div>
    </div>
  );
}
