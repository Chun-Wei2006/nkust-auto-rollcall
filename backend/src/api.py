import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auto_rollcall import AutoRollcall

app = FastAPI()

# CORS 設定 - 只允許特定來源
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# 從環境變數讀取前端 URL（必須明確指定，不再允許所有 vercel.app）
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

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
        auto_rollcall.start_browser(headless=True)
        result = auto_rollcall.run(rollcall_goto=request.rollcall_goto)

        if result["success"]:
            return RollcallResponse(
                success=True,
                message="點名成功",
                elapsed_time=result["elapsed_time"]
            )
        else:
            raise HTTPException(status_code=401, detail="登入失敗")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        auto_rollcall.close()
