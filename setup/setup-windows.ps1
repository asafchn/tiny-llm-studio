# One-click setup for tiny-llm studio on a new Windows machine.
# 1. Makes sure WSL + Ubuntu exist   2. Clones your two repos into Ubuntu
# 3. Runs setup-ubuntu.sh            4. Puts the shortcut on the desktop   5. Starts the studio
# Safe to run again: finished steps are skipped.
param(
    [string]$Owner = 'asafchn',                       # GitHub account that holds both repos
    [string]$GitName = 'Asaf chen',
    [string]$GitEmail = '87265670+asafchn@users.noreply.github.com'  # private noreply address
)
$ErrorActionPreference = 'Stop'
$Distro = 'Ubuntu'

function Step($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Fail($t) { Write-Host "`n$t" -ForegroundColor Yellow; exit 1 }
function In-Wsl([string]$cmd) {
    # wsl.exe mangles multi-line args, so ship the script base64-encoded (LF only)
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($cmd -replace "`r", '')))
    wsl.exe -d $Distro -e bash -lc "echo $b64 | base64 -d | bash -l"
}

Step '1/5 WSL and Ubuntu'
$distros = (wsl.exe -l -q 2>$null) -replace "`0", '' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($distros -notcontains $Distro) {
    Write-Host 'Ubuntu is not installed. Windows will ask for admin permission to install it.'
    Start-Process wsl.exe -ArgumentList "--install -d $Distro" -Verb RunAs -Wait
    Fail @"
Ubuntu is installing. Next:
  1. Restart Windows if it asks you to.
  2. Open 'Ubuntu' from the Start menu once and pick a Linux username and password.
  3. Double-click 'Setup tiny-llm studio.cmd' again. It continues from here.
"@
}
$home_ = (In-Wsl 'echo $HOME' | Select-Object -Last 1).Trim()
if (-not $home_ -or $home_ -eq '/root') { Fail "Open 'Ubuntu' from the Start menu once to create your Linux user, then run this again." }
Write-Host "    Ubuntu user home: $home_"
$uncHome = "\\wsl.localhost\$Distro" + ($home_ -replace '/', '\')

Step '2/5 Your repos (tiny-llm, tiny-llm-studio)'
if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { Fail 'Git for Windows is needed to download your private repos: https://git-scm.com/download/win  Install it, then run this again.' }
# Cloned on Windows, where your GitHub sign-in (SSH key or Git Credential Manager) lives,
# then copied into Ubuntu, so no GitHub credentials are ever stored inside Ubuntu.
$tmp = Join-Path $env:TEMP "tiny-llm-setup-$(Get-Random)"
New-Item -ItemType Directory $tmp | Out-Null
try {
    foreach ($repo in 'tiny-llm', 'tiny-llm-studio') {
        $exists = (In-Wsl "[ -d ~/$repo/.git ] && echo yes || echo no" | Select-Object -Last 1).Trim()
        if ($exists -eq 'yes') { Write-Host "    ~/$repo already there, keeping it"; continue }
        $url = "git@github.com:$Owner/$repo.git"
        Write-Host "    Downloading $Owner/$repo"
        git clone --quiet $url "$tmp\$repo"
        if ($LASTEXITCODE -ne 0) {
            $url = "https://github.com/$Owner/$repo.git"
            git clone --quiet $url "$tmp\$repo"
            if ($LASTEXITCODE -ne 0) { Fail "Couldn't download $Owner/$repo. Sign in to GitHub on this PC (SSH key or Git Credential Manager) and run this again." }
        }
        $winPath = "$tmp\$repo" -replace '\\', '/'
        $mnt = (In-Wsl "wslpath -u '$winPath'" | Select-Object -Last 1).Trim()
        In-Wsl "git clone --quiet '$mnt' ~/$repo && cd ~/$repo && git remote set-url origin '$url' && git config user.name '$GitName' && git config user.email '$GitEmail'"
        Write-Host "    ~/$repo ready"
    }
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

Step '3/5 Ubuntu setup (Python, Node, compiler, app). First run takes 10-20 minutes.'
# Run in this console so sudo can ask for your Linux password.
wsl.exe -d $Distro -e bash -l "$home_/tiny-llm-studio/setup/setup-ubuntu.sh"
if ($LASTEXITCODE -ne 0) { Fail 'Ubuntu setup stopped, see the message above. Fix it and run this again; finished steps are skipped.' }

Step '4/5 Desktop shortcut'
$iconDir = Join-Path $env:LOCALAPPDATA 'tiny-llm-studio'
New-Item -ItemType Directory -Force $iconDir | Out-Null
Copy-Item "$uncHome\tiny-llm-studio\launcher\tiny-llm-studio.ico" "$iconDir\tiny-llm-studio.ico" -Force
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut("$desktop\tiny-llm studio.lnk")
$lnk.TargetPath = "$uncHome\tiny-llm-studio\launcher\Start tiny-llm studio.cmd"
$lnk.IconLocation = "$iconDir\tiny-llm-studio.ico"
$lnk.WindowStyle = 1
$lnk.Description = 'Start tiny-llm studio'
$lnk.Save()
Write-Host "    $desktop\tiny-llm studio.lnk"

Step '5/5 Starting the studio'
& "$uncHome\tiny-llm-studio\launcher\start-studio.ps1"
