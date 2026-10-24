# Overnight Gemma Chat Agent: Backend

The Node.js server behind the Overnight Gemma Chat Agent. It connects to WhatsApp, collects messages from the groups you choose, stores them in a local SQLite database, asks a local Gemma model (through Ollama) to summarize each group, and sends the morning digest to your WhatsApp Self-DM.

All data stays on your machine. The only outside connection is WhatsApp itself, and the summarizer talks to Ollama on `127.0.0.1`.

---

## Features

- **WhatsApp connection** through the Baileys library. The server generates a QR code, and the session is saved on disk so you don't have to rescan on every start.
- **Group message capture.** Only group messages are stored. Short messages (under 3 characters) are dropped to reduce noise.
- **Group filtering.** If you select groups in the frontend, only those groups are saved. If none are selected, all group messages are saved.
- **Local summarization.** Each group's unsummarized messages are sent to `gemma2:2b` through Ollama. The model returns exactly two lines: a short summary and any action items.
- **Scheduled digest.** A cron job runs the summarizer every day at the time you choose (default 07:00).
- **Self-DM delivery.** The combined digest is sent to your own WhatsApp chat once the device is connected.
- **Full logout.** Disconnects WhatsApp, deletes the saved session, and permanently deletes all stored messages and summaries. The database file is compacted afterward so deleted data isn't left on disk.

---

## Tech stack

| Package | Purpose |
| --- | --- |
| `express` 5 | HTTP API |
| `cors` | Allows the frontend to call the API from another port |
| `@whiskeysockets/baileys` 7.0.0-rc14 | WhatsApp Web connection |
| `qrcode` | Converts the WhatsApp QR string into an image |
| `sqlite3` | Local database |
| `node-cron` | Daily scheduled digest |

---

## Requirements

- **Node.js 20 or newer**
- **Ollama** installed and running, with the `gemma2:2b` model
- A WhatsApp account you can link as a device (WhatsApp > Linked Devices)

---

## Setup

### 1. Install dependencies

From the `backend` folder:

```bash
npm install
```

If the `telegram` package is still listed in `package.json` from an earlier version, remove it. Telegram support has been removed:

```bash
npm uninstall telegram
```

Optional: for `.env` file support (see **Security** below), install `dotenv`:

```bash
npm install dotenv
```

The server works fine without it; it just won't read a `.env` file, and will use the built-in defaults or environment variables set directly in your shell.

### 2. Prepare Ollama

