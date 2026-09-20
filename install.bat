@echo off
echo ========================================
echo  ArianaAPI Service Installation
echo ========================================

sc create ArianaAPI binPath= "%~dp0publish_scd\ArianaAPI.Web.exe" start= auto DisplayName= "ArianaAPI Service"
sc description ArianaAPI "REST API for Ariana Accounting System"
sc start ArianaAPI

netsh advfirewall firewall add rule name="ArianaAPI 18080" dir=in action=allow protocol=TCP localport=18080

echo.
echo ========================================
echo  Installation Completed!
echo  Service is running on http://localhost:18080
echo ========================================
pause