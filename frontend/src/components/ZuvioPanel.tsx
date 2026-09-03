"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ZuvioAccount, useZuvioAccounts, useZuvioLocation } from "@/hooks/useZuvioAccounts";
import {
  Coordinates,
  ZuvioApiError,
  ZuvioCourse,
  ZuvioCourseStatus,
  ZuvioToken,
  formatCoordinates,
  parseCoordinates,
  zuvioCourses,
  zuvioLogin,
  zuvioRollcall,
} from "@/lib/zuvio";

const POLL_INTERVAL_MS = 30_000;
const MAX_LOG_ENTRIES = 50;

interface LogEntry {
  id: string;
  time: string;
  accountLabel: string;
  courseName: string;
  status: ZuvioCourseStatus | "error";
  message: string;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white";
const smallButtonClass =
  "rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500";

function nowLabel() {
  return new Date().toLocaleTimeString("zh-TW", { hour12: false });
}

export default function ZuvioPanel() {
  const { accounts, addAccount, updateAccount, removeAccount, clearAccounts } = useZuvioAccounts();
  const { location, setLocation } = useZuvioLocation();

  // 座標輸入
  const [coordText, setCoordText] = useState(() => (location ? formatCoordinates(location) : ""));
  const [coordError, setCoordError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // 帳號表單
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: "", password: "", label: "" });

  // 課程（依帳號）與載入狀態
  const [coursesByAccount, setCoursesByAccount] = useState<Record<string, ZuvioCourse[]>>({});
  const [loadingCourses, setLoadingCourses] = useState<Set<string>>(new Set());
  const [courseErrors, setCourseErrors] = useState<Record<string, string>>({});
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

  // 點名
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  // token 只放記憶體；已簽到的課程在本次監控中不再重送
  const tokensRef = useRef<Map<string, ZuvioToken>>(new Map());
  const doneRef = useRef<Set<string>>(new Set());
  const busyRef = useRef(false);

  const accountLabel = (account: ZuvioAccount) => account.label || account.email;

  const appendLog = useCallback((entries: Omit<LogEntry, "id" | "time">[]) => {
    if (entries.length === 0) return;
    const time = nowLabel();
    setLog((prev) =>
      [
        ...entries.map((e) => ({ ...e, id: crypto.randomUUID(), time })),
        ...prev,
      ].slice(0, MAX_LOG_ENTRIES)
    );
  }, []);