Install Ollama from [ollama.com](https://ollama.com), then pull the model:

```bash
ollama pull gemma2:2b
ollama serve
```

Ollama listens on port `11434` by default. Keep `ollama serve` running while you use the agent. Check the installed models with:

```bash
ollama list
```

You can also confirm the Ollama server responds:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

### 3. Start the server

```bash
node server.js
```

You should see:

```
Agent Backend running on http://localhost:4000
```

To use a different port, set the `PORT` environment variable. The frontend must then be updated to match (see the frontend README).

---

## Available scripts

| Command | What it does |
| --- | --- |
| `npm start` | Runs `node server.js` |

---

## Project structure

```
backend/
├── server.js                       # Express app, all API routes, port setup
├── package.json
├── overnight_chats.db              # SQLite database (created on first run)
├── wa_auth_session/                # Saved WhatsApp session (created when connected, deleted on logout)
└── src/
    ├── adapters/
    │   ├── BaseAdapter.js          # Shared adapter interface
    │   ├── WhatsAppAdapter.js      # WhatsApp connection, QR code, group capture, Self-DM, logout
    │   └── PlatformManager.js      # Holds the active adapter, group filter, logout and digest delivery
    ├── agent/
    │   ├── scheduler.js            # Daily cron job and the digest pipeline
    │   └── gemmaSummarizer.js      # Calls Ollama and returns the two summary lines
    └── db/
        └── sqlite.js               # Database tables, message and summary helpers, data purge
```

---

## Database

The database is `overnight_chats.db`, created in the `backend` folder on first run.

**`messages`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `platform` | TEXT | Currently always `whatsapp` |
| `group_id` | TEXT | WhatsApp group JID |
| `group_name` | TEXT | Group subject at the time of capture |
| `sender` | TEXT | Display name of the sender |
| `content` | TEXT | Message text |
| `timestamp` | INTEGER | Message time in milliseconds |
| `summarized` | INTEGER | `0` = waiting for summary, `1` = already summarized |

**`summaries`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `platform` | TEXT | Platform of the group |
| `group_name` | TEXT | Group name |
| `line_one` | TEXT | Vibe: a short summary of the discussion |
| `line_two` | TEXT | Action: action items, deadlines, or decisions |
| `created_at` | DATETIME | Set automatically |

---

## API reference

All routes are under `http://localhost:4000`. Request and response bodies are JSON.

| Method | Route | Body | Returns |
| --- | --- | --- | --- |
| GET | `/` | none | Plain text confirming the server is running |
| POST | `/api/platform/select` | `{ "platform": "whatsapp" }` | Current status (starts a new WhatsApp session and QR code) |
| GET | `/api/platform/status` | none | `{ status, platform, qrCode, groups, monitoredGroups }` |
| POST | `/api/platform/logout` | none | Status after logout. Deletes the session, messages, and summaries |
| POST | `/api/config/save` | `{ "groupIds": [...], "hour": 7, "minute": 0 }` | `{ monitoredGroups, schedule }` |
| POST | `/api/mock/seed` | `{ "platform": "whatsapp" }` | Inserts 5 sample messages across 2 groups for testing |
| POST | `/api/summarize/run-now` | none | `{ generated: { generated: [...], dmStatus } }` |
| GET | `/api/summaries` | none | The 30 most recent summaries, newest first |

**Status values** returned by `/api/platform/status`:

| Status | Meaning |
| --- | --- |
| `AWAITING_AUTH` | Waiting for the QR code to be scanned |
| `CONNECTED` | WhatsApp is linked and receiving messages |
| `DISCONNECTED` | No active session |

Errors return HTTP `500` with `{ "error": "message" }` from the select, logout, run-now, and summaries routes. The other routes don't catch errors, so a failure there returns a generic server error page.

---

## How the pipeline works

1. **Capture.** WhatsApp sends group messages to the adapter. Each message passes through the group filter and is saved with `summarized = 0`. Messages shorter than 3 characters are dropped.
2. **Schedule.** The cron job runs at the time set by `/api/config/save`. You can also trigger it manually with `/api/summarize/run-now`.
3. **Summarize.** For each group with unsummarized messages, the server sends the last 6,000 characters of the transcript to Ollama. The prompt asks for exactly two lines. Each line is saved to `summaries`, and the group's messages are marked as summarized.
4. **Deliver.** The combined digest is sent to your WhatsApp Self-DM if the device is connected. If it isn't, the digest is still saved, and the response says the Self-DM was not sent.

---

## Logout behavior

`POST /api/platform/logout` does the following:

1. Asks WhatsApp to unlink the device, and closes the socket. This also removes the device from your phone's Linked Devices list.
2. Deletes the `wa_auth_session` folder.
3. Clears the selected groups in memory.
4. Deletes all rows from `messages` and `summaries`, resets their ID counters, and runs `VACUUM` so the deleted data isn't left in the database file.

After logout, the frontend starts a new session, so the next user sees a fresh QR code.

---

## Configuration

| Setting | Where | Default |
| --- | --- | --- |
| Server port | `PORT` environment variable | `4000` |
| Ollama address | `OLLAMA_URL` in `src/agent/gemmaSummarizer.js` | `http://127.0.0.1:11434/api/generate` |
| Summary model | `MODEL` in `src/agent/gemmaSummarizer.js` | `gemma2:2b` |
| Digest time | Set from the frontend, or `this.cronExpression` in `scheduler.js` | `0 7 * * *` (07:00 daily) |
| Transcript size | `.slice(-6000)` in `gemmaSummarizer.js` | 6,000 characters |

The `.env` file is loaded automatically if the optional `dotenv` package is installed (see **Setup**). Otherwise, set these as regular environment variables before starting the server, or rely on the defaults.

---

## Security

This server has **no login system** — anyone who can reach it over the network can read your summaries, change settings, or log you out. By default it's locked down for safe local use:

| Protection | Default | Purpose |
| --- | --- | --- |
| Network binding | `127.0.0.1` only | Only this machine can reach the API, even on a shared Wi-Fi network |
| CORS allow-list | Vite's dev/preview ports only | Other websites open in your browser can't call this API |
| Mock/seed route | Disabled when `NODE_ENV=production` | Prevents strangers from injecting fake messages if the API is ever exposed |
| Input validation | On `/api/config/save` | Rejects malformed `hour`/`minute`/`groupIds` values |
| `.gitignore` | Excludes `.env`, `wa_auth_session/`, `*.db` | Keeps secrets and chat data out of version control |

### Configuration

Copy `.env.example` to `.env` to customize these (requires the optional `dotenv` package — see **Setup** above). Without `dotenv` installed, you can still set the same values as regular environment variables before starting the server.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | Port the API listens on |
| `HOST` | `127.0.0.1` | Network interface to bind to. Only change to `0.0.0.0` if you deliberately want other devices to reach it |
| `FRONTEND_ORIGINS` | Vite's default ports | Comma-separated list of origins allowed to call the API |
| `NODE_ENV` | unset (development) | Set to `production` to disable the `/api/mock/seed` test route |

### If you want to expose this beyond your own machine

The defaults above assume you're the only person using the app on your own computer, which matches how this project is meant to be used. If you ever deploy it so other people or other devices can reach it, you would additionally need:

- An authentication layer (e.g., an API key or login) in front of every route
- HTTPS, since the API currently runs over plain HTTP
- Rate limiting, to stop repeated logout/summarize calls from being abused
- A WhatsApp session per user, since this server supports only one session at a time

These aren't implemented, since they're unnecessary complexity for local, single-user use.

---

## Troubleshooting

**The QR code never appears, and the terminal shows `Connection Failure`**
WhatsApp rejected a saved session. Stop the server, delete the `wa_auth_session` folder, and start it again.

**`[select] failed` in the terminal**
The WhatsApp adapter failed to start. Read the error message after it. Usually this means a missing dependency. Run `npm install` again.

**`Cannot reach Ollama at http://127.0.0.1:11434/api/generate`**
Ollama isn't running. Start it with `ollama serve`.

**`Ollama returned 404` with a message about the model**
The model isn't installed. Run `ollama pull gemma2:2b`.

**The Self-DM was not sent**
The WhatsApp device isn't connected. The digest is still saved and shows in the dashboard.

**`EADDRINUSE` when starting**
Another program is using port 4000. Stop it, or set a different `PORT` and update the frontend.

**Messages don't appear in the digest**
Make sure you selected the groups in the frontend and saved the schedule. Messages from unselected groups are not stored.

---

## Known limitations

- **Unofficial WhatsApp library.** Baileys reverse-engineers WhatsApp Web, so WhatsApp can change its protocol and break the connection. Keep the dependency updated, and expect occasional breakage.
- **Single session.** The server supports one active WhatsApp session at a time.
- **Race on marking messages.** Messages that arrive while a summary is being written can be marked as summarized without being included. This is rare, but it's a known gap.
- **Pre-release dependency.** The `7.0.0-rc14` release of Baileys is a pre-release. Switching to the stable 6.x line is an option if the connection becomes unreliable.
- **No authentication.** The API has no login. Run it on a machine you control, and don't expose port 4000 to a network.
