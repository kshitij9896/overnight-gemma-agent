# Overnight Gemma Chat Agent: Frontend

The React dashboard for the Overnight Gemma Chat Agent. It connects your WhatsApp account by QR code, lets you choose which groups to watch and when the morning digest arrives, and shows the two-line summaries that the local Gemma model generates overnight.

The frontend runs in the browser and talks to the backend over HTTP on port 4000. All processing happens on your machine.

---

## Features

- **One-click WhatsApp connection.** When the app loads, it starts a WhatsApp session and shows the QR code to scan (WhatsApp > Linked Devices).
- **Connected banner.** Once the device is linked, the screen confirms the connection and lists your WhatsApp groups.
- **Group selection.** Choose which groups the agent should monitor overnight.
- **Morning delivery time.** Set the time the digest is generated and sent to your Self-DM.
- **Digest dashboard.** View the two-line summaries (Vibe and Action) for each group, plus a preview of the Self-DM message.
- **Simulate button.** Seeds sample overnight chats and runs the local Gemma summarizer, so you can test the pipeline without waiting for real messages.
- **Logout.** Permanently deletes the WhatsApp session, saved chats, and summaries, then shows a new QR code for the next user. A confirmation prompt appears first.
- **Responsive layout.** Works on phones, tablets, laptops, desktops, and large monitors.

---

## Tech stack

| Tool | Purpose |
| --- | --- |
| React 19 | UI components and state |
| Vite 8 | Development server and production build |
| Plain CSS | Styling (no UI framework) |
| Oxlint | Linting |

---

## Requirements

- **Node.js 20 or newer** (the backend's WhatsApp library requires it)
- **npm** (installed with Node.js)
- The **backend** running on `http://localhost:4000` (see the backend README)
- **Ollama** running locally with the `gemma2:2b` model (needed only for the summaries)

---

## Setup

From the `frontend` folder:

```bash
npm install
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`. Open it in your browser.

Start the backend first, so the app can connect when it loads.

---

## Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the development server with hot reload |
| `npm run build` | Creates an optimized production build in `dist/` |
| `npm run preview` | Serves the production build locally for testing |
| `npm run lint` | Runs Oxlint on the source code |

---

## Project structure

```
frontend/
├── index.html                  # Page shell and mobile viewport tag
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── main.jsx                # Entry point, mounts <App /> into #root
│   ├── App.jsx                 # App shell, header, step switching, logout flow
│   ├── api.js                  # All calls to the backend (base URL: localhost:4000)
│   ├── index.css               # Base reset, body and root setup
│   ├── App.css                 # All component styles and responsive breakpoints
│   └── components/
│       ├── AuthAndGroupConfig.jsx  # QR code, connection status, groups, wake-up time
│       └── MorningDigest.jsx       # Digest dashboard, Simulate button, summary cards
└── vite.config.js
```

---

## How the app works

The app has two screens, and the header's Logout button appears once WhatsApp is connected.

1. **Connect and configure (Step 1).** On load, the app calls `POST /api/platform/select` to start WhatsApp. It then polls `GET /api/platform/status` every 2.5 seconds. When a QR code is available it displays it. When the status becomes `CONNECTED`, the app shows the connected banner, the Logout button, and the group list. You then choose groups, set the delivery time, and click **Save Schedule & Open Morning Dashboard**, which calls `POST /api/config/save`.
2. **Digest dashboard (Step 2).** The app loads saved summaries from `GET /api/summaries`. **Simulate Overnight Chats & Summarize Now** seeds sample messages, runs the summarizer, and refreshes the list. **Edit Groups & Time** returns to Step 1.
3. **Logout.** After confirmation, the app calls `POST /api/platform/logout`, which deletes the WhatsApp session and all stored chats and summaries. It then starts a new session and returns to Step 1 with a fresh QR code.

The status polling runs only on Step 1, and it stops when you leave that screen.

---

## Configuration

The backend address is set in `src/api.js`:

```js
const API_BASE = 'http://localhost:4000/api';
```

If you run the backend on another port or machine, change this value. The backend must allow the frontend's origin, which it does by default through the `cors` middleware.

---

## Responsive design

The layout is mobile-first and uses these breakpoints from `App.css`:

| Screen | Width | Layout |
| --- | --- | --- |
| Phones | under 600px | Single column, full-width buttons, QR code scales to the screen |
| Tablets | 600px and up | Two-column group list and digest cards |
| Laptops | 900px and up | Two-column digest cards |
| Desktops | 1280px and up | Wider page, three-column group list |
| Large screens | 1600px and up | Wider page, three-column digest cards |
| Ultra-wide | 2200px and up | Widest page; larger text from 1920px |

Everything is centered on the screen. Buttons and inputs are at least 44px tall for easy touch use.

---

## Troubleshooting

**"Could not start WhatsApp" or "Could not reach the backend"**
The backend isn't running or isn't on port 4000. Start it with `node server.js` in the `backend` folder and check that the terminal shows `Agent Backend running on http://localhost:4000`.

**The QR code never appears**
Check the backend terminal for errors. If WhatsApp rejects an old saved session, stop the backend, delete the `backend/wa_auth_session` folder, and start it again. A new QR code should appear.

**"Summarize failed: Cannot reach Ollama"**
Ollama isn't running. Start it with `ollama serve`, and check that `gemma2:2b` is installed with `ollama list`.

**"Logout failed"**
The backend is down or stopped responding. Restart it, then try Logout again.

**The page is blank**
Open the browser console (F12). Most often a dependency is missing, so run `npm install` again.

---

## Notes

- The app is built for a single user on a single machine. The Logout button clears all data for that user.
- Chat data is stored on the backend, not in the browser. Nothing is saved in `localStorage`.
