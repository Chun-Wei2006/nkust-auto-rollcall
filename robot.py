import time
import hashlib
import base64
import os
from dotenv import load_dotenv
from Crypto.Cipher import DES
from Crypto.Util.Padding import pad
from playwright.sync_api import sync_playwright, expect

load_dotenv(override=True)

class Robot:
    """
    A class to automate login to elearning.nkust.edu.tw.
    """
    
    def __init__(self, username, password):
        """
        Initializes the Robot with username and password.
        """
        self.username = username
        self.password = password
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=False)
        self.page = self.browser.new_page()

    @staticmethod
    def calc_encrypt_pwd(password, login_key):
        """
        Encrypts the password using DES and Base64, similar to the login.js logic.
        """
        md5key = hashlib.md5(password.encode()).hexdigest()
        cypkey = (md5key[:4] + login_key[:4]).encode()
        key = cypkey.ljust(8, b'0')[:8]
        cipher = DES.new(key, DES.MODE_ECB)
        encrypted = cipher.encrypt(pad(password.encode(), 8))
        return base64.b64encode(encrypted).decode()

    def login(self):
        """
        Performs the login process.
        """
        rollcallGoto = "MeFqUN8kZvb5_xwEVC2T5uODl81snEJSATBNaZsAOXlVxx55Oc4rpZ9VFc_9gHzjj8ZXR0N0keIIIgdD15C-rA~~"
        login_url = f"https://elearning.nkust.edu.tw/mooc/teach/rollcall/login.php?goto={rollcallGoto}"

        try:
            print(f"--- Logging in for user: {self.username} ---")
            # Step 2: 前往登入頁面
            print("Navigating to login page...")
            self.page.goto(login_url)

            # Step 3: 取得 login_key
            print("Waiting for login_key...")
            login_key_input = self.page.locator('input[name="login_key"]')
            self.page.wait_for_selector('input[name="login_key"]', state='attached')
            login_key = login_key_input.get_attribute('value')
            print(f"Got login_key: {login_key}")

            # Step 4: 計算 encrypt_pwd
            encrypt_pwd = self.calc_encrypt_pwd(self.password, login_key)
            print(f"Calculated encrypt_pwd: {encrypt_pwd}")

            # Step 5: 填寫表單
            print("Filling out login form...")
            self.page.fill('input[name="username"]', self.username)
            self.page.fill('input[name="password"]', self.password)
            self.page.evaluate(f'document.querySelector("input[name=\'encrypt_pwd\']").value = "{encrypt_pwd}";')
            print("Filled form fields.")

            # Step 6: 點擊登入按鈕
            print("Clicking login button...")
            login_button = self.page.locator('div.button-login:has-text("登入")')
            login_button.click()
            print("Login button clicked.")

            # Step 7: 檢查登入結果
            print("Waiting for page to load after login attempt...")
            self.page.wait_for_load_state('networkidle')

            try:
                error_div = self.page.locator('div.alert.alert-error:has-text("對不起！您輸入的帳號或密碼不正確！")')
                expect(error_div).to_be_visible(timeout=5000)
                print("登入錯誤：帳號或密碼不正確！(Error message found)")
                error_html = error_div.evaluate("element => element.outerHTML")
                print("\n--- Error Div HTML ---")
                print(error_html)
                print("----------------------\n")

            except Exception:
                print("Login status: Did not find the specific error message div.")
                final_url = self.page.url
                print(f"Final URL is: {final_url}")
                if "account_use.php" in final_url:
                    print("Login might be successful.")
                else:
                    print("Login failed, but the expected error message was not detected.")

        except Exception as e:
            print(f"An error occurred for user {self.username}: {e}")

    def close(self):
        """
        Closes the browser and stops Playwright.
        """
        print("Closing browser in 0 seconds...")
        time.sleep(0)
        self.browser.close()
        self.playwright.stop()
        print(f"--- Session closed for user: {self.username} ---")


if __name__ == "__main__":
    # Get username and password from environment variables
    username = os.getenv("USERNAME")
    password = os.getenv("PASSWORD")

    if not username or not password:
        print("Error: USERNAME and PASSWORD must be set in the .env file.")
    else:
        print(username, password)
        robot = Robot(username, password)
        robot.login()
        robot.close()