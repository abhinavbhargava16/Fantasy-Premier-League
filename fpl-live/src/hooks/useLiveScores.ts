// src/hooks/useLiveScores.ts
import { useCallback, useEffect, useRef } from "react";
import { getLive } from "../services/fplApi";
import { useFPLStore } from "../store/fplStore";

interface Options {
  intervalMs?: number;
}

export function useLiveScores(options: Options = {}) {
  const { currentEvent, setLive, setError } = useFPLStore();
  const intervalMs = options.intervalMs ?? 30000;
  const timerRef = useRef<number | null>(null);
  const backoffRef = useRef(0);

  const poll = useCallback(async () => {
    if (!currentEvent?.id) return;
    try {
      const liveRes = await getLive(currentEvent.id);
      const liveIndex = liveRes.elements.reduce((acc: any, el) => {
        acc[el.id] = el.stats;
        return acc;
      }, {});
      setLive(liveIndex);
      backoffRef.current = 0; // reset backoff on success
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Live fetch failed");
      // exponential backoff up to 4x
      backoffRef.current = Math.min(backoffRef.current + 1, 4);
    }
  }, [currentEvent?.id, setLive, setError]);

  useEffect(() => {
    let active = true;
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    async function loop() {
      while (active) {
        await poll();
        const backoff = Math.pow(2, backoffRef.current);
        await new Promise((r) => setTimeout(r, intervalMs * backoff));
      }
    }
    loop();

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", visibilityHandler);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [poll, intervalMs]);
}
