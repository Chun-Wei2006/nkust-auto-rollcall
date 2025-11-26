# Project Context

## Purpose
NKUST Auto Rollcall (高科大自動點名系統) - An automation tool to help NKUST (National Kaohsiung University of Science and Technology) students automatically complete attendance check-ins on the Moocs e-learning platform.

### Goals
- Automate login to the NKUST Moocs e-learning platform
- Navigate to rollcall pages and complete attendance automatically
- Provide both CLI and API interfaces for flexibility
- Support headless browser mode for server deployment

## Tech Stack
- **Language**: Python 3.x
- **Browser Automation**: Playwright (sync API)
- **Web Framework**: FastAPI (for API endpoint)
- **Encryption**: PyCryptodome (DES encryption for password)
- **Configuration**: python-dotenv (environment variables)

### Key Dependencies
- `playwright==1.56.0` - Browser automation
- `pycryptodome==3.23.0` - DES encryption for login password
- `python-dotenv==1.2.1` - Environment variable management
- `fastapi` - REST API framework (for `/login/` endpoint)

## Project Conventions

### Code Style
- Language: Chinese comments and output messages (Traditional Chinese / 繁體中文)
- Class names: PascalCase (e.g., `AutoRollcall`, `Robot`)
- Method names: snake_case (e.g., `login_moocs`, `visit_rollcall`)
- Constants: UPPER_SNAKE_CASE

### Architecture Patterns
- **Class-based automation**: Each automation flow is encapsulated in a class
- **Separation of concerns**:
  - `robot.py` - Low-level login with DES encryption (legacy/prototype)
  - `auto_rollcall.py` - Higher-level Moocs login + rollcall flow
  - `api.py` - FastAPI REST endpoint wrapper
- **Browser lifecycle**: Start → Execute → Close pattern

### Testing Strategy
- Manual testing with visible browser (headless=False)
- Screenshot capture for verification (success/failure states)
- Error handling with try/catch and status messages

### Git Workflow
- Main branch: `main`
- Commit messages: Descriptive in English

## Domain Context

### NKUST Moocs Platform
- **URL**: `https://elearning.nkust.edu.tw`
- **Login Types**:
  1. Moocs portal login (`#/home` → modal dialog)
  2. Direct legacy login page (uses DES-encrypted password)
- **Rollcall System**: Accessed via `rollcall/start.php` with a `goto` parameter containing an encoded session token

### Login Flow
1. User provides NKUST student credentials (username/password)
2. System encrypts password using DES with MD5-derived key
3. Submits login form to Moocs
4. Navigates to rollcall page using session token
5. Attempts to find and click attendance button

### Key Selectors
- Login form: `#account`, `#password`
- Login button: `button[type="submit"].login-form__button`
- Rollcall buttons: `button:has-text("簽到")`, `button:has-text("點名")`, `button:has-text("確認")`

## Important Constraints
- **Credentials**: Stored in `.env` file (USERNAME, PASSWORD) - never commit
- **Session tokens**: Rollcall `goto` parameter is time-sensitive and course-specific
- **Rate limiting**: Unknown, be conservative with request frequency
- **Browser requirement**: Chromium must be installed via Playwright

## External Dependencies

### NKUST E-Learning Platform
- **Moocs Portal**: `https://elearning.nkust.edu.tw/moocs/`
- **Rollcall System**: `https://elearning.nkust.edu.tw/mooc/teach/rollcall/`
- **Login Authentication**: Uses server-side `login_key` for password encryption

### Environment Variables
| Variable | Description |
|----------|-------------|
| `USERNAME` | NKUST student ID |
| `PASSWORD` | NKUST portal password |
