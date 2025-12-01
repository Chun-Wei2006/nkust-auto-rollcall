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
    1. 登入 Moocs 網站
    2. 訪問 Rollcall 頁面
    3. 自動完成點名
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

    def login_moocs(self) -> bool:
        """
        登入 Moocs 網站
        """
        if self.page is None:
            raise RuntimeError("Browser not started. Call start_browser() first.")

        target_url = "https://elearning.nkust.edu.tw/moocs/#/home"

        try:
            logging.info(f"步驟 1: 登入 Moocs 網站")

            # 訪問首頁
            logging.info(f"訪問 Moocs 首頁...")
            self.page.goto(target_url)
            self.page.wait_for_load_state('networkidle')
            logging.info(f"✓ 頁面載入完成")

            # 等待登入表單
            logging.info(f"尋找登入表單...")
            self.page.locator('#account')

            logging.info("點擊登入按鈕...")
            login_open_btn = self.page.locator('button:has-text("登入")').first
            login_open_btn.click()

            # 等待登入表單出現
            self.page.wait_for_selector('#account', state='visible', timeout=5000)

            # 填寫帳號密碼
            logging.info(f"填寫帳號: {self.username}")
            self.page.fill('#account', self.username)

            logging.info(f"填寫密碼")
            self.page.fill('#password', self.password)

            # 點擊登入
            logging.info(f"點擊登入按鈕...")
            login_submit_btn = self.page.locator('button[type="submit"].login-form__button')
            login_submit_btn.click()

            # 等待登入完成 - 使用更精確的等待條件
            logging.info(f"等待登入完成...")
            try:
                # 等待登入失敗彈窗或頁面跳轉（最多等 8 秒）
                login_fail_dialog = self.page.locator('text=登入失敗')
                login_fail_dialog.wait_for(state='visible', timeout=3000)
                logging.error("❌ 登入失敗：帳號或密碼錯誤")
                return False
            except:
                # 沒有出現失敗彈窗，代表登入成功
                self.page.wait_for_load_state('domcontentloaded', timeout=10000)
                pass

            logging.info("✓ 登入成功")
            return True

        except Exception as e:
            logging.error(f"❌ 登入過程發生錯誤: {e}")
            return False

    def visit_rollcall(self, rollcall_goto: str | None) -> bool:
        """
        訪問 Rollcall 頁面並完成點名

        Args:
            rollcall_goto: rollcall 的 goto 參數（從 robot.py 中獲取）
        """
        if self.page is None:
            raise RuntimeError("Browser not started. Call start_browser() first.")

        logging.info(f"步驟 2: 訪問 Rollcall 頁面")

        # 構建 rollcall URL
        if rollcall_goto:
            rollcall_url = f"https://elearning.nkust.edu.tw/mooc/teach/rollcall/start.php?goto={rollcall_goto}"
        else:
            # 使用預設 URL
            rollcall_url = "https://elearning.nkust.edu.tw/mooc/teach/rollcall/start.php"

        logging.info(f"訪問 Rollcall URL: {rollcall_url}")
        self.page.goto(rollcall_url, wait_until='domcontentloaded')

        final_url = self.page.url
        logging.info(f"當前 URL: {final_url}")

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
            # Step 1: 登入 Moocs
            login_start = time.time()
            if not self.login_moocs():
                logging.error("\n❌ 自動點名失敗：無法登入 Moocs")
                elapsed_time = time.time() - start_time
                logging.info(f"⏱️ 總執行時間: {elapsed_time:.2f} 秒")
                return {"success": False, "elapsed_time": elapsed_time}
            login_elapsed = time.time() - login_start
            logging.info(f"⏱️ 登入耗時: {login_elapsed:.2f} 秒")

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
