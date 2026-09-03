"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/hooks/useAccounts";
import {
  SHARE_PATH,
  ShareAccount,
  decryptPayload,
  parseShareFragment,
} from "@/lib/share";

const noopSubscribe = () => () => {};

export default function ImportPage() {
  const router = useRouter();
  const { accounts, upsertAccounts } = useAccounts();

  // fragment 只在首次 render 讀一次，之後就從網址列清掉
  const [fragment] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash.slice(1)
  );
  // SSR 與 hydration 都先畫「讀取中」，避免 server/client 初始狀態不一致
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (window.location.hash) {
      history.replaceState(null, "", SHARE_PATH);
    }
  }, []);

  const envelope = useMemo(() => parseShareFragment(fragment), [fragment]);

  const [decrypted, setDecrypted] = useState<ShareAccount[] | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ added: number; updated: number } | null>(null);

  const pending: ShareAccount[] | null =
    envelope && !envelope.enc ? envelope.accounts : decrypted;

  const existingUsernames = useMemo(
    () => new Set(accounts.map((a) => a.username)),
    [accounts]
  );

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!envelope || !envelope.enc) return;
    setIsDecrypting(true);
    setDecryptError(null);
    try {
      setDecrypted(await decryptPayload(envelope, passphrase));
    } catch (error) {
      setDecryptError(error instanceof Error ? error.message : "解密失敗");
    } finally {
      setIsDecrypting(false);
    }
  };

  const toggleExcluded = (username: string) => {
    const next = new Set(excluded);
    if (next.has(username)) {
      next.delete(username);
    } else {
      next.add(username);
    }
    setExcluded(next);
  };

  const handleImport = () => {
    if (!pending) return;
    const items = pending
      .filter((a) => !excluded.has(a.u))
      .map((a) => ({ username: a.u, password: a.p, label: a.l }));
    setResult(upsertAccounts(items));
  };

  const selectedCount = pending ? pending.filter((a) => !excluded.has(a.u)).length : 0;

  const inputClass =
    "w-full rounded-lg border border-zinc-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white";
  const primaryButtonClass =
    "w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400";
  const secondaryButtonClass =
    "w-full rounded-lg bg-zinc-200 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500";

  let content: React.ReactNode;

  if (!hydrated) {
    content = <p className="text-center text-zinc-500">讀取中...</p>;
  } else if (!envelope) {
    content = (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
          這不是有效的分享連結，可能已損毀或來自不支援的版本。請對方重新分享。
        </div>
        <button type="button" onClick={() => router.push("/")} className={secondaryButtonClass}>
          回首頁
        </button>
      </div>
    );
  } else if (result) {
    content = (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900 dark:text-green-200">
          已新增 {result.added} 個、更新 {result.updated} 個帳號
        </div>
        <button type="button" onClick={() => router.push("/")} className={primaryButtonClass}>
          回首頁開始點名
        </button>
      </div>
    );
  } else if (!pending) {
    content = (
      <form onSubmit={handleDecrypt} className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          這個分享連結有加密，請輸入分享者告訴你的密碼。
        </p>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className={inputClass}
          placeholder="分享密碼"
          autoFocus
          required
        />
        {decryptError && (
          <p className="text-sm text-red-600 dark:text-red-400">{decryptError}</p>
        )}
        <button type="submit" disabled={isDecrypting || !passphrase} className={primaryButtonClass}>
          {isDecrypting ? "解密中..." : "解鎖"}
        </button>
        <button type="button" onClick={() => router.push("/")} className={secondaryButtonClass}>
          取消
        </button>
      </form>
    );
  } else {
    content = (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          確認要匯入的帳號。同學號的帳號會更新密碼與別名。
        </p>
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          {pending.map((account) => {
            const isUpdate = existingUsernames.has(account.u);
            return (
              <label
                key={account.u}
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
              >
                <input
                  type="checkbox"
                  checked={!excluded.has(account.u)}
                  onChange={() => toggleExcluded(account.u)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-900 dark:text-white">
                    {account.l || account.u}
                  </span>
                  {account.l && (
                    <span className="block truncate text-xs text-zinc-500">{account.u}</span>
                  )}
                </span>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs ${
                    isUpdate
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  }`}
                >
                  {isUpdate ? "更新" : "新增"}
                </span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleImport}
          disabled={selectedCount === 0}
          className={primaryButtonClass}
        >
          匯入 {selectedCount} 個帳號
        </button>
        <button type="button" onClick={() => router.push("/")} className={secondaryButtonClass}>
          取消
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-900">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-white">
          匯入帳號
        </h1>
        {content}
      </main>
    </div>
  );
}
