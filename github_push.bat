@echo off
chcp 65001 > nul
echo ===================================================
echo   GitHub Auto-Push
echo ===================================================

:: HIER DEINE GITHUB REPO URL EINTRAGEN:
set REPO_URL=https://github.com/Lazarus132/rml-builder.git

:: Namens-Registrierung (verhindert den "Author identity unknown" Fehler)
git config --global user.email "Lazarus132@users.noreply.github.com"
git config --global user.name "Lazarus132"

:: Git initialisieren falls noch nicht geschehen
if not exist ".git" (
    echo [*] Initialisiere Git Repository...
    git init
    git branch -M main
    git remote add origin %REPO_URL%
)

echo [*] Fuege alle Dateien hinzu...
git add .

echo [*] Erstelle Backup-Commit...
git commit -m "Auto-Update: %date% %time%"

echo [*] Lade Dateien zu GitHub hoch...
git push -u origin main --force

echo.
echo ===================================================
echo   Fertig! Alle Dateien wurden hochgeladen.
echo ===================================================
pause