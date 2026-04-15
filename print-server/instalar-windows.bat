@echo off
chcp 65001 >nul
title EventPix - Instalador del Servidor de Impresion

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     EventPix - Servidor de Impresion         ║
echo  ║     Instalador Automatico para Windows       ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── 1. Verificar que Node.js esté instalado ──────────────────────
echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ⚠  Node.js NO encontrado.
    echo     Abriendo la pagina de descarga...
    echo     Instala Node.js LTS y luego vuelve a correr este archivo.
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo     ✅ Node.js %NODE_VER% encontrado.

:: ── 2. Ir a la carpeta del script ────────────────────────────────
cd /d "%~dp0"

:: ── 3. Crear .env si no existe ────────────────────────────────────
echo.
echo [2/4] Configurando variables de entorno...
if not exist ".env" (
    echo SUPABASE_URL=https://rmgopwvwljspsremszsz.supabase.co> .env
    echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtZ29wd3Z3bGpzcHNyZW1zenN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MzQ2ODEsImV4cCI6MjA5MTUxMDY4MX0.zCowGXQVzrNqeSCsEqmIlbmHL-JuJ7KSyi6a77agqno>> .env
    echo STATION_NAME=Estacion-Windows>> .env
    echo     ✅ Archivo .env creado.
) else (
    echo     ✅ Archivo .env ya existe.
)

:: ── 4. Instalar dependencias ──────────────────────────────────────
echo.
echo [3/4] Instalando dependencias (puede tardar 1-2 minutos)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Error al instalar dependencias. Verifica tu conexion a internet.
    pause
    exit /b 1
)
echo     ✅ Dependencias instaladas.

:: ── 5. Crear acceso directo en el escritorio ─────────────────────
echo.
echo [4/4] Creando acceso directo en el escritorio...
set SCRIPT_PATH=%~dp0iniciar-servidor.bat
set SHORTCUT_PATH=%USERPROFILE%\Desktop\EventPix Impresion.lnk

:: Crear el script de inicio
echo @echo off > "%~dp0iniciar-servidor.bat"
echo chcp 65001 ^>nul >> "%~dp0iniciar-servidor.bat"
echo title EventPix - Servidor de Impresion >> "%~dp0iniciar-servidor.bat"
echo cd /d "%~dp0" >> "%~dp0iniciar-servidor.bat"
echo echo. >> "%~dp0iniciar-servidor.bat"
echo echo  ✅ EventPix Print Server activo... >> "%~dp0iniciar-servidor.bat"
echo echo  Cerrar esta ventana DETIENE la impresion. >> "%~dp0iniciar-servidor.bat"
echo echo. >> "%~dp0iniciar-servidor.bat"
echo node index.js >> "%~dp0iniciar-servidor.bat"
echo pause >> "%~dp0iniciar-servidor.bat"

:: Crear el acceso directo con PowerShell
powershell -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); ^
   $s.TargetPath = '%~dp0iniciar-servidor.bat'; ^
   $s.WorkingDirectory = '%~dp0'; ^
   $s.WindowStyle = 1; ^
   $s.Description = 'EventPix Servidor de Impresion'; ^
   $s.Save()" 2>nul

echo     ✅ Acceso directo creado en el escritorio.

:: ── 6. Arrancar el servidor ───────────────────────────────────────
echo.
echo ════════════════════════════════════════════════
echo  ✅ Instalacion completa.
echo  🖨  Iniciando el servidor de impresion...
echo ════════════════════════════════════════════════
echo.
echo  ⚡ Para iniciar en el futuro, usa el acceso directo
echo     "EventPix Impresion" del escritorio.
echo.
echo  ❗ NO cierres esta ventana durante el evento.
echo.

node index.js
pause
