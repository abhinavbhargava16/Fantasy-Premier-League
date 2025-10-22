// src/store/fplStore.ts
import { create } from "zustand";
import type {
  Bootstrap,
  Event,
  Fixture,
  LiveIndex,
  PlayerIndex,
} from "../types/fpl.types";

interface FPLState {
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
}));
