// 帳號分享連結的編解碼與加解密
// 格式：https://<origin>/import#<base64url(JSON envelope)>
// payload 一律放在 fragment，瀏覽器不會把它送到伺服器

export interface ShareAccount {
  u: string; // 學號
  p: string; // 密碼
  l?: string; // 別名
}

interface PlainEnvelope {
  v: 1;
  enc: false;
  accounts: ShareAccount[];
}

interface EncryptedEnvelope {
  v: 1;
  enc: true;
  salt: string; // base64url
  iv: string; // base64url
  data: string; // base64url，AES-GCM 密文（含 tag）
}

export type ShareEnvelope = PlainEnvelope | EncryptedEnvelope;

export const SHARE_PATH = "/import";
export const MIN_PASSPHRASE_LENGTH = 6;
export const QR_ACCOUNT_LIMIT = 10;
const PBKDF2_ITERATIONS = 600_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function buildPlainEnvelope(accounts: ShareAccount[]): PlainEnvelope {
  return { v: 1, enc: false, accounts };
}

export async function encryptPayload(
  accounts: ShareAccount[],
  passphrase: string
): Promise<EncryptedEnvelope> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`分享密碼至少需要 ${MIN_PASSPHRASE_LENGTH} 個字元`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = encoder.encode(JSON.stringify(accounts));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    v: 1,
    enc: true,
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    data: toBase64Url(new Uint8Array(ciphertext)),
  };
}

// 密碼錯誤或資料損毀時 AES-GCM 驗證會失敗，統一丟 Error 讓呼叫端顯示密碼錯誤
export async function decryptPayload(
  envelope: EncryptedEnvelope,
  passphrase: string
): Promise<ShareAccount[]> {
  const key = await deriveKey(passphrase, fromBase64Url(envelope.salt));
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(envelope.iv) },
      key,
      fromBase64Url(envelope.data)
    );
  } catch {
    throw new Error("分享密碼錯誤");
  }
  const accounts = parseAccounts(JSON.parse(decoder.decode(plaintext)));
  if (!accounts) throw new Error("分享內容格式錯誤");
  return accounts;
}

export function buildShareUrl(envelope: ShareEnvelope): string {
  const payload = toBase64Url(encoder.encode(JSON.stringify(envelope)));
  return `${window.location.origin}${SHARE_PATH}#${payload}`;
}

function parseAccounts(value: unknown): ShareAccount[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const accounts: ShareAccount[] = [];
  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.u !== "string" ||
      typeof item.p !== "string" ||
      !item.u ||
      !item.p ||
      (item.l !== undefined && typeof item.l !== "string")
    ) {
      return null;
    }
    accounts.push({ u: item.u, p: item.p, ...(item.l && { l: item.l }) });
  }
  return accounts;
}

// 解析 fragment（不含 #）。格式不對或版本不支援回傳 null
export function parseShareFragment(fragment: string): ShareEnvelope | null {
  if (!fragment) return null;
  try {
    const parsed = JSON.parse(decoder.decode(fromBase64Url(fragment)));
    if (typeof parsed !== "object" || parsed === null || parsed.v !== 1) return null;

    if (parsed.enc === true) {
      if (
        typeof parsed.salt !== "string" ||
        typeof parsed.iv !== "string" ||
        typeof parsed.data !== "string"
      ) {
        return null;
      }
      return { v: 1, enc: true, salt: parsed.salt, iv: parsed.iv, data: parsed.data };
    }

    if (parsed.enc === false) {
      const accounts = parseAccounts(parsed.accounts);
      return accounts ? { v: 1, enc: false, accounts } : null;
    }
    return null;
  } catch {
    return null;
  }
}

// 判斷掃描到的字串是不是本站的分享連結，是的話回傳 `/import#...` 相對路徑
export function parseShareLink(text: string): string | null {
  try {
    const url = new URL(text);
    if (
      url.origin === window.location.origin &&
      url.pathname === SHARE_PATH &&
      url.hash.length > 1
    ) {
      return `${SHARE_PATH}${url.hash}`;
    }
  } catch {
    // 不是 URL
  }
  return null;
}
