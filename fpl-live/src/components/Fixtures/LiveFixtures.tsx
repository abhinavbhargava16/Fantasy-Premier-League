import { useMemo } from 'react';
import { useFPLStore } from '../../store/fplStore';

function ShirtBadge({ teamCode, short }: { teamCode?: number; short?: string }) {
  const code = teamCode ?? 0;
  return (
    <img
      src={`/assets/badges/${code}.png`}
      alt={short ?? ''}
      className="w-10 h-10 object-contain"
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        if (img.dataset.fallback !== 'shirts') {
          img.dataset.fallback = 'shirts';
          img.src = `/assets/shirts/${code}.png`;
        } else {
          img.style.display = 'none';
        }
      }}
    />
  );
}

export default function LiveFixtures() {
  const { fixtures, bootstrap, live, players, currentEvent } = useFPLStore();

  const currentGw = currentEvent?.id;
  const teams = bootstrap?.teams ?? [];
  const teamMeta = useMemo(() => {
    const idx: Record<number, { short: string; name: string; code: number }> = {};
    teams.forEach((t: any) => (idx[t.id] = { short: t.short_name, name: t.name, code: t.code }));
    return idx;
  }, [teams]);

  const byFixture = useMemo(() => {
    if (!fixtures || !players || !live || !currentGw) return [] as any[];
    const gwFixtures = fixtures.filter((f) => f.event === currentGw);
    // Build team -> elementIds mapping
    const teamToEls: Record<number, number[]> = {};
    Object.values(players).forEach((p) => {
      (teamToEls[p.team] ||= []).push(p.id);
    });
    return gwFixtures.map((f) => {
      const homeEls = (teamToEls[f.team_h] ?? []).filter((id) => !!live[id]);
      const awayEls = (teamToEls[f.team_a] ?? []).filter((id) => !!live[id]);
      const statsFor = (els: number[]) => els.map((id) => ({ id, s: live[id]! }));

      const hStats = statsFor(homeEls);
      const aStats = statsFor(awayEls);

      const toList = (list: { id: number; s: any }[], key: 'goals_scored' | 'assists') =>
        list.filter((x) => (x.s[key] ?? 0) > 0).map((x) => ({ id: x.id, n: x.s[key] }));

      const hGoals = toList(hStats, 'goals_scored');
      const aGoals = toList(aStats, 'goals_scored');
      const hAssists = toList(hStats, 'assists');
      const aAssists = toList(aStats, 'assists');

      const combineForBps = [...hStats, ...aStats]
        .map((x) => ({ id: x.id, bps: x.s.bps ?? 0 }))
        .sort((x, y) => y.bps - x.bps)
        .slice(0, 6);

      const byBps = (list: { id: number; s: any }[]) => list
        .map((x) => ({ id: x.id, bps: x.s.bps ?? 0 }))
        .sort((a, b) => b.bps - a.bps)
        .slice(0, 10);
      const hBps = byBps(hStats);
      const aBps = byBps(aStats);

      // Determine bonus winners and map to emojis 3/2/1
      const awards: Record<number, string> = {};
      const bonusRank = [...hStats, ...aStats]
        .map((x) => ({ id: x.id, bonus: x.s.bonus ?? 0, bps: x.s.bps ?? 0 }))
        .filter((x) => x.bonus > 0)
        .sort((a, b) => (b.bonus - a.bonus) || (b.bps - a.bps));
      for (const x of bonusRank) {
        if (x.bonus === 3) awards[x.id] = '🥇';
        else if (x.bonus === 2) awards[x.id] = '🥈';
        else if (x.bonus === 1) awards[x.id] = '🥉';
      }

      // Outfield-only defensive contribution (exclude goalkeepers)
      const isOutfieldDef = (id: number) => players[id]?.element_type === 2;
      const defValue = (x: { s: any }) => (x.s.bps ?? 0) + (x.s.clean_sheets ?? 0);
      const hDefcon = hStats
        .filter((x) => isOutfieldDef(x.id))
        .map((x) => ({ id: x.id, v: defValue(x) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 10);
      const aDefcon = aStats
        .filter((x) => isOutfieldDef(x.id))
        .map((x) => ({ id: x.id, v: defValue(x) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 10);

      return {
        f,
        home: teamMeta[f.team_h],
        away: teamMeta[f.team_a],
        hGoals,
        aGoals,
        hAssists,
        aAssists,
        bpsTop: combineForBps,
        hBps,
        aBps,
        awards,
        hDefcon,
        aDefcon,
      };
    });
  }, [fixtures, players, live, currentGw, teamMeta]);

  const name = (id: number) => players?.[id]?.web_name ?? '';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="text-2xl font-semibold mb-4 text-white">Gameweek {currentGw} Games</div>
      <div className="grid md:grid-cols-2 gap-6">
        {byFixture.map(({ f, home, away, hGoals, aGoals, hAssists, aAssists, hBps, aBps, awards, hDefcon, aDefcon }) => (
          <div
            key={f.id}
            className="rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm"
          >
            <div
              className="p-4 border-b border-zinc-200"
              style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.95), rgba(255,255,255,0.95)), url(/assets/pitch-bg.png)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShirtBadge teamCode={home?.code} short={home?.short} />
                  <div>
                    <div className="font-semibold">{home?.name}</div>
                    <div className="text-xs text-zinc-500">{home?.short}</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-xs px-2 py-0.5 rounded ${f.finished ? 'bg-green-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                    {f.finished ? 'Completed' : f.started ? 'Live' : 'Upcoming'}
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {f.team_h_score ?? '-'} <span className="text-zinc-400">:</span> {f.team_a_score ?? '-'}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="font-semibold">{away?.name}</div>
                    <div className="text-xs text-zinc-500">{away?.short}</div>
                  </div>
                  <ShirtBadge teamCode={away?.code} short={away?.short} />
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Scorers/Assisters with center divider */}
              <div className="grid grid-cols-3 items-start gap-3 text-sm">
                <div className="text-right space-y-1">
                  {hGoals.map((g: any, i: number) => (
                    <div key={`hg-${g.id}-${i}`}>{name(g.id)} <span className="ml-1">⚽×{g.n}</span></div>
                  ))}
                  {hAssists.map((a: any, i: number) => (
                    <div key={`ha-${a.id}-${i}`} className="text-sky-700">{name(a.id)} <span className="ml-1">🅰️×{a.n}</span></div>
                  ))}
                </div>
                <div className="h-full w-px bg-zinc-300 mx-auto" />
                <div className="space-y-1">
                  {aGoals.map((g: any, i: number) => (
                    <div key={`ag-${g.id}-${i}`}>{name(g.id)} <span className="ml-1">⚽×{g.n}</span></div>
                  ))}
                  {aAssists.map((a: any, i: number) => (
                    <div key={`aa-${a.id}-${i}`} className="text-sky-700">{name(a.id)} <span className="ml-1">🅰️×{a.n}</span></div>
                  ))}
                </div>
              </div>

              {/* BPS & DEFCON */}
              <details className="mt-2 bg-zinc-50 rounded-md p-3 border border-zinc-200" open>
                <summary className="cursor-pointer text-center text-sm font-medium">BPS & DEFCON</summary>
                <div className="mt-3 space-y-4">
                  {/* Bonus Row */}
                  <div>
                    <div className="font-semibold mb-1 text-center">Bonus (BPS)</div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-center">
                      <div>
                        <div className="text-s text-zinc-500 mb-1">{home?.short}</div>
                        {hBps.slice(0,6).map((x: any) => (
                          <div key={`hb-${x.id}`}>{name(x.id)} {awards[x.id] && <span className="ml-1">{awards[x.id]}</span>} <span className="text-zinc-500">({x.bps})</span></div>
                        ))}
                      </div>
                      <div>
                        <div className="text-s text-zinc-500 mb-1">{away?.short}</div>
                        {aBps.slice(0,6).map((x: any) => (
                          <div key={`ab-${x.id}`}>{name(x.id)} {awards[x.id] && <span className="ml-1">{awards[x.id]}</span>} <span className="text-zinc-500">({x.bps})</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Defcon Row */}
                  <div>
                    <div className="font-semibold mb-1 text-center">Defcon (DEF)</div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-center">
                      <div>
                        <div className="text-s text-zinc-500 mb-1">{home?.short}</div>
                        {hDefcon.slice(0,6).map((x: any) => (
                          <div key={`hd-${x.id}`}>{name(x.id)} <span className="text-zinc-500">({x.v})</span></div>
                        ))}
                      </div>
                      <div>
                        <div className="text-s text-zinc-500 mb-1">{away?.short}</div>
                        {aDefcon.slice(0,6).map((x: any) => (
                          <div key={`ad-${x.id}`}>{name(x.id)} <span className="text-zinc-500">({x.v})</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
