"""
Zuvio GPS 點名
以 Zuvio 學生端 App 使用的 token API 完成登入、課程查詢與 GPS 簽到，不需要瀏覽器與 cookie。

API 來源整理自多個開源實作（mlgzackfly/auto-zuvio、Tonylemty/SideProject、hpware/zuvio-rollback）：
- POST /app_v2/login                       {email, password, loginType}      -> {status, user_id, accessToken, name}
- GET  /course/listStudentCurrentCourses    ?user_id&accessToken             -> {status, courses: [...]}
- GET  /app_v2/getRollcall                  ?user_id&accessToken&course_id   -> 進行中的點名資訊（含 rollcall_id）
- POST /app_v2/makeRollcall                 {user_id, accessToken, rollcall_id, device, lat, lng} -> {status, msg}
"""
import logging
import time
from typing import Any

import requests

BASE_URL = "https://irs.zuvio.com.tw"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
TIMEOUT = 15

# Zuvio 回應 status=false 時，訊息含這些字樣視為 token 失效，前端需重新登入
# 實測：課程 API 回 "auth error"，getRollcall 回 "ACCESSTOKEN WRONG"
TOKEN_EXPIRED_HINTS = ("token", "auth", "登入", "login", "驗證", "unauthorized")

# Zuvio 以英文代碼回錯誤，實測登入失敗回 "ACCOUNT_NOT_EXIST"
KNOWN_MESSAGES = {
    "ACCOUNT_NOT_EXIST": "帳號不存在",
    "PASSWORD_ERROR": "密碼錯誤",
    "PASSWORD_WRONG": "密碼錯誤",
    "ACCESSTOKEN WRONG": "登入已失效，請重新登入",
    "auth error": "登入已失效，請重新登入",
}

logger = logging.getLogger(__name__)


