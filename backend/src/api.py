import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .auto_rollcall import AutoRollcall
from .zuvio import ZuvioClient

app = FastAPI()

# CORS 設定 - 只允許特定來源
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# 從環境變數讀取前端 URL（必須明確指定，不再允許所有 vercel.app）
# 可用逗號分隔多個來源，方便同時允許正式站與 Vercel preview
frontend_url = os.getenv("FRONTEND_URL", "")
allowed_origins += [u.strip().rstrip("/") for u in frontend_url.split(",") if u.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],  # 只允許需要的方法
    allow_headers=["Content-Type"],  # 只允許需要的 headers
)


@app.get("/")
def health_check():
    """健康檢查端點"""
    return {"status": "ok", "message": "NKUST Auto Rollcall API is running"}


class RollcallRequest(BaseModel):
    username: str
    password: str
    rollcall_goto: str


class RollcallResponse(BaseModel):
    success: bool
    message: str
    elapsed_time: float | None = None  # 執行時間（秒）


@app.post("/rollcall/", response_model=RollcallResponse)
def rollcall(request: RollcallRequest) -> RollcallResponse:
    """執行自動點名"""
    auto_rollcall = AutoRollcall(request.username, request.password)

    try:
        result = auto_rollcall.run(rollcall_goto=request.rollcall_goto)

        return RollcallResponse(
            success=result["success"],
            message=result["message"],
            elapsed_time=result["elapsed_time"]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        auto_rollcall.close()


# ── Zuvio GPS 點名 ─────────────────────────────────────────
# 後端無狀態：登入後把 token 交給前端保存，之後的請求帶回來即可

class ZuvioLoginRequest(BaseModel):
    email: str
    password: str


class ZuvioLoginResponse(BaseModel):
    success: bool
    message: str
    user_id: str | None = None
    access_token: str | None = None
    name: str | None = None


class ZuvioTokenRequest(BaseModel):
    user_id: str
    access_token: str


class ZuvioCourse(BaseModel):
    course_id: str
    course_name: str
    teacher_name: str


class ZuvioCoursesResponse(BaseModel):
    success: bool
    message: str
    token_expired: bool = False
    courses: list[ZuvioCourse] = []


class ZuvioRollcallRequest(ZuvioTokenRequest):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    course_ids: list[str] = Field(min_length=1)


class ZuvioCourseResult(BaseModel):
    course_id: str
    status: str  # success / not_open / failed
    message: str


class ZuvioRollcallResponse(BaseModel):
    success: bool
    token_expired: bool = False
    results: list[ZuvioCourseResult]
    elapsed_time: float


@app.post("/zuvio/login/", response_model=ZuvioLoginResponse)
def zuvio_login(request: ZuvioLoginRequest) -> ZuvioLoginResponse:
    """Zuvio 登入，回傳 token 供後續請求使用"""
    client = ZuvioClient()
    try:
        return ZuvioLoginResponse(**client.login(request.email, request.password))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Zuvio 登入失敗: {e}")
    finally:
        client.close()


@app.post("/zuvio/courses/", response_model=ZuvioCoursesResponse)
def zuvio_courses(request: ZuvioTokenRequest) -> ZuvioCoursesResponse:
    """取得目前修習的課程"""
    client = ZuvioClient()
    try:
        return ZuvioCoursesResponse(**client.list_courses(request.user_id, request.access_token))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"無法取得 Zuvio 課程: {e}")
    finally:
        client.close()


@app.post("/zuvio/rollcall/", response_model=ZuvioRollcallResponse)
def zuvio_rollcall(request: ZuvioRollcallRequest) -> ZuvioRollcallResponse:
    """查詢多門課程的點名狀態，開放中的以指定座標簽到"""
    client = ZuvioClient()
    try:
        return ZuvioRollcallResponse(
            **client.rollcall(
                request.user_id,
                request.access_token,
                request.lat,
                request.lng,
                request.course_ids,
            )
        )
    finally:
        client.close()
