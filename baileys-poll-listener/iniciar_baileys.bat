@echo off
echo ===========================================
echo   Iniciando Servico Whatsapp (Baileys)
echo ===========================================
echo Instalando bibliotecas necessarias...
call npm install
echo.
echo Iniciando conexao...
node index.js
pause
