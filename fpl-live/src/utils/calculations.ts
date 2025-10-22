// src/utils/calculations.ts
import type { Element, PlayerIndex } from "../types/fpl.types";

export function toPlayerIndex(elements: Element[]): PlayerIndex {
  return elements.reduce<PlayerIndex>((acc, el) => {
    acc[el.id] = el;
    return acc;
  }, {});
}

export function pointsPerMillion(points: number, now_cost: number): number {
  // now_cost is in £0.1m
  const price = now_cost / 10;
  return price > 0 ? +(points / price).toFixed(2) : 0;
}

export function arrowClass(delta: number): string {
  return delta > 0
    ? "text-green-500"
    : delta < 0
      ? "text-red-500"
      : "text-zinc-400";
}
