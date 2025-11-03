// src/store/fplStore.ts
import { create } from "zustand";
import type {
  Bootstrap,
  Event,
  Fixture,
  LiveIndex,
  PlayerIndex,
  EntryEventPicks,
} from "../types/fpl.types";

interface FPLState {
  teamId: number | null;
  setTeamId: (id: number) => void;
  picks?: EntryEventPicks;
  setPicks: (p: EntryEventPicks) => void;
  bootstrap?: Bootstrap;
  currentEvent?: Event;
  players?: PlayerIndex;
  live?: LiveIndex;
  fixtures?: Fixture[];
  loading: boolean;
  error?: string;

  setBootstrap: (b: Bootstrap, current: Event, players: PlayerIndex) => void;
  setLive: (l: LiveIndex) => void;
  setFixtures: (f: Fixture[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e?: string) => void;
}

export const useFPLStore = create<FPLState>((set) => ({
  loading: false,
  setBootstrap: (bootstrap, currentEvent, players) =>
    set({ bootstrap, currentEvent, players }),
  setLive: (live) => set({ live }),
  setFixtures: (fixtures) => set({ fixtures }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  teamId: null,
  setTeamId: (id) => set({ teamId: id }),
  picks: undefined,
  setPicks: (p) => set({ picks: p }),
}));
