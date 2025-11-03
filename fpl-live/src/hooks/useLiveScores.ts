// src/hooks/useLiveScores.ts
import { useCallback, useEffect, useRef } from "react";
import { getLive } from "../services/fplApi";
import { useFPLStore } from "../store/fplStore";

interface Options {
  intervalMs?: number; // polling frequency (default 30s)
}

export function useLiveScores(options: Options = {}) {
  const { currentEvent, setLive, setError } = useFPLStore();
  const intervalMs = options.intervalMs ?? 30000;

  // refs to persist values across renders
  const backoffRef = useRef(0);
  const isActiveRef = useRef(true);

  const poll = useCallback(async () => {
    if (!currentEvent?.id) return;
    try {
      const liveRes = await getLive(currentEvent.id);

      // Convert array to { [playerId]: stats } for faster lookup
      const liveIndex = liveRes.elements.reduce((acc: any, el) => {
        acc[el.id] = el.stats;
        return acc;
      }, {});

      setLive(liveIndex);
      backoffRef.current = 0; // reset backoff after success
    } catch (e: any) {
      console.error("Live fetch failed:", e);
      setError(e?.message ?? "Live fetch failed");
      // exponential backoff (max 4x delay)
      backoffRef.current = Math.min(backoffRef.current + 1, 4);
    }
  }, [currentEvent?.id, setLive, setError]);

  useEffect(() => {
    if (!currentEvent?.id) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // polling loop
    (async function loop() {
      while (isActiveRef.current) {
        await poll();
        const delay = intervalMs * Math.pow(2, backoffRef.current);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    })();

    return () => {
      isActiveRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [poll, intervalMs, currentEvent?.id]);
}

