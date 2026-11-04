param(
    [string]$Profile = ''
)

$ErrorActionPreference = 'Stop'

# 自动定位 web profile：优先 $env:DSH_HOME，其次 ~/.dsh
if (-not $Profile) {
    $home = $env:DSH_HOME
    if (-not $home) { $home = Join-Path $env:USERPROFILE '.dsh' }
    $candidates = @(
        (Join-Path $home 'profiles\web'),
        (Join-Path $home 'data\profiles\web'),
        (Join-Path $env:USERPROFILE '.dsh\profiles\web')
    ) | Select-Object -Unique
    $Profile = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (-not $Profile -or -not (Test-Path $Profile)) {
    throw "找不到 web profile。请先启动过一次 DSH，或用 -Profile 指定路径。"
}

$source = Split-Path $PSScriptRoot -Parent
$dest = Join-Path $Profile 'node_modules\dsh-goal-board'

New-Item -ItemType Directory -Force -Path (Join-Path $dest 'lib') | Out-Null
Copy-Item (Join-Path $source 'package.json') $dest -Force
Copy-Item (Join-Path $source 'cordis.patch.yml') $dest -Force
Copy-Item (Join-Path $source 'README.md') $dest -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $source 'LICENSE') $dest -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $source 'lib\*') (Join-Path $dest 'lib') -Recurse -Force

$patch = Join-Path $Profile 'cordis.patch.yml'
if (-not (Test-Path $patch)) {
    Set-Content -Path $patch -Value '# dsh profile patch' -Encoding utf8
}

$content = Get-Content $patch -Raw
if ($content -notmatch 'dsh-goal-board') {
    Add-Content -Path $patch -Value "`n- insert:`n    - id: goal-board`n      name: dsh-goal-board`n" -Encoding utf8
    Write-Host "已注册到 cordis.patch.yml"
} else {
    Write-Host "cordis.patch.yml 中已存在 dsh-goal-board"
}

Write-Host "已安装到 $dest"
Write-Host "重启 DSH（或刷新页面）后，左侧栏会出现「看板」入口。"
