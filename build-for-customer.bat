@echo off
echo [1/2] Publishing...
if exist "C:\ArianaAPI-New" rmdir /s /q "C:\ArianaAPI-New"

echo Updating Version...
powershell -ExecutionPolicy Bypass -File update-version.ps1

dotnet publish src\ArianaAPI.Web -c Release -o C:\ArianaAPI-New

echo [2/2] Zipping...
if exist "ArianaAPI-Update.zip" del "ArianaAPI-Update.zip"
powershell -command "Compress-Archive -Path 'C:\ArianaAPI-New\*' -DestinationPath 'ArianaAPI-Update.zip' -Force"

echo.
echo ========================================
echo Done! File ArianaAPI-Update.zip is ready.
echo Send this ZIP to the customer.
echo ========================================
pause