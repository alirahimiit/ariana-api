# ═══ اسکریپت آپدیت خودکار نسخه (نسخه نهایی با Version) ═══
$indexPath = "src\ArianaAPI.Web\wwwroot\index.html"
$today = Get-Date -Format "yyyyMMdd"

# پیدا کردن بیلد امروز
$buildFile = "build_count.txt"
$buildCount = 1
$lastDate = ""

if (Test-Path $buildFile) {
    $content = Get-Content $buildFile
    $lastDate = $content[0]
    $lastBuild = [int]$content[1]
    
    if ($lastDate -eq $today) {
        $buildCount = $lastBuild + 1
    }
}

# ذخیره بیلد جدید
Set-Content -Path $buildFile -Value "$today`n$buildCount"

# تبدیل تاریخ میلادی به شمسی برای نمایش
$pc = New-Object System.Globalization.PersianCalendar
$now = Get-Date
$persianDate = "$($pc.GetYear($now))$('{0:D2}' -f $pc.GetMonth($now))$('{0:D2}' -f $pc.GetDayOfMonth($now))"

# ⭐ استفاده از کلمه انگلیسی Version برای جلوگیری از به‌هم‌ریختگی RTL
$versionString = "Version $persianDate-$buildCount"

# خواندن فایل با UTF-8
$htmlContent = [System.IO.File]::ReadAllText((Resolve-Path $indexPath), [System.Text.Encoding]::UTF8)

# جایگزینی متن‌ها
$htmlContent = $htmlContent -replace '<span id="appVersionText">.*?</span>', "<span id=`"appVersionText`">$versionString</span>"
$htmlContent = $htmlContent -replace '<span id="appVersionTextActivation">.*?</span>', "<span id=`"appVersionTextActivation`">$versionString</span>"

# نوشتن فایل با UTF-8 بدون BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $indexPath), $htmlContent, $utf8NoBom)

Write-Host "Version updated to: $versionString" -ForegroundColor Green