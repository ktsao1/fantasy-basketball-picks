"use client";
// A tiny localStorage-backed store for React (useSyncExternalStore), with an
// in-memory fallback when storage is blocked. Renders `fallback` on the server.
import { useSyncExternalStore } from "react";

export function createLocalStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let memory: string | null = null;
  let cachedRaw: string | null = null;
  let cachedValue: T = fallback;

  function readRaw(): string | null {
    try {
      return localStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  }

  function get(): T {
    const raw = readRaw();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cachedValue = raw == null ? fallback : (JSON.parse(raw) as T);
      } catch {
        cachedValue = fallback;
      }
    }
    return cachedValue;
  }

  function set(value: T) {
    memory = JSON.stringify(value);
    try {
      localStorage.setItem(key, memory);
    } catch {
      /* blocked or full: `memory` holds it until reload */
    }
    listeners.forEach((l) => l());
  }

  function subscribe(fn: () => void) {
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => e.key === key && fn(); // other tabs
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, get, () => fallback);
  }

  return { get, set, useValue };
}
