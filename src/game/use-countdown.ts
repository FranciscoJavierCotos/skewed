"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Per-question countdown. Restarts whenever `resetKey` (or `seconds`) changes and calls
 * `onExpire` exactly once when it reaches zero. Inert (returns null) when `seconds` is null.
 */
export function useCountdown(seconds: number | null, resetKey: string, onExpire: () => void): number | null {
  const [tick, setTick] = useState({ key: resetKey, seconds, remaining: seconds });
  const expire = useRef(onExpire);
  useEffect(() => { expire.current = onExpire; });

  // Reset during render when the question changes, so the new value is visible immediately.
  let current = tick;
  if (tick.key !== resetKey || tick.seconds !== seconds) {
    current = { key: resetKey, seconds, remaining: seconds };
    setTick(current);
  }

  useEffect(() => {
    if (seconds === null) return;
    const deadline = Date.now() + seconds * 1000;
    let fired = false;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTick((t) => (t.key === resetKey ? { ...t, remaining: left } : t));
      if (left === 0 && !fired) { fired = true; clearInterval(id); expire.current(); }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, resetKey]);

  return seconds === null ? null : current.remaining;
}
