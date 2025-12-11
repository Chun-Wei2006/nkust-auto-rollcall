"""
NKUST 自動點名系統
先登入 Moocs 網站，然後自動訪問 Rollcall 頁面完成點名
"""
import os
import time
import logging
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Playwright, Browser, Page

load_dotenv(override=True)
logging.basicConfig(level=logging.INFO) 

class AutoRollcall:
    """
    自動點名類別
    1. 訪問 Rollcall 頁面
    2. 自動完成點名
    """

    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.playwright: Playwright | None = None
        self.browser: Browser | None = None
        self.page: Page | None = None

    def start_browser(self, headless=True):
        logging.info("啟動瀏覽器...")
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(
            headless=headless,
            args=[
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--no-sandbox',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
            ]
        )
        # 建立輕量化頁面，阻擋不必要的資源
        self.page = self.browser.new_page()
        self.page.route("**/*.{png,jpg,jpeg,gif,webp,svg,ico}", lambda route: route.abort())
        self.page.route("**/*.{woff,woff2,ttf,otf}", lambda route: route.abort())

    def visit_rollcall(self, rollcall_goto: str | None) -> bool:
        """
        訪問 Rollcall 頁面並完成點名

        Args:
            rollcall_goto: rollcall 的 goto 參數
        """
        if self.page is None:
            raise RuntimeError("Browser not started. Call start_browser() first.")

        logging.info(f"步驟 2: 訪問 Rollcall 頁面")

        # 構建 rollcall URL
        rollcall_url = f"https://elearning.nkust.edu.tw/mooc/teach/rollcall/start.php?goto={rollcall_goto}"

        logging.info(f"訪問 Rollcall URL: {rollcall_url}")
        self.page.goto(rollcall_url, wait_until='domcontentloaded')
        self.page.wait_for_load_state('networkidle')

        # 填寫登入資訊
        logging.info("填寫登入資訊...")
        self.page.fill('#username', self.username)
        self.page.fill('#password', self.password)
        self.page.click("text=登入")

        return True

    def run(self, rollcall_goto=None):
        """
        執行完整的自動點名流程

        Args:
            rollcall_goto: rollcall 的 goto 參數

        Returns:
            dict: 包含 success 狀態和 elapsed_time 執行時間（秒）
        """

        start_time = time.time()

        try:
            # Step 2: 訪問 Rollcall
            rollcall_start = time.time()
            if not self.visit_rollcall(rollcall_goto):
                logging.error("\n❌ 自動點名失敗：無法訪問 Rollcall")
                elapsed_time = time.time() - start_time
                logging.info(f"⏱️ 總執行時間: {elapsed_time:.2f} 秒")
                return {"success": False, "elapsed_time": elapsed_time}
            rollcall_elapsed = time.time() - rollcall_start
            logging.info(f"⏱️ 點名頁面耗時: {rollcall_elapsed:.2f} 秒")

            elapsed_time = time.time() - start_time
            logging.info(f"✅ 自動點名流程完成！")
            logging.info(f"⏱️ 總執行時間: {elapsed_time:.2f} 秒")
            return {"success": True, "elapsed_time": elapsed_time}

        except Exception as e:
            logging.error(f"\n❌ 執行過程發生錯誤: {e}")
            elapsed_time = time.time() - start_time
            logging.info(f"⏱️ 總執行時間: {elapsed_time:.2f} 秒")
            return {"success": False, "elapsed_time": elapsed_time}

    def close(self):
        """關閉瀏覽器"""
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
        logging.info("瀏覽器已關閉")


def main():
    """主程式"""
    # 從環境變數讀取帳號密碼
    username = os.getenv("USERNAME")
    password = os.getenv("PASSWORD")

    if not username or not password:
        logging.error("❌ 錯誤: 請在 .env 檔案中設定 USERNAME 和 PASSWORD")
        return

    rollcall_goto = "MeFqUN8kZvb5_xwEVC2T5uODl81snEJSATBNaZsAOXl5u0VRYIupsJ9VFc_9gHzjj8ZXR0N0keLm6c6OmhZ82A~~"

    # 建立自動點名實例
    auto_rollcall = AutoRollcall(username, password)

    try:
        # 啟動瀏覽器
        auto_rollcall.start_browser(headless=False)

        # 執行自動點名
        result = auto_rollcall.run(rollcall_goto=rollcall_goto)

        if result["success"]:
            logging.info("✅ 自動點名成功！")
        else:
            logging.error("❌ 自動點名失敗，請檢查錯誤訊息")

    finally:
        auto_rollcall.close()


if __name__ == "__main__":
    main()