  // ── 座標 ─────────────────────────────────────────────
  const applyCoordinates = (text: string) => {
    setCoordText(text);
    if (!text.trim()) {
      setLocation(null);
      setCoordError(null);
      return;
    }
    const parsed = parseCoordinates(text);
    if (parsed) {
      setLocation(parsed);
      setCoordError(null);
    } else {
      setCoordError("格式不對，請貼上 Google 地圖的「緯度, 經度」，例如 22.725299, 120.316478");
    }
  };

  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCoordError("此瀏覽器不支援定位");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setCoordText(formatCoordinates(coords));
        setLocation(coords);
        setCoordError(null);
        setLocating(false);
      },
      (err) => {
        setCoordError(err.code === err.PERMISSION_DENIED ? "定位權限被拒絕" : "無法取得目前位置");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  // ── 帳號表單 ─────────────────────────────────────────
  const resetForm = () => {
    setFormData({ email: "", password: "", label: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = formData.email.trim();
    if (editingId) {
      updateAccount(editingId, {
        email,
        password: formData.password,
        label: formData.label || undefined,
      });
      // 帳密可能變了，token 與課程快取作廢
      tokensRef.current.delete(editingId);
      setCoursesByAccount((prev) => {
        const next = { ...prev };
        delete next[editingId];
        return next;
      });
    } else {
      addAccount(email, formData.password, formData.label || undefined);
    }
    resetForm();
  };

  const startEdit = (account: ZuvioAccount) => {
    setEditingId(account.id);
    setFormData({ email: account.email, password: account.password, label: account.label || "" });
    setIsAdding(true);
  };

  const handleRemove = (account: ZuvioAccount) => {
    if (!confirm(`確定要刪除帳號 ${accountLabel(account)} 嗎？`)) return;
    removeAccount(account.id);
    tokensRef.current.delete(account.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(account.id);
      return next;
    });
  };

  // ── token 與課程 ─────────────────────────────────────
  const ensureToken = useCallback(async (account: ZuvioAccount, force = false): Promise<ZuvioToken> => {
    const cached = tokensRef.current.get(account.id);
    if (cached && !force) return cached;
    const token = await zuvioLogin(account.email, account.password);
    tokensRef.current.set(account.id, token);
    return token;
  }, []);

  // token 失效時自動重新登入一次再重試
  const withToken = useCallback(
    async <T,>(account: ZuvioAccount, fn: (token: ZuvioToken) => Promise<T>): Promise<T> => {
      try {
        return await fn(await ensureToken(account));
      } catch (err) {
        if (err instanceof ZuvioApiError && err.tokenExpired) {
          return await fn(await ensureToken(account, true));
        }
        throw err;
      }
    },
    [ensureToken]
  );

  const loadCourses = useCallback(
    async (account: ZuvioAccount): Promise<ZuvioCourse[]> => {
      setLoadingCourses((prev) => new Set(prev).add(account.id));
      setCourseErrors((prev) => {
        const next = { ...prev };
        delete next[account.id];
        return next;
      });
      try {
        const courses = await withToken(account, zuvioCourses);
        setCoursesByAccount((prev) => ({ ...prev, [account.id]: courses }));
        return courses;
      } catch (err) {
        const message = err instanceof Error ? err.message : "載入課程失敗";
        setCourseErrors((prev) => ({ ...prev, [account.id]: message }));
        throw err;
      } finally {
        setLoadingCourses((prev) => {
          const next = new Set(prev);
          next.delete(account.id);
          return next;
        });
      }
    },
    [withToken]
  );

  const toggleCourse = (account: ZuvioAccount, courseId: string) => {
    const current = new Set(account.courseIds ?? []);
    if (current.has(courseId)) {
      current.delete(courseId);
    } else {
      current.add(courseId);
    }
    updateAccount(account.id, { courseIds: Array.from(current) });
  };

  // ── 點名 ─────────────────────────────────────────────
  const runOnce = useCallback(
    async (targets: ZuvioAccount[], coords: Coordinates, skipDone: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setRunning(true);
      try {
        await Promise.all(
          targets.map(async (account) => {
            const label = accountLabel(account);
            try {
              const courses =
                coursesByAccount[account.id] ?? (await loadCourses(account));
              const nameOf = (id: string) =>
                courses.find((c) => c.course_id === id)?.course_name || `課程 ${id}`;
              let courseIds = account.courseIds?.length
                ? account.courseIds
                : courses.map((c) => c.course_id);
              if (skipDone) {
                courseIds = courseIds.filter((id) => !doneRef.current.has(`${account.id}:${id}`));
              }
              if (courseIds.length === 0) return;

              const res = await withToken(account, (token) =>
                zuvioRollcall(token, coords, courseIds)
              );
              const entries = res.results
                .filter((r) => r.status !== "not_open" || !skipDone)
                .map((r) => ({
                  accountLabel: label,
                  courseName: nameOf(r.course_id),
                  status: r.status,
                  message: r.message,
                }));
              for (const r of res.results) {
                if (r.status === "success") doneRef.current.add(`${account.id}:${r.course_id}`);
              }
              appendLog(entries);
            } catch (err) {
              appendLog([
                {
                  accountLabel: label,
                  courseName: "",
                  status: "error",
                  message: err instanceof Error ? err.message : "未知錯誤",
                },
              ]);
            }
          })
        );
        setLastCheck(nowLabel());
      } finally {
        busyRef.current = false;
        setRunning(false);
      }
    },
    [appendLog, coursesByAccount, loadCourses, withToken]
  );

  const selectedAccounts = accounts.filter((a) => selectedIds.has(a.id));
  const canRun = !!location && selectedAccounts.length > 0;

  const handleRollcallNow = () => {
    if (!location) return;
    void runOnce(selectedAccounts, location, false);
  };

  const startMonitoring = () => {
    if (!location) return;
    doneRef.current.clear();
    setMonitoring(true);
    appendLog([
      {
        accountLabel: "系統",
        courseName: "",
        status: "not_open",
        message: `開始監控 ${selectedAccounts.length} 個帳號，每 ${POLL_INTERVAL_MS / 1000} 秒檢查一次`,
      },
    ]);
    void runOnce(selectedAccounts, location, true);
  };

  const stopMonitoring = () => setMonitoring(false);

  // 監控輪詢；帳號或座標變動時以最新值重跑，unmount 時清掉
  useEffect(() => {
    if (!monitoring || !location) return;
    const targets = accounts.filter((a) => selectedIds.has(a.id));
    if (targets.length === 0) return;
    const timer = setInterval(() => {
      void runOnce(targets, location, true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [monitoring, location, accounts, selectedIds, runOnce]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds((prev) =>
      prev.size === accounts.length ? new Set() : new Set(accounts.map((a) => a.id))
    );
  };

  const statusStyle: Record<LogEntry["status"], string> = {
    success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    not_open: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
  };

  return (
    <div className="space-y-4">
      {/* 座標設定 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          教室 GPS 座標
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={coordText}
            onChange={(e) => applyCoordinates(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
            placeholder="貼上 Google 地圖座標，如 22.725299, 120.316478"
            inputMode="decimal"
          />
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="rounded-lg bg-zinc-200 px-4 py-2 font-medium text-zinc-700 transition-colors hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
          >
            {locating ? "定位中" : "目前位置"}
          </button>
        </div>
        {coordError ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{coordError}</p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            在 Google 地圖長按教室位置，複製出現的座標貼到這裡
          </p>
        )}
      </div>

      {/* 帳號管理 */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium text-zinc-900 dark:text-white">
            Zuvio 帳號 ({accounts.length})
          </h3>
          <div className="flex gap-2">
            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("確定要清除所有 Zuvio 帳號嗎？")) {
                    clearAccounts();
                    tokensRef.current.clear();
                    setSelectedIds(new Set());
                  }
                }}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                清除全部
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              + 新增帳號
            </button>
          </div>
        </div>

        {accounts.length > 0 && (
          <ul className="mb-3 space-y-2">
            {accounts.map((account) => {
              const courses = coursesByAccount[account.id];
              const expanded = expandedAccountId === account.id;
              const picked = new Set(account.courseIds ?? []);
              return (
                <li key={account.id} className="rounded-md bg-white p-2 dark:bg-zinc-700">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-white">
                        {accountLabel(account)}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {account.label ? account.email : ""}
                        {courses
                          ? `${account.label ? " · " : ""}${
                              picked.size > 0 ? `監控 ${picked.size}/${courses.length} 門課` : `監控全部 ${courses.length} 門課`
                            }`
                          : ""}
                      </p>
                    </div>
                    <div className="ml-2 flex gap-1">
                      <button
                        type="button"
                        disabled={loadingCourses.has(account.id)}
                        onClick={async () => {
                          setExpandedAccountId(account.id);
                          try {
                            await loadCourses(account);
                          } catch {
                            // 錯誤已寫入 courseErrors
                          }
                        }}
                        className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      >
                        {loadingCourses.has(account.id) ? "載入中" : courses ? "重新載入" : "載入課程"}
                      </button>
                      {courses && (
                        <button
                          type="button"
                          onClick={() => setExpandedAccountId(expanded ? null : account.id)}
                          className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-600"
                        >
                          {expanded ? "收合" : "選課程"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(account)}
                        className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
                        title="編輯"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(account)}
                        className="rounded p-1 text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        title="刪除"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {courseErrors[account.id] && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {courseErrors[account.id]}
                    </p>
                  )}

                  {expanded && courses && (
                    <div className="mt-2 space-y-1 border-t border-zinc-200 pt-2 dark:border-zinc-600">
                      {courses.length === 0 ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">這個帳號沒有課程</p>
                      ) : (
                        <>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            勾選要監控的課程，都不勾就是全部
                          </p>
                          {courses.map((course) => (
                            <label
                              key={course.course_id}
                              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-600/50"
                            >
                              <input
                                type="checkbox"
                                checked={picked.has(course.course_id)}
                                onChange={() => toggleCourse(account, course.course_id)}
                                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-white">
                                {course.course_name}
                                {course.teacher_name && (
                                  <span className="ml-1 text-xs text-zinc-500">({course.teacher_name})</span>
                                )}
                              </span>
                            </label>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {isAdding && (
          <form onSubmit={handleSubmit} className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className={inputClass}
              placeholder="帳號別名（選填）"
            />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClass}
              placeholder="Zuvio Email"
              autoComplete="off"
              required
            />
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={inputClass}
              placeholder="Zuvio 密碼"
              autoComplete="off"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {editingId ? "更新" : "儲存"}
              </button>
              <button type="button" onClick={resetForm} className={smallButtonClass}>
                取消
              </button>
            </div>
          </form>
        )}

        {accounts.length === 0 && !isAdding && (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            尚未儲存任何 Zuvio 帳號。Zuvio 帳號是 Email，與高科大學號帳號不同。
          </p>
        )}
      </div>

      {/* 選擇帳號與執行 */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                選擇要點名的帳號
              </span>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {selectedIds.size === accounts.length ? "取消全選" : "全選"}
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
                    checked={selectedIds.has(account.id)}
                    onChange={() => toggleSelected(account.id)}
                    disabled={monitoring}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {accountLabel(account)}
                    {account.label && (
                      <span className="ml-2 text-xs text-zinc-500">({account.email})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {monitoring ? (
            <button
              type="button"
              onClick={stopMonitoring}
              className="w-full rounded-lg bg-red-600 py-3 font-medium text-white transition-colors hover:bg-red-700"
            >
              停止監控{lastCheck ? `（上次檢查 ${lastCheck}）` : ""}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRollcallNow}
                disabled={!canRun || running}
                className="flex-1 rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {running ? "點名中..." : `立即點名 (${selectedAccounts.length})`}
              </button>
              <button
                type="button"
                onClick={startMonitoring}
                disabled={!canRun || running}
                className="flex-1 rounded-lg bg-green-600 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
              >
                自動監控
              </button>
            </div>
          )}

          {!location && (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              先設定教室座標才能點名
            </p>
          )}
          {monitoring && (
            <p className="text-center text-xs text-amber-700 dark:text-amber-400">
              監控期間請保持這個頁面在前景，瀏覽器會暫停背景分頁的計時器
            </p>
          )}
        </div>
      )}

      {/* 紀錄 */}
      {log.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">紀錄</span>
            <button
              type="button"
              onClick={() => setLog([])}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              清除
            </button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {log.map((entry) => (
              <div key={entry.id} className={`rounded-md px-3 py-2 text-sm ${statusStyle[entry.status]}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">
                    {entry.accountLabel}
                    {entry.courseName && ` · ${entry.courseName}`}
                  </span>
                  <span className="shrink-0 text-xs opacity-70">{entry.time}</span>
                </div>
                <div className="text-xs">{entry.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
