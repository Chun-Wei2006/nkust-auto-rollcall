"use client";

import { useState } from "react";
import QrScanner from "@/components/QrScanner";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rollcallGoto, setRollcallGoto] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const extractGotoParam = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("goto");
    } catch {
      // 如果不是完整 URL，嘗試直接從字串提取
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/rollcall/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          rollcall_goto: rollcallGoto,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({ success: true, message: data.message || "點名成功" });
      } else {
        const error = await response.json();
        setResult({ success: false, message: error.detail || "點名失敗" });
      }
    } catch {
      setResult({ success: false, message: "無法連接伺服器" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-900">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-white">
          NKUST 自動點名
        </h1>

        {showScanner ? (
          <div className="mb-6">
            <QrScanner
              onScan={handleScan}
              onClose={() => setShowScanner(false)}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                帳號
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
                placeholder="請輸入密碼"
                required
              />
            </div>

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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isLoading ? "點名中..." : "開始點名"}
            </button>
          </form>
        )}

        {result && (
          <div
            className={`mt-4 rounded-lg p-4 text-center ${
              result.success
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {result.message}
          </div>
        )}
      </main>
    </div>
  );
}
