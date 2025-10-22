// src/hooks/useFPLData.ts
import { useEffect } from "react";
import { getBootstrap, getFixtures } from "../services/fplApi";
import { useFPLStore } from "../store/fplStore";
import { toPlayerIndex } from "../utils/calculations";

export function useBootstrap() {
  const { setBootstrap, setFixtures, setLoading, setError } = useFPLStore();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [b, fixtures] = await Promise.all([
          getBootstrap(),
          getFixtures(),
        ]);
        const current =
          b.events.find((e) => e.is_current) ||
          b.events.find((e) => e.is_next) ||
          b.events[0];
        const players = toPlayerIndex(b.elements);
        setBootstrap(b, current!, players);
        setFixtures(fixtures);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Failed to load FPL data");
      } finally {
        setLoading(false);
      }
    })();
  }, [setBootstrap, setFixtures, setLoading, setError]);
}
