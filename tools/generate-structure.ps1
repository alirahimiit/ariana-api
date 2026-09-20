# generate-structure.ps1
# ساختار پروژه رو به صورت درخت تمیز توی structure.md ذخیره می‌کنه

param(
    [string]$RootPath = (Get-Location).Path,
    [string]$OutputFile = "structure.md"
)

# پوشه‌ها و فایل‌هایی که نباید نمایش داده بشن
$excludeNames = @(
    'bin', 'obj', '.vs', '.git', '.idea', '.vscode',
    'node_modules', 'logs', 'TestResults',
    'publish_iis', 'publish_scd', 'publish_service', 'publish'
)

$excludeFiles = @(
    '.gitignore', '.gitattributes', 'structure.md', 'structure.txt',
    '*.user', '*.suo', '*.log'
)

function Test-Excluded {
    param([System.IO.FileSystemInfo]$Item)
    
    if ($excludeNames -contains $Item.Name) { return $true }
    
    foreach ($pattern in $excludeFiles) {
        if ($Item.Name -like $pattern) { return $true }
    }
    return $false
}

function Write-Tree {
    param(
        [string]$Path,
        [string]$Prefix = "",
        [System.Collections.Generic.List[string]]$Lines
    )
    
    $items = Get-ChildItem -Path $Path -Force |
             Where-Object { -not (Test-Excluded $_) } |
             Sort-Object { -not $_.PSIsContainer }, Name
    
    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $items.Count - 1)
        $connector = if ($isLast) { "└── " } else { "├── " }
        $extension = if ($isLast) { "    " } else { "│   " }
        
        $suffix = if ($item.PSIsContainer) { "/" } else { "" }
        $Lines.Add("$Prefix$connector$($item.Name)$suffix")
        
        if ($item.PSIsContainer) {
            Write-Tree -Path $item.FullName -Prefix "$Prefix$extension" -Lines $Lines
        }
    }
}

# ═══════════════════════════════════════════
# اجرا
# ═══════════════════════════════════════════

$projectName = Split-Path $RootPath -Leaf
$lines = [System.Collections.Generic.List[string]]::new()

$lines.Add("# 📁 ساختار پروژه $projectName")
$lines.Add("")
$lines.Add('```')
$lines.Add("$projectName/")
Write-Tree -Path $RootPath -Prefix "" -Lines $lines
$lines.Add('```')

$outputPath = Join-Path $RootPath $OutputFile
$lines | Out-File -FilePath $outputPath -Encoding UTF8

Write-Host "✅ ساختار پروژه در فایل زیر ذخیره شد:" -ForegroundColor Green
Write-Host "   $outputPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "📄 محتوا:" -ForegroundColor Yellow
Get-Content $outputPath