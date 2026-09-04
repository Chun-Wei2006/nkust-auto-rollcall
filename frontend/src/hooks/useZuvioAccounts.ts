"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Coordinates } from "@/lib/zuvio";

// Zuvio 帳號與高科大帳號分開儲存，欄位與用途都不同
export interface ZuvioAccount {
  id: string;
  email: string;
  password: string;
  label?: string;
  courseId?: string; // 要監控的課程；未設定代表全部
}

const ACCOUNTS_KEY = "zuvio_accounts";
const LOCATION_KEY = "zuvio_location";
const MODE_KEY = "rollcall_mode";

export type RollcallMode = "nkust" | "zuvio";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch (error) {
    console.error(`Failed to load ${key}:`, error);
  }
  return fallback;
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// 與 useAccounts 相同的 useSyncExternalStore 模式，避免 hydration mismatch
function createStore<T>(key: string, initial: T, migrate?: (value: T) => T) {
  const loaded = readJson<T>(key, initial);
  let cached = migrate && loaded !== initial ? migrate(loaded) : loaded;
  const listeners = new Set<() => void>();
  return {
    subscribe(callback: () => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    get: () => cached,
    getServer: () => initial,
    set(value: T) {
      cached = value;
      writeJson(key, value);
      for (const listener of listeners) listener();
    },
  };
}

const EMPTY_ACCOUNTS: ZuvioAccount[] = [];
const accountsStore = createStore<ZuvioAccount[]>(ACCOUNTS_KEY, EMPTY_ACCOUNTS, (raw) =>
  // 早期版本存的是多選的 courseIds，只保留第一個
  raw.map((acc) => {
    const { courseIds, ...rest } = acc as ZuvioAccount & { courseIds?: string[] };
    return courseIds?.length === 1 ? { ...rest, courseId: courseIds[0] } : rest;
  })
);
const locationStore = createStore<Coordinates | null>(LOCATION_KEY, null);
const modeStore = createStore<RollcallMode>(MODE_KEY, "nkust");

export function useZuvioAccounts() {
  const accounts = useSyncExternalStore(
    accountsStore.subscribe,
    accountsStore.get,
    accountsStore.getServer
  );

  const addAccount = useCallback(
    (email: string, password: string, label?: string) => {
      const account: ZuvioAccount = { id: crypto.randomUUID(), email, password, label };
      accountsStore.set([...accountsStore.get(), account]);
      return account;
    },
    []
  );

  const updateAccount = useCallback((id: string, updates: Partial<Omit<ZuvioAccount, "id">>) => {
    accountsStore.set(
      accountsStore.get().map((acc) => (acc.id === id ? { ...acc, ...updates } : acc))
    );
  }, []);

  const removeAccount = useCallback((id: string) => {
    accountsStore.set(accountsStore.get().filter((acc) => acc.id !== id));
  }, []);

  const clearAccounts = useCallback(() => {
    accountsStore.set([]);
  }, []);

  return { accounts, addAccount, updateAccount, removeAccount, clearAccounts };
}

export function useZuvioLocation() {
  const location = useSyncExternalStore(
    locationStore.subscribe,
    locationStore.get,
    locationStore.getServer
  );
  const setLocation = useCallback((coords: Coordinates | null) => {
    locationStore.set(coords);
  }, []);
  return { location, setLocation };
}

// 首頁的點名模式（高科大 QR / Zuvio GPS），記住上次選擇
export function useRollcallMode() {
  const mode = useSyncExternalStore(modeStore.subscribe, modeStore.get, modeStore.getServer);
  const setMode = useCallback((next: RollcallMode) => {
    modeStore.set(next);
  }, []);
  return { mode, setMode };
}
