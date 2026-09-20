@echo off
echo Uninstalling ArianaAPI...
sc stop ArianaAPI
sc delete ArianaAPI
netsh advfirewall firewall delete rule name="ArianaAPI 18080"
echo Done.
pause