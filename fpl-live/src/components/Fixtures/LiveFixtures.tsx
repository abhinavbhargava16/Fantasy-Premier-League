import { useEffect, useMemo, useRef, useState } from 'react';
import { useFPLStore } from '../../store/fplStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLive } from '../../services/fplApi';

function ShirtBadge({ teamCode, short }: { teamCode?: number; short?: string }) {
  const code = teamCode ?? 0;
  return (
    <img
      src={`/assets/badges/${code}.png`}
      alt={short ?? ''}
      loading="lazy"
      decoding="async"
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

  const [activeGw, setActiveGw] = useState<number | undefined>(undefined);
  const [localLive, setLocalLive] = useState<Record<number, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingGwRef = useRef<number | null>(null);
  const [pendingGw, setPendingGw] = useState<number | null>(null);
  const cacheRef = useRef<Record<number, Record<number, any> | null>>({});
  const seqRef = useRef(0);
  const timingsRef = useRef<{ start?: number; fetchEnd?: number; applied?: number }>({});

  const MIN_SPINNER_MS = 400;
  const SETTLE_MS = 80;
  const PAST_GW_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
  const PREFETCH_COUNT = 3; // prefetch last N GWs in background

  const cacheKey = (gw: number) => `live:gw:${gw}`;
  const sessionGet = (gw: number) => {
    try {
      const raw = sessionStorage.getItem(cacheKey(gw));
      if (!raw) return null;
      const obj = JSON.parse(raw) as { t: number; data: Record<number, any> };
      return obj;
    } catch { return null; }
  };
  const sessionSet = (gw: number, data: Record<number, any>) => {
    try { sessionStorage.setItem(cacheKey(gw), JSON.stringify({ t: Date.now(), data })); } catch {}
  };
  const sessionValid = (gw: number, now: number, currentGw?: number) => {
    const obj = sessionGet(gw);
    if (!obj) return null;
    // Never trust cache for current (live) gw
    if (currentGw && gw === currentGw) return null;
    if (now - obj.t > PAST_GW_CACHE_TTL_MS) return null;
    return obj.data;
  };
  const ensureMinDelay = async (startedAt: number) => {
    const elapsed = performance.now() - startedAt;
    const remain = Math.max(0, MIN_SPINNER_MS - elapsed);
    if (remain > 0) await new Promise((r) => setTimeout(r, remain));
  };
  const afterApplySettle = async () => {
    // allow the DOM to commit and paint before re-enabling UI
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, SETTLE_MS));
  };

  useEffect(() => {
    if (currentGw && activeGw === undefined) setActiveGw(currentGw);
  }, [currentGw, activeGw]);

  useEffect(() => {
    if (!activeGw) return;
    // Restrict to current or earlier GWs
    if (!currentGw || activeGw > currentGw) { setLocalLive(null); setLoading(false); setPendingGw(null); return; }

    // Current GW: use store live immediately
    if (activeGw === currentGw && live) {
      // keep a tiny settle to avoid UI unlock before paint if we were loading
      const wasLoading = loading || pendingGw !== null;
      setLocalLive(live as any);
      if (wasLoading) {
        (async () => {
          await afterApplySettle();
          setLoading(false);
          setPendingGw(null);
        })();
      }
      return;
    }

    // Use cache if available (in-memory first, then session)
    const cached = cacheRef.current[activeGw];
    if (cached) { setLocalLive(cached); setLoading(false); setPendingGw(null); return; }
    const ss = sessionValid(activeGw, performance.now(), currentGw);
    if (ss) { cacheRef.current[activeGw] = ss; setLocalLive(ss); setLoading(false); setPendingGw(null); return; }

    // Start a new fetch sequence
    const mySeq = ++seqRef.current;
    pendingGwRef.current = activeGw;
    setPendingGw(activeGw);
    setLoading(true);
    timingsRef.current.start = performance.now();

    let cancelled = false;
    (async () => {
      try {
        const l = await getLive(activeGw);
        if (cancelled) return;
        // Ignore if a newer request started
        if (mySeq !== seqRef.current) return;
        timingsRef.current.fetchEnd = performance.now();
        const idx = l.elements.reduce((acc: any, el: any) => { acc[el.id] = el.stats; return acc; }, {} as Record<number, any>);
        cacheRef.current[activeGw] = idx;
        // persist only past GWs
        if (currentGw && activeGw < currentGw) sessionSet(activeGw, idx);
        setLocalLive(idx);
        timingsRef.current.applied = performance.now();
        // Prefetch neighbors (best-effort)
        const neighbors = [activeGw - 1, activeGw + 1]
          .filter((g) => g >= 1 && currentGw && g <= currentGw) as number[];
        for (const g of neighbors) {
          if (cacheRef.current[g] === undefined) {
            // fire and forget
            getLive(g).then((l2: any) => {
              const idx2 = l2.elements.reduce((acc: any, el: any) => { acc[el.id] = el.stats; return acc; }, {} as Record<number, any>);
              cacheRef.current[g] = idx2;
              if (currentGw && g < currentGw) sessionSet(g, idx2);
            }).catch(() => { cacheRef.current[g] = null; });
          }
        }
      } catch {
        if (mySeq !== seqRef.current) return;
        cacheRef.current[activeGw] = null;
        setLocalLive(null);
      } finally {
        if (cancelled) return;
        if (mySeq === seqRef.current) {
          // Ensure loader stays for a minimum duration, then allow UI settle
          const startedAt = timingsRef.current.start ?? performance.now();
          await ensureMinDelay(startedAt);
          await afterApplySettle();
          pendingGwRef.current = null;
          setPendingGw(null);
          setLoading(false);
          // Instrumentation
          const t0 = timingsRef.current.start ?? 0;
          const t1 = timingsRef.current.fetchEnd ?? t0;
          const t2 = timingsRef.current.applied ?? t1;
          // eslint-disable-next-line no-console
          console.log(`[LiveFixtures] GW ${activeGw} fetch=${(t1 - t0).toFixed(0)}ms, build=${(t2 - t1).toFixed(0)}ms`);
        }
      }
    })();
    return () => { cancelled = true };
  }, [activeGw, currentGw, live]);

  // Background prefetch last few past GWs on idle to reduce next navigation latency
  useEffect(() => {
    if (!currentGw) return;
    const ids = Array.from({ length: PREFETCH_COUNT }, (_, i) => currentGw - (i + 1)).filter((g) => g >= 1);
    if (ids.length === 0) return;
    const doPrefetch = () => {
      let idx = 0;
      const LIMIT = 2; // light concurrency
      const worker = async () => {
        while (idx < ids.length) {
          const i = idx++;
          const gw = ids[i];
          if (cacheRef.current[gw] || sessionValid(gw, performance.now(), currentGw)) continue;
          try {
            const l = await getLive(gw);
            const map = l.elements.reduce((acc: any, el: any) => { acc[el.id] = el.stats; return acc; }, {} as Record<number, any>);
            cacheRef.current[gw] = map;
            sessionSet(gw, map);
          } catch {
            cacheRef.current[gw] = null;
          }
        }
      };
      Promise.all(new Array(Math.min(LIMIT, ids.length)).fill(0).map(() => worker()));
    };
    // Prefer idle time when available
    const ric = (window as any).requestIdleCallback as undefined | ((cb: Function, opts?: any) => number);
    let idleId: number | undefined;
    if (ric) idleId = ric(() => doPrefetch(), { timeout: 2000 }) as any;
    else setTimeout(doPrefetch, 500);
    return () => { if (idleId && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(idleId); };
  }, [currentGw]);
  const teamMeta = useMemo(() => {
    const idx: Record<number, { short: string; name: string; code: number }> = {};
    teams.forEach((t: any) => (idx[t.id] = { short: t.short_name, name: t.name, code: t.code }));
    return idx;
  }, [teams]);

  const byFixture = useMemo(() => {
    if (!players || !activeGw) return [] as any[];
    const gwFixtures = (fixtures ?? []).filter((f) => f.event === activeGw);
    const statsSource = localLive ?? (activeGw === currentGw ? (live as any) : null);
    // Build team -> elementIds mapping
    const teamToEls: Record<number, number[]> = {};
    Object.values(players).forEach((p) => {
      (teamToEls[p.team] ||= []).push(p.id);
    });
    return gwFixtures.map((f) => {
      const homeEls = (teamToEls[f.team_h] ?? []).filter((id) => !!(statsSource?.[id]));
      const awayEls = (teamToEls[f.team_a] ?? []).filter((id) => !!(statsSource?.[id]));
      const statsFor = (els: number[]) => (statsSource ? els.map((id) => ({ id, s: statsSource[id]! })) : []);

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
      <div className="mb-4 flex items-center justify-between">
        <div className="text-2xl font-semibold text-white">Gameweek {activeGw ?? '—'}</div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveGw((g) => (g ? Math.max(1, g - 1) : g))}
            disabled={loading || pendingGw !== null || !activeGw || activeGw <= 1}
            className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
            aria-label="Previous gameweek"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setActiveGw((g) => (g && currentGw ? Math.min(currentGw, g + 1) : g))}
            disabled={loading || pendingGw !== null || !activeGw || !currentGw || activeGw >= currentGw}
            className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40"
            aria-label="Next gameweek"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="relative">
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
              <details className="mt-2 bg-zinc-50 rounded-md p-3 border border-zinc-200">
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
        {(loading || pendingGw !== null) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/80 text-zinc-700 shadow border border-zinc-200">
              <div className="h-5 w-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
              <span className="text-sm">Updating gameweek…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
