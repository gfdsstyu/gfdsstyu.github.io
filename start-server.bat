@echo off
echo ========================================
echo 감린이 로컬 개발 서버 시작
echo ========================================
echo.
echo 서버 주소: http://localhost:8000
echo.
echo 종료하려면 Ctrl+C를 누르세요
echo ========================================
echo.

cd /d "%~dp0"
python -m http.server 8000

pause
