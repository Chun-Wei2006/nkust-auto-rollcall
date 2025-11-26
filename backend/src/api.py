import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auto_rollcall import AutoRollcall

app = FastAPI()

# CORS 設定 - 允許本地開發與 Vercel 部署的前端
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# 從環境變數讀取額外的前端 URL
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

# 允許所有 vercel.app 子網域
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RollcallRequest(BaseModel):
    username: str
    password: str
    rollcall_goto: str


class RollcallResponse(BaseModel):
    success: bool
    message: str


@app.post("/rollcall/", response_model=RollcallResponse)
def rollcall(request: RollcallRequest) -> RollcallResponse:
    """執行自動點名"""
    auto_rollcall = AutoRollcall(request.username, request.password)

    try:
        auto_rollcall.start_browser(headless=True)
        success = auto_rollcall.run(
            rollcall_goto=request.rollcall_goto,
            keep_browser_open=False
        )

        if success:
            return RollcallResponse(success=True, message="點名成功")
        else:
            raise HTTPException(status_code=401, detail="登入失敗")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        auto_rollcall.close()
