@echo off
echo ===========================================
echo   INICIANDO TODO O SISTEMA POKE LEILAO
echo ===========================================

echo Iniciando o Servidor do Dashboard (Painel)...
start cmd /k "npm start"

echo Aguardando 3 segundos...
timeout /t 3 /nobreak > nul

echo Iniciando o Servico do Baileys (Ouvinte de Enquetes)...
cd baileys-poll-listener
start cmd /k "iniciar_baileys.bat"

echo Tudo foi iniciado com sucesso em janelas separadas!
pause
