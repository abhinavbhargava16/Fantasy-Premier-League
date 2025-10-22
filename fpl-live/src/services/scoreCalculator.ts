// src/services/scoreCalculator.ts
import type {
  EntryEventPicks,
  LiveIndex,
  PlayerIndex,
  Pick,
} from "../types/fpl.types";

export interface CalculatedPoints {
  totalOnField: number;
  benchTotal: number;
  captainId?: number;
  viceCaptainId?: number;
  appliedChip?: EntryEventPicks["active_chip"];
  breakdown: Array<{
    element: number;
    points: number;
    onBench: boolean;
    isC?: boolean;
    isVC?: boolean;
  }>;
}

/**
 * Calculate FPL points with captaincy, vice fallback, and simple autosubs.
 * Notes:
 * - This covers the common autosub cases: if a starting XI player has 0 minutes, swap the first available bench in order (GKP isolated).
 * - Bench Boost & Free Hit handled via multipliers and position rules; Triple Captain doubles captain multiplier.
 * - Bonus points: we use whatever is present in live stats (final) and ignore provisional edge cases here.
 */

export function calculatePoints(
  picks: EntryEventPicks,
  live: LiveIndex,
  players: PlayerIndex
): CalculatedPoints {
  const activeChip = picks.active_chip;
  const isBenchBoost = activeChip === "bboost";
  const isTripleC = activeChip === "3xc";

  // Separate starters (positions 1..11) and bench (12..15). Position 12 is sub1, 13 sub2, 14 sub3, 15 is bench GK.
  const starters: Pick[] = picks.picks
    .filter((p) => p.position <= 11)
    .sort((a, b) => a.position - b.position);
  const bench: Pick[] = picks.picks
    .filter((p) => p.position > 11)
    .sort((a, b) => a.position - b.position);

  let captain = starters.find((p) => p.is_captain);
  let vice = starters.find((p) => p.is_vice_captain);

  // Build mutable array for autosubs
  const finalXI: Pick[] = starters.map((p) => ({ ...p }));

  // Identify zero-minute starters
  const zeroMinuteIdxs = finalXI
    .map((p, idx) => ({
      idx,
      min: live[p.element]?.minutes ?? 0,
      element: p.element,
    }))
    .filter((x) => (x.min ?? 0) === 0);

  // Goalkeeper lanes: Starting GK is the one with element_type 1 among starters.
  const isGK = (elementId: number) => players[elementId]?.element_type === 1;

  // Bench order: outfield (12,13,14), GK (15). Autosubs preserve GK isolation rule.
  const benchOutfield = bench.filter((b) => !isGK(b.element));
  const benchGk = bench.find((b) => isGK(b.element));

  // Fill each zero-minute starter with first eligible bench who has >0 minutes and same positional constraints (GK for GK only)
  for (const missing of zeroMinuteIdxs) {
    const wasGK = isGK(missing.element);
    let replacement: Pick | undefined;

    if (wasGK) {
      if (benchGk && (live[benchGk.element]?.minutes ?? 0) > 0) {
        replacement = benchGk;
      }
    } else {
      replacement = benchOutfield.find(
        (b) => (live[b.element]?.minutes ?? 0) > 0
      );
      if (replacement) {
        // remove from benchOutfield so it's used only once
        const i = benchOutfield.findIndex(
          (b) => b.element === replacement!.element
        );
        benchOutfield.splice(i, 1);
      }
    }

    if (replacement) {
      finalXI[missing.idx] = {
        ...replacement,
        position: missing.idx + 1,
        is_captain: false, // bench can't be captain in autosub
        is_vice_captain: false,
        multiplier: 1,
      };
    }
  }
  // If captain minutes = 0, vice takes armband
  if (
    captain &&
    (live[captain.element]?.minutes ?? 0) === 0 &&
    vice &&
    (live[vice.element]?.minutes ?? 0) > 0
  ) {
    // Update captain flags in finalXI
    const cIdx = finalXI.findIndex((p) => p.element === captain!.element);
    const vIdx = finalXI.findIndex((p) => p.element === vice!.element);
    if (cIdx >= 0) finalXI[cIdx].is_captain = false;
    if (vIdx >= 0) finalXI[vIdx].is_captain = true;
    captain = finalXI[vIdx];
  }

  // Compute points for on-field
  const breakdown: CalculatedPoints["breakdown"] = [];
  let totalOnField = 0;

  for (const p of finalXI) {
    const stats = live[p.element];
    const base = stats?.total_points ?? 0;

    let mult = p.multiplier;
    // If this pick became captain in finalXI, force multiplier accordingly
    if (p.is_captain) mult = 2;
    if (isTripleC && p.is_captain) mult = 3;

    const pts = base * mult;
    totalOnField += pts;
    breakdown.push({
      element: p.element,
      points: pts,
      onBench: false,
      isC: !!p.is_captain,
      isVC: !!p.is_vice_captain,
    });
  }
  // Bench points (only if Bench Boost chip active)
  let benchTotal = 0;
  if (isBenchBoost) {
    for (const b of bench) {
      const pts = live[b.element]?.total_points ?? 0;
      benchTotal += pts;
      breakdown.push({
        element: b.element,
        points: pts,
        onBench: true,
        isC: false,
        isVC: false,
      });
    }
  }

  return {
    totalOnField,
    benchTotal,
    captainId: finalXI.find((p) => p.is_captain)?.element,
    viceCaptainId: finalXI.find((p) => p.is_vice_captain)?.element,
    appliedChip: activeChip,
    breakdown,
  };
}
