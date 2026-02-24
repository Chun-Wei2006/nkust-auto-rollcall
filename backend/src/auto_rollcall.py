"""
NKUST 自動點名系統
訪問 Rollcall 頁面，提交帳密表單完成點名
"""
import os
import re
import time
import hashlib
import base64
import logging
from urllib.parse import urljoin

from Crypto.Cipher import DES
from dotenv import load_dotenv
import requests

load_dotenv(override=True)
logging.basicConfig(level=logging.INFO)


def encrypt_password(password: str, login_key: str) -> str:
    """
    複製前端 JS 的密碼加密邏輯：
    md5key = MD5(password)
    cypkey = md5key[:4] + login_key[:4]
    encrypt_pwd = base64(DES_ECB(cypkey, password))
    """
    md5key = hashlib.md5(password.encode()).hexdigest()
    cypkey = (md5key[:4] + login_key[:4]).encode("ascii")

    cipher = DES.new(cypkey, DES.MODE_ECB)

    pwd_bytes = password.encode("ascii")
    pad_len = 8 - (len(pwd_bytes) % 8) if len(pwd_bytes) % 8 != 0 else 0
    pwd_padded = pwd_bytes + b"\x00" * pad_len

    encrypted = cipher.encrypt(pwd_padded)
    return base64.b64encode(encrypted).decode()


class AutoRollcall:
    """
    自動點名類別
    1. 訪問 Rollcall 頁面
    2. 自動完成點名
    """

    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        })

    def visit_rollcall(self, rollcall_goto: str | None) -> dict:
        """
        訪問 Rollcall 頁面並完成點名

        Args:
            rollcall_goto: rollcall 的 goto 參數

        Returns:
            dict: 包含 success 狀態和 message 訊息
        """
        logging.info("訪問 Rollcall 頁面")

        rollcall_url = f"https://elearning.nkust.edu.tw/mooc/teach/rollcall/start.php?goto={rollcall_goto}"

        logging.info(f"訪問 Rollcall URL: {rollcall_url}")
        resp = self.session.get(rollcall_url)
        resp.raise_for_status()
        page_content = resp.text

        # 檢查是否直接包含結果文字（不需登入）
        result = self._check_result(page_content)
        if result:
            return result

        # 需要登入：解析表單 action 和隱藏欄位
        logging.info("填寫登入資訊...")

        # 解析 form action
        action_match = re.search(r'<form[^>]*action=["\']([^"\']*)["\']', page_content, re.IGNORECASE)
        form_action = action_match.group(1) if action_match else rollcall_url

        # 若 action 是相對路徑，轉換為絕對路徑
        if form_action and not form_action.startswith("http"):
            form_action = urljoin(rollcall_url, form_action)

        # 解析所有隱藏欄位
        hidden_fields = re.findall(
            r'<input[^>]*type=["\']hidden["\'][^>]*name=["\']([^"\']*)["\'][^>]*value=["\']([^"\']*)["\']',
            page_content, re.IGNORECASE
        )
        # 也處理 name 在 type 前面的情況
        hidden_fields += re.findall(
            r'<input[^>]*name=["\']([^"\']*)["\'][^>]*type=["\']hidden["\'][^>]*value=["\']([^"\']*)["\']',
            page_content, re.IGNORECASE
        )

        form_data = {name: value for name, value in hidden_fields}

        # 前端 JS 會用 DES 加密密碼，伺服器端驗證 encrypt_pwd
        login_key = form_data.get("login_key", "")
        form_data["encrypt_pwd"] = encrypt_password(self.password, login_key)
        form_data["username"] = self.username
        form_data["password"] = self.password

        # 提交登入表單
        resp = self.session.post(form_action, data=form_data)
        resp.raise_for_status()

        # 伺服器用 Refresh header 跳轉（非 302），需手動 follow
        refresh = resp.headers.get("Refresh", "")
        if "URL=" in refresh:
            redirect_url = refresh.split('URL="')[1].rstrip('"')
            logging.info(f"Follow Refresh header: {redirect_url}")
            resp = self.session.get(redirect_url)
            resp.raise_for_status()

        page_content = resp.text

        # 判斷點名結果
        result = self._check_result(page_content)
        if result:
            return result

        logging.warning("⚠️ 無法判斷點名結果")
        return {"success": False, "message": "無法判斷點名結果"}

    def _check_result(self, page_content: str) -> dict | None:
        """檢查頁面是否包含點名結果"""
        if "完成報到" in page_content:
            logging.info("✅ 點名成功：完成報到")
            return {"success": True, "message": "完成報到"}
        if "點名時間已結束" in page_content:
            logging.warning("⚠️ 點名失敗：點名時間已結束")
            return {"success": False, "message": "點名時間已結束"}
        if "請重新掃描" in page_content:
            logging.warning("⚠️ 點名失敗:請重新掃描螢幕上的QRcode圖示")
            return {"success": False, "message": "請重新掃描螢幕上的QRcode圖示"}
        return None

    def run(self, rollcall_goto=None):
        """
        執行完整的自動點名流程

        Args:
            rollcall_goto: rollcall 的 goto 參數

        Returns:
            dict: 包含 success 狀態、message 訊息和 elapsed_time 執行時間（秒）
        """
        start_time = time.time()

        try:
            result = self.visit_rollcall(rollcall_goto)
            elapsed_time = time.time() - start_time
            logging.info(f"⏱️ 總執行時間: {elapsed_time:.2f} 秒")

            return {
                "success": result["success"],
                "message": result["message"],
                "elapsed_time": elapsed_time
            }

        except Exception as e:
            logging.error(f"\n❌ 執行過程發生錯誤: {e}")
            elapsed_time = time.time() - start_time
            logging.info(f"⏱️ 總執行時間: {elapsed_time:.2f} 秒")
            return {"success": False, "message": str(e), "elapsed_time": elapsed_time}

    def close(self):
        """關閉 HTTP session"""
        self.session.close()
        logging.info("HTTP session 已關閉")


def main():
    """主程式"""
    username = os.getenv("USERNAME")
    password = os.getenv("PASSWORD")

    if not username or not password:
        logging.error("❌ 錯誤: 請在 .env 檔案中設定 USERNAME 和 PASSWORD")
        return

    rollcall_goto = "MeFqUN8kZvb5_xwEVC2T5uODl81snEJSATBNaZsAOXl5u0VRYIupsJ9VFc_9gHzjj8ZXR0N0keLm6c6OmhZ82A~~"
    auto_rollcall = AutoRollcall(username, password)

    try:
        result = auto_rollcall.run(rollcall_goto=rollcall_goto)

        if result["success"]:
            logging.info("✅ 自動點名成功！")
        else:
            logging.error("❌ 自動點名失敗，請檢查錯誤訊息")

    finally:
        auto_rollcall.close()


if __name__ == "__main__":
    main()
