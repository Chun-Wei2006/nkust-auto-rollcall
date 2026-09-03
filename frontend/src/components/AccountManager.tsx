"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Account } from "@/hooks/useAccounts";
import {
  MIN_PASSPHRASE_LENGTH,
  QR_ACCOUNT_LIMIT,
  buildPlainEnvelope,
  buildShareUrl,
  encryptPayload,
} from "@/lib/share";

interface AccountManagerProps {
  accounts: Account[];
  onAdd: (username: string, password: string, label?: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Account, "id">>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const URL_BUILD_DEBOUNCE_MS = 400;

export default function AccountManager({
  accounts,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
}: AccountManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    label: "",
  });

  // 分享：多選模式與分享面板
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareTargetIds, setShareTargetIds] = useState<string[] | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [built, setBuilt] = useState<{ key: string; url: string } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareTargets = shareTargetIds
    ? accounts.filter((a) => shareTargetIds.includes(a.id))
    : [];
  const passphraseTooShort =
    passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE_LENGTH;
  const buildKey = JSON.stringify([shareTargetIds, passphrase]);
  const shareUrl = built?.key === buildKey ? built.url : null;

  // 連結在密碼輸入後就先算好，讓「分享」按下去能同步呼叫 navigator.share
  // （iOS Safari 要求 share 必須在使用者手勢內觸發，等 PBKDF2 跑完會超時）
  useEffect(() => {
    if (!shareTargetIds || passphraseTooShort) return;
    const targets = accounts.filter((a) => shareTargetIds.includes(a.id));
    if (targets.length === 0) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const payload = targets.map((a) => ({
        u: a.username,
        p: a.password,
        ...(a.label && { l: a.label }),
      }));
      const envelope = passphrase
        ? await encryptPayload(payload, passphrase)
        : buildPlainEnvelope(payload);
      if (!cancelled) {
        setBuilt({ key: buildKey, url: buildShareUrl(envelope) });
      }
    }, URL_BUILD_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accounts, shareTargetIds, passphrase, passphraseTooShort, buildKey]);

  const resetForm = () => {
    setFormData({ username: "", password: "", label: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onUpdate(editingId, {
        username: formData.username,
        password: formData.password,
        label: formData.label || undefined,
      });
    } else {
      onAdd(formData.username, formData.password, formData.label || undefined);
    }
    resetForm();
  };

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setFormData({
      username: account.username,
      password: account.password,
      label: account.label || "",
    });
    setIsAdding(true);
  };

  const openSharePanel = (ids: string[]) => {
    setShareTargetIds(ids);
    setPassphrase("");
    setShowQR(false);
    setCopied(false);
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const closeSharePanel = () => {
    setShareTargetIds(null);
    setBuilt(null);
  };

  const toggleSelected = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const canNativeShare = (url: string) =>
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" || navigator.canShare({ url }));

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // 剪貼簿不可用時至少讓使用者看得到連結（QR 或手動複製）
      setShowQR(true);
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    if (canNativeShare(shareUrl)) {
      try {
        await navigator.share({ title: "NKUST 自動點名 帳號分享", url: shareUrl });
      } catch {
        // 使用者取消分享單，不需處理
      }
      return;
    }
    await copyLink(shareUrl);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-zinc-900 dark:text-white">
          已儲存帳號 ({accounts.length})
        </h3>
        <div className="flex gap-2">
          {accounts.length > 0 && selectMode && (
            <>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => openSharePanel(Array.from(selectedIds))}
                className="text-xs text-green-600 hover:text-green-700 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
              >
                分享已選 ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                取消
              </button>
            </>
          )}
          {accounts.length > 0 && !selectMode && (
            <>
              <button
                type="button"
                onClick={() => {
                  closeSharePanel();
                  setSelectMode(true);
                }}
                className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              >
                分享多個
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("確定要清除所有帳號嗎？")) {
                    onClear();
                  }
                }}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                清除全部
              </button>
            </>
          )}
          {!selectMode && (
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
          )}
        </div>
      </div>

      {/* 分享面板 */}
      {shareTargetIds && shareTargets.length > 0 && (
        <div className="mb-3 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-900 dark:text-white">
              分享 {shareTargets.length} 個帳號
            </span>
            <button
              type="button"
              onClick={closeSharePanel}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              關閉
            </button>
          </div>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {shareTargets.map((a) => a.label || a.username).join("、")}
          </p>

          <div>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                setCopied(false);
              }}
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-500 dark:bg-zinc-600 dark:text-white"
              placeholder={`分享密碼（選填，至少 ${MIN_PASSPHRASE_LENGTH} 個字元）`}
            />
            {passphraseTooShort ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                分享密碼至少需要 {MIN_PASSPHRASE_LENGTH} 個字元
              </p>
            ) : passphrase ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                連結會加密，請用另一個管道把密碼告訴對方。加密只能降低外洩風險，不是保險箱。
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                未設密碼：拿到這條連結的人可以直接看到帳號密碼，只傳給信任的人。
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={!shareUrl}
              className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {!shareUrl && !passphraseTooShort ? "產生中..." : "分享"}
            </button>
            <button
              type="button"
              onClick={() => shareUrl && copyLink(shareUrl)}
              disabled={!shareUrl}
              className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
            >
              {copied ? "已複製" : "複製連結"}
            </button>
            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              disabled={!shareUrl}
              className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
            >
              {showQR ? "隱藏 QR" : "顯示 QR"}
            </button>
          </div>

          {shareTargets.length > QR_ACCOUNT_LIMIT && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              帳號數超過 {QR_ACCOUNT_LIMIT} 個，QR Code 會太密不好掃，建議改用連結分享。
            </p>
          )}

          {showQR && shareUrl && (
            <div className="flex flex-col items-center rounded-lg bg-white p-3">
              <QRCodeSVG value={shareUrl} size={220} level="L" />
              <p className="mt-2 text-xs text-zinc-500">
                用本站的「掃描」功能掃描即可匯入
              </p>
            </div>
          )}
        </div>
      )}

      {/* 帳號列表 */}
      {accounts.length > 0 && (
        <ul className="mb-3 space-y-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between rounded-md bg-white p-2 dark:bg-zinc-700"
            >
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(account.id)}
                  onChange={() => toggleSelected(account.id)}
                  className="mr-3 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900 dark:text-white">
                  {account.label || account.username}
                </p>
                {account.label && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {account.username}
                  </p>
                )}
              </div>
              {!selectMode && (
                <div className="ml-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => openSharePanel([account.id])}
                    className="rounded p-1 text-zinc-500 hover:bg-green-100 hover:text-green-700 dark:text-zinc-400 dark:hover:bg-green-900/30 dark:hover:text-green-400"
                    title="分享"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(account)}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
                    title="編輯"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
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
                    onClick={() => {
                      if (confirm(`確定要刪除帳號 ${account.label || account.username} 嗎？`)) {
                        onRemove(account.id);
                      }
                    }}
                    className="rounded p-1 text-zinc-500 hover:bg-red-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    title="刪除"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 新增/編輯表單 */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <div>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              placeholder="帳號別名（選填）"
            />
          </div>
          <div>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              placeholder="學號"
              required
            />
          </div>
          <div>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              placeholder="密碼"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {editingId ? "更新" : "儲存"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {accounts.length === 0 && !isAdding && (
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          尚未儲存任何帳號
        </p>
      )}
    </div>
  );
}
