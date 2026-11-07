# tiny-llm studio

A local web UI for [skyzh/tiny-llm](https://github.com/skyzh/tiny-llm): read the book, edit your code, run the day's tests and chat with a hint-only tutor (Claude Code on your own plan, Sonnet, medium effort). Runs in Ubuntu on WSL and listens only on `127.0.0.1:3000`.

## New PC: one-time setup

1. Install [Git for Windows](https://git-scm.com/download/win) and sign in to GitHub on the PC (SSH key or Git Credential Manager), since both repos are private.
2. Download this repo anywhere, for example:
   ```
   git clone git@github.com:asafchn/tiny-llm-studio.git
   ```
3. Double-click **`Setup tiny-llm studio.cmd`**.
   - If Ubuntu isn't installed, it installs it (admin prompt). Restart if asked, open **Ubuntu** from the Start menu once to choose a Linux username and password, then double-click the setup again.
   - It asks for your Linux password once, for the compiler packages.
   - The first run takes 10–20 minutes.
4. When the browser opens, go to **Setup** and do the one step left: sign in to Claude for the tutor.

After that, use the **tiny-llm studio** shortcut on the desktop. The folder you downloaded in step 2 is no longer needed: the studio runs from its copy inside Ubuntu (`~/tiny-llm-studio`), next to the course (`~/tiny-llm`).

## What setup installs

Everything is pinned, and every download is checked before it is used:

| What | Version | How it's checked |
|---|---|---|
| uv | 0.13.7 | SHA256 in `setup/setup-ubuntu.sh` |
| Node.js | 22.23.4 | SHA256 in `setup/setup-ubuntu.sh` |
| Python | 3.12.16 | installed by uv |
| Python packages (mlx-cpu, torch CPU, …) | `python-requirements.lock.txt` | every file hash-pinned (`--require-hashes`) |
| npm packages | `package-lock.json` | `npm ci`, integrity hashes, install scripts off (`.npmrc`) |
| Claude Code (tutor) | 2.1.319 | Anthropic's npm package |
| build-essential, cmake, git | Ubuntu's | apt |

Telemetry is off: Next.js telemetry is disabled at setup, and the tutor runs Claude Code with analytics and error reports turned off. Only the tutor conversation goes to Anthropic.

## Layout

- `app/`, `components/`, `lib/`: the Next.js app
- `launcher/`: `Start tiny-llm studio.cmd` (what the desktop shortcut runs) and the icon
- `setup/`: the one-click setup (`setup-windows.ps1` → `setup-ubuntu.sh`)
- `tutor-skill/tiny-llm-tutor/`: the tutor's rules, copied into `~/tiny-llm/.claude/skills/` at setup
- `python-requirements.in` / `.lock.txt`: the course's Python environment

Don't use `pdm install` / `pdm run` in the course: it would replace the pinned environment with older, vulnerable versions. The studio's buttons do the same jobs.

## Saving your course progress

Your solutions live in the separate private repo `asafchn/tiny-llm`. Open `\\wsl.localhost\Ubuntu\home\<you>\tiny-llm` in VS Code, then commit and sync from Source Control.
