"use client";
import { useEffect, useState } from "react";

/** Reloj que tictaquea (para cronómetros en vivo). Devuelve Date.now() en ms. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
