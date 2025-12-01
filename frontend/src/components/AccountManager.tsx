"use client";

import { useState } from "react";
import { Account } from "@/hooks/useAccounts";

interface AccountManagerProps {
  accounts: Account[];
  onAdd: (username: string, password: string, label?: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Account, "id">>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

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

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-zinc-900 dark:text-white">
          已儲存帳號 ({accounts.length})
        </h3>
        <div className="flex gap-2">
          {accounts.length > 0 && (
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

      {/* 帳號列表 */}
      {accounts.length > 0 && (
        <ul className="mb-3 space-y-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between rounded-md bg-white p-2 dark:bg-zinc-700"
            >
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
              <div className="ml-2 flex gap-1">
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
