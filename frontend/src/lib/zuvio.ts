// Zuvio GPS 點名：後端 API 呼叫與座標解析

export interface ZuvioToken {
  user_id: string;
  access_token: string;
  name?: string;
}

export interface ZuvioCourse {
  course_id: string;
  course_name: string;
  teacher_name: string;
}

export type ZuvioCourseStatus = "success" | "not_open" | "failed";

export interface ZuvioCourseResult {
  course_id: string;
  status: ZuvioCourseStatus;
  message: string;
}

export interface ZuvioRollcallResponse {
  success: boolean;
  token_expired: boolean;
  results: ZuvioCourseResult[];
  elapsed_time: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export class ZuvioApiError extends Error {
  tokenExpired: boolean;
  constructor(message: string, tokenExpired = false) {
    super(message);
    this.tokenExpired = tokenExpired;
  }
}

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ZuvioApiError("無法連接伺服器");
  }
  if (!response.ok) {
    let detail = `伺服器錯誤 (${response.status})`;
    try {
      const err = await response.json();
      if (typeof err.detail === "string") detail = err.detail;
    } catch {
      // 非 JSON 錯誤回應，保留預設訊息
    }
    throw new ZuvioApiError(detail);
  }
  return response.json();
}

export async function zuvioLogin(email: string, password: string): Promise<ZuvioToken> {
  const data = await post<{
    success: boolean;
    message: string;
    user_id?: string;
    access_token?: string;
    name?: string;
  }>("/zuvio/login/", { email, password });
  if (!data.success || !data.user_id || !data.access_token) {
    throw new ZuvioApiError(data.message || "登入失敗");
  }
  return { user_id: data.user_id, access_token: data.access_token, name: data.name };
}

export async function zuvioCourses(token: ZuvioToken): Promise<ZuvioCourse[]> {
  const data = await post<{
    success: boolean;
    message: string;
    token_expired: boolean;
    courses: ZuvioCourse[];
  }>("/zuvio/courses/", { user_id: token.user_id, access_token: token.access_token });
  if (!data.success) {
    throw new ZuvioApiError(data.message || "無法取得課程", data.token_expired);
  }
  return data.courses;
}

export async function zuvioRollcall(
  token: ZuvioToken,
  coords: Coordinates,
  courseIds: string[]
): Promise<ZuvioRollcallResponse> {
  const data = await post<ZuvioRollcallResponse>("/zuvio/rollcall/", {
    user_id: token.user_id,
    access_token: token.access_token,
    lat: coords.lat,
    lng: coords.lng,
    course_ids: courseIds,
  });
  if (data.token_expired) {
    throw new ZuvioApiError("登入已失效", true);
  }
  return data;
}

// 解析 Google 地圖複製出來的「22.725299, 120.316478」；也接受空白或全形逗號分隔
export function parseCoordinates(text: string): Coordinates | null {
  const cleaned = text.trim().replace(/，/g, ",").replace(/[()]/g, "");
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function formatCoordinates(coords: Coordinates): string {
  return `${coords.lat}, ${coords.lng}`;
}
