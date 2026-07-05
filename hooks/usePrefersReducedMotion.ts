"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Tracks the user's `prefers-reduced-motion` OS setting (SSR-safe). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false // server snapshot: assume motion allowed
  );
}