class ZuvioClient:
    """封裝 Zuvio token API，所有方法回傳統一格式的 dict，不拋出業務例外"""

    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
            "Referer": f"{BASE_URL}/",
        })

    def close(self) -> None:
        self.session.close()

    # ── 內部工具 ─────────────────────────────────────────────

    @staticmethod
    def _message(payload: dict[str, Any], default: str) -> str:
        raw = str(payload.get("msg") or payload.get("message") or "").strip()
        if not raw:
            return default
        return KNOWN_MESSAGES.get(raw, raw)

    @staticmethod
    def _is_token_expired(payload: dict[str, Any]) -> bool:
        text = (str(payload.get("msg") or payload.get("message") or "")).lower()
        return any(hint in text for hint in TOKEN_EXPIRED_HINTS)

    def _json(self, resp: requests.Response) -> dict[str, Any]:
        resp.raise_for_status()
        try:
            data = resp.json()
        except ValueError as e:
            raise ValueError(f"Zuvio 回應不是 JSON（HTTP {resp.status_code}）") from e
        if not isinstance(data, dict):
            raise ValueError("Zuvio 回應格式不符")
        return data

    @staticmethod
    def _find_rollcall_id(node: Any) -> str | None:
        """遞迴尋找 rollcall_id；公開實作沒有完整記錄 getRollcall 的欄位，這裡寬鬆處理"""
        if isinstance(node, dict):
            for key in ("rollcall_id", "rollcallId"):
                value = node.get(key)
                if value not in (None, "", 0, "0", "null", "undefined", False):
                    return str(value)
            for key in ("rollcall", "data", "result"):
                if key in node:
                    found = ZuvioClient._find_rollcall_id(node[key])
                    if found:
                        return found
            # 點名物件本身可能只有 id
            if node.get("id") and any(k in node for k in ("lat", "lng", "range", "start_time", "rollcall_status")):
                return str(node["id"])
        elif isinstance(node, list):
            for item in node:
                found = ZuvioClient._find_rollcall_id(item)
                if found:
                    return found
        return None

    # ── 公開方法 ─────────────────────────────────────────────

    def login(self, email: str, password: str) -> dict[str, Any]:
        resp = self.session.post(
            f"{BASE_URL}/app_v2/login",
            json={"email": email, "password": password, "loginType": "email"},
            timeout=TIMEOUT,
        )
        data = self._json(resp)
        if not data.get("status"):
            return {"success": False, "message": self._message(data, "登入失敗，請確認帳號密碼")}

        user_id = data.get("user_id")
        token = data.get("accessToken")
        if not user_id or not token:
            raise ValueError("Zuvio 登入回應缺少 user_id 或 accessToken")

        return {
            "success": True,
            "message": "登入成功",
            "user_id": str(user_id),
            "access_token": str(token),
            "name": str(data.get("name") or ""),
        }

    def list_courses(self, user_id: str, access_token: str) -> dict[str, Any]:
        resp = self.session.get(
            f"{BASE_URL}/course/listStudentCurrentCourses",
            params={"user_id": user_id, "accessToken": access_token},
            timeout=TIMEOUT,
        )
        data = self._json(resp)
        if not data.get("status"):
            return {
                "success": False,
                "message": self._message(data, "無法取得課程"),
                "token_expired": self._is_token_expired(data),
                "courses": [],
            }

        courses = []
        for c in data.get("courses") or []:
            if not isinstance(c, dict) or not c.get("course_id"):
                continue
            courses.append({
                "course_id": str(c["course_id"]),
                "course_name": str(c.get("course_name") or c.get("name") or ""),
                "teacher_name": str(c.get("teacher_name") or ""),
            })
        return {"success": True, "message": "", "token_expired": False, "courses": courses}

    def get_rollcall(self, user_id: str, access_token: str, course_id: str) -> dict[str, Any]:
        resp = self.session.get(
            f"{BASE_URL}/app_v2/getRollcall",
            params={"user_id": user_id, "accessToken": access_token, "course_id": course_id},
            timeout=TIMEOUT,
        )
        data = self._json(resp)
        if not data.get("status"):
            return {
                "open": False,
                "rollcall_id": None,
                "message": self._message(data, "尚未開放點名"),
                "token_expired": self._is_token_expired(data),
            }
        rollcall_id = self._find_rollcall_id(data)
        if not rollcall_id:
            logger.info("getRollcall 找不到 rollcall_id，視為未開放。原始回應: %s", data)
        return {
            "open": rollcall_id is not None,
            "rollcall_id": rollcall_id,
            "message": "" if rollcall_id else "尚未開放點名",
            "token_expired": False,
        }

    def make_rollcall(
        self, user_id: str, access_token: str, rollcall_id: str, lat: float, lng: float
    ) -> dict[str, Any]:
        resp = self.session.post(
            f"{BASE_URL}/app_v2/makeRollcall",
            json={
                "user_id": user_id,
                "accessToken": access_token,
                "rollcall_id": rollcall_id,
                "device": "WEB",
                "lat": str(lat),
                "lng": str(lng),
            },
            timeout=TIMEOUT,
        )
        data = self._json(resp)
        ok = bool(data.get("status"))
        return {
            "success": ok,
            "message": self._message(data, "簽到成功" if ok else "簽到失敗"),
            "token_expired": (not ok) and self._is_token_expired(data),
        }

    def rollcall(
        self,
        user_id: str,
        access_token: str,
        lat: float,
        lng: float,
        course_ids: list[str],
    ) -> dict[str, Any]:
        """
        對多門課程查詢點名狀態，開放中的送出簽到。
        每門課結果 status 為 success / not_open / failed。
        """
        start = time.time()
        results = []
        token_expired = False

        for course_id in course_ids:
            try:
                state = self.get_rollcall(user_id, access_token, course_id)
                if state["token_expired"]:
                    token_expired = True
                    results.append({"course_id": course_id, "status": "failed", "message": state["message"]})
                    break
                if not state["open"]:
                    results.append({"course_id": course_id, "status": "not_open", "message": state["message"]})
                    continue

                made = self.make_rollcall(user_id, access_token, state["rollcall_id"], lat, lng)
                if made["token_expired"]:
                    token_expired = True
                results.append({
                    "course_id": course_id,
                    "status": "success" if made["success"] else "failed",
                    "message": made["message"],
                })
                logger.info("Zuvio 課程 %s 簽到 %s: %s", course_id, "成功" if made["success"] else "失敗", made["message"])
            except (requests.RequestException, ValueError) as e:
                logger.warning("Zuvio 課程 %s 處理失敗: %s", course_id, e)
                results.append({"course_id": course_id, "status": "failed", "message": str(e)})

        return {
            "success": not token_expired,
            "token_expired": token_expired,
            "results": results,
            "elapsed_time": time.time() - start,
        }
