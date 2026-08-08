# Discord Rich Presence Setup Guide

Platform-agnostic guide to run Discord Rich Presence in the background.

## Prerequisites

- Node.js 18+ installed
- Discord desktop app running
- Discord Application created (get Application ID from Developer Portal)

## Step 1: Create Project

```bash
mkdir discord-rpc
cd discord-rpc
npm init -y
npm install discord-rpc
```

## Step 2: Create rich-presence.js

Replace `YOUR_APPLICATION_ID` with your actual ID:

```js
const RPC = require('discord-rpc');
const clientId = 'YOUR_APPLICATION_ID';
const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => {
  console.log('Rich Presence connected!');
  rpc.setActivity({
    details: '<+HUSH> ONLINE',
    state: '<+HUSH> AWAITING SIGNAL',
    instance: false,
    type: 0, // 0=Playing, 1=Streaming, 2=Listening, 3=Watching, 5=Competing
    startTimestamp: 1000, // Jan 1, 1970 00:00:01 — timer counts up from here
  });
});

rpc.login({ clientId }).catch(err => {
  console.error('Failed:', err.message);
  console.log('Make sure Discord is running.');
});
```

> **Note:** this example mirrors the activity in the repo's own `rich-presence.js`, but the repo script is **not** parameterized — it hardcodes `clientId: '982308134871765022'` (no env var), so repurposing it for your own application requires editing the source. The "Replace `YOUR_APPLICATION_ID`" instruction above applies only to this standalone template.

## Step 3: Run in Background

### Option A: PM2 (Recommended - All Platforms)

```bash
# Install PM2
npm install -g pm2

# Start (both apps defined in ecosystem.config.js)
pm2 start ecosystem.config.js

# Save for auto-start
pm2 save

# Enable startup (follow instructions)
pm2 startup
```

**PM2 Commands:**
| Command | Description |
|---------|-------------|
| `pm2 start ecosystem.config.js` | Start |
| `pm2 stop skarn-rpc` | Stop |
| `pm2 restart skarn-rpc` | Restart |
| `pm2 status` | Check status |
| `pm2 logs skarn-rpc` | View logs |

### Option B: Screen (Linux/Mac)

```bash
# Start screen session
screen -S rpc

# Run the script
node rich-presence.js

# Detach: Ctrl+A, then D
# Reattach: screen -r rpc
```

### Option C: nohup (Linux/Mac)

```bash
nohup node rich-presence.js > rpc.log 2>&1 &
```

### Option D: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: At log on
4. Action: Start a program
5. Program: `node`
6. Arguments: `C:\path\to\rich-presence.js`

### Option E: systemd (Linux)

Create `/etc/systemd/system/discord-rpc.service`:

```ini
[Unit]
Description=Discord Rich Presence
After=network.target

[Service]
ExecStart=/usr/bin/node /path/to/rich-presence.js
Restart=always
User=your-username

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable discord-rpc
sudo systemctl start discord-rpc
```

### Option F: LaunchAgent (Mac)

Create `~/Library/LaunchAgents/com.discord.rpc.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.discord.rpc</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/rich-presence.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Enable:
```bash
launchctl load ~/Library/LaunchAgents/com.discord.rpc.plist
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Failed to connect" | Make sure Discord is running |
| Status shows "Playing" | Some activity types require valid URLs |
| RPC stops after closing terminal | Use PM2, screen, or nohup |
| Auto-start not working | Run `pm2 save` and `pm2 startup` |
