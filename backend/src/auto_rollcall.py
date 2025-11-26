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

    def start_browser(self, headless=False):
        logging.info("啟動瀏覽器...")
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=headless)
        self.page = self.browser.new_page()

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
            logging.info(f"\n尋找登入表單...")
            self.page.locator('#account')

            logging.info("點擊登入按鈕...")
            login_open_btn = self.page.locator('button:has-text("登入")').first
            login_open_btn.click()
            time.sleep(1)
            # 填寫帳號密碼
            logging.info(f"填寫帳號: {self.username}")
            self.page.fill('#account', self.username)

            logging.info(f"填寫密碼")
            self.page.fill('#password', self.password)

            # 點擊登入
            logging.info(f"點擊登入按鈕...")
            login_submit_btn = self.page.locator('button[type="submit"].login-form__button')
            login_submit_btn.click()

            # 等待登入完成
            logging.info(f"等待登入完成...")
            time.sleep(3)
            self.page.wait_for_load_state('networkidle')

            # 檢查是否出現登入失敗彈窗
            login_fail_dialog = self.page.locator('text=登入失敗')
            if login_fail_dialog.is_visible(timeout=2000):
                logging.error("❌ 登入失敗：帳號或密碼錯誤")
                return False

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
        self.page.goto(rollcall_url)
        self.page.wait_for_load_state('networkidle')
        time.sleep(2)

        final_url = self.page.url
        logging.info(f"當前 URL: {final_url}")

        return True

    def run(self, rollcall_goto=None, keep_browser_open=True):
        """
        執行完整的自動點名流程

        Args:
            rollcall_goto: rollcall 的 goto 參數
            keep_browser_open: 是否保持瀏覽器開啟（方便檢查結果）
        """
        try:
            # Step 1: 登入 Moocs
            if not self.login_moocs():
                logging.error("\n❌ 自動點名失敗：無法登入 Moocs")
                return False

            # Step 2: 訪問 Rollcall
            if not self.visit_rollcall(rollcall_goto):
                logging.error("\n❌ 自動點名失敗：無法訪問 Rollcall")
                return False

            logging.info("✅ 自動點名流程完成！")

            # 保持瀏覽器開啟一段時間
            if keep_browser_open:
                logging.info("瀏覽器將保持開啟 3 秒，請檢查結果...")
                time.sleep(3)

            return True

        except Exception as e:
            logging.error(f"\n❌ 執行過程發生錯誤: {e}")
            return False

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
        success = auto_rollcall.run(
            rollcall_goto=rollcall_goto,
            keep_browser_open=True  # 設為 False 可以自動關閉瀏覽器
        )

        if success:
            logging.info("✅ 自動點名成功！")
        else:
            logging.error("❌ 自動點名失敗，請檢查錯誤訊息")

    finally:
        auto_rollcall.close()


if __name__ == "__main__":
    main()
