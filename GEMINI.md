# GEMINI Project Context: nkust-auto-rollcall

## Project Overview

This project contains a Python script (`robot.py`) designed to automate the login process for the National Kaohsiung University of Science and Technology (NKUST) e-learning platform (`elearning.nkust.edu.tw`).

The script uses the Playwright library to launch a browser, navigate to the login page, and interact with the form elements. A key feature is its replication of the website's client-side password encryption, which involves a combination of MD5 hashing and DES encryption to securely submit the password.

## Building and Running

### Dependencies

The script relies on the following Python libraries:

*   `playwright`: For browser automation.
*   `pycryptodome`: For DES encryption.

**TODO:** A `requirements.txt` file should be created to formalize these dependencies. For now, they can be installed manually:

```bash
pip install playwright pycryptodome
# Install browser binaries for Playwright
playwright install
```

### Running the Script

The script can be executed directly from the command line:

```bash
python robot.py
```

## Development Conventions

*   **Structure:** All logic is contained within the `robot.py` file. The core automation is encapsulated in the `Robot` class.
*   **Configuration:** User credentials (username and password) are currently hardcoded in the `if __name__ == "__main__":` block. For security and flexibility, this should be refactored to use environment variables or a separate configuration file.
*   **Execution:** The script iterates through a list of user dictionaries and attempts to log in for each one sequentially.
