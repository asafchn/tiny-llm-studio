# Boots WSL, starts tiny-llm studio (book + tutor), opens the browser.
$ErrorActionPreference = 'Stop'
$Distro = 'Ubuntu'
$Port = 3000
$Url = "http://localhost:$Port"

# A free Ubuntu shell in the course folder, for commands while you work.
function Open-Shell {
    if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
        Start-Process wt.exe -ArgumentList "-w new new-tab --title tiny-llm wsl.exe -d $Distro --cd ~/tiny-llm"
    } else {
        Start-Process wsl.exe -ArgumentList "-d $Distro --cd ~/tiny-llm"
    }
}

function In-Wsl([string]$cmd) {
    # wsl.exe mangles multi-line args, so ship the script base64-encoded (LF only)
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($cmd -replace "`r", '')))
    wsl.exe -d $Distro -e bash -lc "echo $b64 | base64 -d | bash -l"
}

Write-Host "Starting WSL ($Distro)..."
In-Wsl 'true' | Out-Null

# Preflight: everything the app needs, with a clear fix for each miss.
$check = @'
export PATH=$HOME/.local/bin:$PATH
miss=0
[ -x ~/tiny-llm/.venv/bin/python ] || { echo "MISSING: Python env (~/tiny-llm/.venv). Run Setup tiny-llm studio.cmd"; miss=1; }
[ -d ~/tiny-llm-studio/node_modules ] || { echo "MISSING: studio app (~/tiny-llm-studio). Run Setup tiny-llm studio.cmd"; miss=1; }
case "$(command -v claude)" in /mnt/*|"") echo "MISSING: Linux Claude Code CLI in WSL (tutor). Run Setup tiny-llm studio.cmd"; miss=1;; esac
claude auth status >/dev/null 2>&1 || echo "NOTE: tutor needs sign-in once: open Ubuntu, run  claude  and log in with your plan"
command -v g++ >/dev/null && command -v cmake >/dev/null || echo "NOTE: no C++ compiler yet, tests can't build: sudo apt install -y build-essential cmake"
# Build the app the first time, and again whenever its source is newer than the build.
cd ~/tiny-llm-studio 2>/dev/null && if [ ! -f .next/BUILD_ID ] || [ -n "$(find app components lib -newer .next/BUILD_ID -print -quit)" ]; then
  echo "Building the app (first run takes a minute)..."; npm run build >/tmp/tiny-llm-studio-build.log 2>&1 || echo "MISSING: app build failed, see /tmp/tiny-llm-studio-build.log"
fi
exit $miss
'@
$report = In-Wsl $check
$report | ForEach-Object { Write-Host $_ }
# wsl.exe doesn't reliably pass the exit code through, so read the report
if ($report -match '^MISSING') { Write-Host "Setup incomplete, see above."; exit 1 }

# Already running? Just open it.
try { Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $Url; Open-Shell; exit 0 } catch {}

Write-Host "Starting studio server..."
$serve = "cd ~/tiny-llm-studio && mkdir -p ~/.tiny-llm-studio && TINY_LLM_DIR=`$HOME/tiny-llm PORT=$Port npm run start > ~/.tiny-llm-studio/server.log 2>&1"
# PowerShell 5.1 doesn't quote ArgumentList items with spaces, so ship the command base64-encoded
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($serve))
Start-Process wsl.exe -WindowStyle Minimized -ArgumentList "-d $Distro -e bash -lc `"echo $b64 | base64 -d | bash -l`""

for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $Url; Open-Shell; Write-Host "Ready: $Url"; exit 0 } catch { Start-Sleep 1 }
}
Write-Host "Server didn't come up in 60 s. Last lines of its log:"
In-Wsl 'tail -n 20 ~/.tiny-llm-studio/server.log'
exit 1
