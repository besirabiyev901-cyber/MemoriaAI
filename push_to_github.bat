@echo off
setlocal
echo ===================================================
echo Pushing Memoria AI to GitHub
echo ===================================================

set "GIT_CMD=C:\Users\Asus\AppData\Local\GitHubDesktop\app-3.6.6\resources\app\git\cmd\git.exe"
if not exist "%GIT_CMD%" (
  set "GIT_CMD=git"
)

cd /d "%~dp0"

echo [1/5] Initializing Git repository...
"%GIT_CMD%" init

echo [2/5] Setting up remote repository...
"%GIT_CMD%" remote remove origin 2>nul
"%GIT_CMD%" remote add origin https://github.com/Bashir-Abiyev/Memoria-ai.git
"%GIT_CMD%" branch -M main

echo [3/5] Staging files (protecting secret keys with .gitignore)...
"%GIT_CMD%" add .

echo [4/5] Committing changes...
"%GIT_CMD%" commit -m "feat: complete UI/UX Pro Max redesign of Memoria AI"

echo [5/5] Pushing to main branch...
"%GIT_CMD%" push -u origin main

if %ERRORLEVEL% EQU 0 (
  echo.
  echo [SUCCESS] Successfully pushed to https://github.com/Bashir-Abiyev/Memoria-ai.git!
) else (
  echo.
  echo [NOTE] If this is your first push or authentication is required, GitHub may prompt for login or personal access token.
)

pause
