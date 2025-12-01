"use client";

import { useState } from "react";
import QrScanner from "@/components/QrScanner";
import AccountManager from "@/components/AccountManager";
import { useAccounts, Account } from "@/hooks/useAccounts";

interface RollcallResult {
  accountId: string;
  accountLabel: string;
  success: boolean;
  message: string;
}

export default function Home() {
  const { accounts, isLoaded, addAccount, updateAccount, removeAccount, clearAccounts } =
    useAccounts();

  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [rollcallGoto, setRollcallGoto] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<RollcallResult[]>([]);
  const [showAccountManager, setShowAccountManager] = useState(false);

  // 手動輸入的單一帳號（用於未儲存帳號時的點名）
  const [manualUsername, setManualUsername] = useState("");
  const [manualPassword, setManualPassword] = useState("");

  const extractGotoParam = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("goto");
    } catch {
      const match = url.match(/goto=([^&]+)/);
      return match ? match[1] : null;
    }
  };

  const handleScan = (data: string) => {
    const gotoParam = extractGotoParam(data);
    if (gotoParam) {
      setRollcallGoto(gotoParam);
      setShowScanner(false);
    }
  };

  const toggleAccountSelection = (id: string) => {
    const newSelection = new Set(selectedAccountIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedAccountIds(newSelection);
  };

  const selectAllAccounts = () => {
    if (selectedAccountIds.size === accounts.length) {
      setSelectedAccountIds(new Set());
    } else {
      setSelectedAccountIds(new Set(accounts.map((a) => a.id)));
    }
  };

  const performRollcall = async (account: Account): Promise<RollcallResult> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/rollcall/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: account.username,
          password: account.password,
          rollcall_goto: rollcallGoto,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          accountId: account.id,
          accountLabel: account.label || account.username,
          success: true,
          message: data.message || "點名成功",
        };
      } else {
        const error = await response.json();
        return {
          accountId: account.id,
          accountLabel: account.label || account.username,
          success: false,
          message: error.detail || "點名失敗",
        };
      }
    } catch {
      return {
        accountId: account.id,
        accountLabel: account.label || account.username,
        success: false,
        message: "無法連接伺服器",
      };
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAccountIds.size === 0) return;

    setIsLoading(true);
    setResults([]);

    const selectedAccounts = accounts.filter((a) => selectedAccountIds.has(a.id));

    // 並行執行所有點名請求
    const rollcallPromises = selectedAccounts.map((account) => performRollcall(account));
    const rollcallResults = await Promise.all(rollcallPromises);

    setResults(rollcallResults);
    setIsLoading(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResults([]);

    const tempAccount: Account = {
      id: "manual",
      username: manualUsername,
      password: manualPassword,
    };

    const result = await performRollcall(tempAccount);
    setResults([result]);
    setIsLoading(false);
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-500">載入中...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-900">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-white">
          NKUST 自動點名
        </h1>

        {showScanner ? (
          <div className="mb-6">
            <QrScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rollcall Goto 輸入區 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Rollcall Goto
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rollcallGoto}
                  onChange={(e) => setRollcallGoto(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                  placeholder="掃描 QR Code 或手動輸入"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="rounded-lg bg-zinc-200 px-4 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
                >
                  掃描
                </button>
              </div>
            </div>

            {/* 帳號管理區 */}
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setShowAccountManager(!showAccountManager)}
                className="mb-3 flex w-full items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                <span>帳號管理</span>
                <svg
                  className={`h-5 w-5 transition-transform ${showAccountManager ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAccountManager && (
                <AccountManager
                  accounts={accounts}
                  onAdd={addAccount}
                  onUpdate={updateAccount}
                  onRemove={removeAccount}
                  onClear={clearAccounts}
                />
              )}
            </div>

            {/* 帳號選擇與批次點名 */}
            {accounts.length > 0 ? (
              <form onSubmit={handleBatchSubmit} className="space-y-4">
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      選擇要點名的帳號
                    </span>
                    <button
                      type="button"
                      onClick={selectAllAccounts}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {selectedAccountIds.size === accounts.length ? "取消全選" : "全選"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <label
                        key={account.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAccountIds.has(account.id)}
                          onChange={() => toggleAccountSelection(account.id)}
                          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-zinc-900 dark:text-white">
                          {account.label || account.username}
                          {account.label && (
                            <span className="ml-2 text-xs text-zinc-500">({account.username})</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || selectedAccountIds.size === 0 || !rollcallGoto}
                  className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {isLoading
                    ? "點名中..."
                    : `批次點名 (${selectedAccountIds.size} 個帳號)`}
                </button>
              </form>
            ) : (
              /* 沒有儲存帳號時顯示手動輸入表單 */
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    帳號
                  </label>
                  <input
                    type="text"
                    value={manualUsername}
                    onChange={(e) => setManualUsername(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    placeholder="請輸入學號"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    密碼
                  </label>
                  <input
                    type="password"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                    placeholder="請輸入密碼"
                    required
                  />
                </div>

                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                  展開上方「帳號管理」可以儲存多個帳號
                </p>

                <button
                  type="submit"
                  disabled={isLoading || !rollcallGoto}
                  className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {isLoading ? "點名中..." : "開始點名"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* 結果顯示 */}
        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.length > 1 && (
              <div className="mb-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                成功: {successCount} / 失敗: {failCount}
              </div>
            )}
            {results.map((result) => (
              <div
                key={result.accountId}
                className={`rounded-lg p-3 ${
                  result.success
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                }`}
              >
                <div className="font-medium">{result.accountLabel}</div>
                <div className="text-sm">{result.message}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
