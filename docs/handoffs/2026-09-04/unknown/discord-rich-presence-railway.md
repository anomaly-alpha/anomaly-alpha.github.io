# Handoff: Railway CLI and headless Discord Rich Presence

## Current objective

Continue helping the user run Discord Rich Presence reliably, potentially on a headless Ubuntu server on the user’s network rather than on their Windows workstation.

## Conversation outcome

- Railway CLI was installed globally with npm after the official PowerShell installer failed with an interrupted connection.
- The successful install used npm install -g @railway/cli --foreground-scripts.
- Installed and verified version: railway 5.49.2.
- The user reported logging into Railway in another terminal tab. No Railway project was linked or deployed during this conversation.
- Useful Railway commands already explained include railway whoami, list, link, status, open, up, logs, environment/variable commands, run, shell, domain, service list, redeploy, and restart.

## Key technical conclusions

- Personal Discord Rich Presence requires Discord Desktop and the Rich Presence process on the same host because the standard RPC connection uses local IPC; a LAN connection to Discord on another computer does not work automatically.
- Railway can host a Discord bot and its bot activity, but it cannot access the user’s local Discord Desktop Rich Presence session.
- Windows screen locking should not inherently stop the process. If presence disappears on lock, likely causes are system sleep/hibernate or an RPC connection that needs reconnect handling.
- For Windows background execution, keep the machine awake, start the app at login with Task Scheduler using Run only when the user is logged on, and avoid a Windows service running under another account because it generally cannot access the interactive Discord IPC connection.
- Ubuntu can host both Discord Desktop and the presence client, but a truly headless server needs a virtual graphical display. Discord must be logged in under the same Linux user/session as the presence client.
- A practical headless approach is Discord Desktop plus Xvfb, optionally Fluxbox and x11vnc for the initial login, launched under a dedicated user. Use an SSH tunnel for VNC rather than exposing VNC publicly. Supervise Xvfb, Discord, and the presence app with systemd after manual testing.

## Suggested next steps

1. Ask for or confirm the Ubuntu version, CPU architecture, whether sudo access is available, and the exact Rich Presence app/command and library being used.
2. Install Discord Desktop and the virtual-display dependencies on Ubuntu.
3. Start Xvfb and Discord under a dedicated non-root user; provide temporary VNC access through an SSH tunnel to complete Discord login.
4. Start the Rich Presence client as that same user and verify that it finds Discord’s local IPC socket and publishes the activity.
5. Add systemd services with automatic restart and verify behavior after SSH disconnect, server reboot, and Discord/client restart.
6. If the user only needs a bot status rather than personal Rich Presence, recommend moving the bot process to Railway instead of running Discord Desktop headlessly.

## Important cautions

- Do not print or share Railway/Discord tokens or environment variables.
- Do not expose VNC or Discord’s virtual display directly to the internet.
- Container filesystem changes and manually started background processes are not durable across redeploys/restarts; use systemd and persistent storage only where appropriate.
- Headless Discord Desktop is more fragile than running Discord on an always-on graphical machine; mention this tradeoff before treating it as a production solution.

## Suggested skills

No currently listed skill directly covers Railway CLI or Discord Rich Presence on headless Ubuntu. No Skill-tool call is required unless the next turn expands into Codex CLI automation, browser-based setup, or a formal research task.

## Files touched

- This handoff document only; no application source files were changed.
