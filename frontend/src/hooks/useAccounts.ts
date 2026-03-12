"use client";

import { useState, useCallback, useEffect } from "react";

export interface Account {
  id: string;
  username: string;
  password: string;
  label?: string; // 可選的帳號別名
}

const STORAGE_KEY = "nkust_accounts";

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // client 端才從 localStorage 載入，避免 hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAccounts(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
    }
    setIsLoaded(true);
  }, []);

  // 儲存帳號到 localStorage
  const saveAccounts = useCallback((newAccounts: Account[]) => {
    setAccounts(newAccounts);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAccounts));
    }
  }, []);

  // 新增帳號
  const addAccount = useCallback(
    (username: string, password: string, label?: string) => {
      const newAccount: Account = {
        id: crypto.randomUUID(),
        username,
        password,
        label,
      };
      saveAccounts([...accounts, newAccount]);
      return newAccount;
    },
    [accounts, saveAccounts]
  );

  // 更新帳號
  const updateAccount = useCallback(
    (id: string, updates: Partial<Omit<Account, "id">>) => {
      const newAccounts = accounts.map((acc) =>
        acc.id === id ? { ...acc, ...updates } : acc
      );
      saveAccounts(newAccounts);
    },
    [accounts, saveAccounts]
  );

  // 刪除帳號
  const removeAccount = useCallback(
    (id: string) => {
      const newAccounts = accounts.filter((acc) => acc.id !== id);
      saveAccounts(newAccounts);
    },
    [accounts, saveAccounts]
  );

  // 清除所有帳號
  const clearAccounts = useCallback(() => {
    saveAccounts([]);
  }, [saveAccounts]);

  return {
    accounts,
    isLoaded,
    addAccount,
    updateAccount,
    removeAccount,
    clearAccounts,
  };
}
