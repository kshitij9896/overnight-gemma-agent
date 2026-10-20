# Overnight Gemma Agent: Local WhatsApp & Telegram Morning Digest with Google Gemma

*This is a submission for the [Hacktoberfest Open-Source AI Challenge](https://dev.to/challenges).*

---

## What I Built

**Overnight Gemma Agent** is a private, 100% local morning briefing assistant for your WhatsApp and Telegram group chats powered by **Google Gemma (`gemma2:2b`)**.

### The Problem
Every morning, developers, managers, and students wake up to dozens of notifications and 100+ unread messages in team channels and group chats. Reading through all of them takes 20+ minutes of cognitive load, and critical blockers or emergency server issues get buried under casual chit-chat.

Sending confidential company chats or private group conversations to third-party cloud LLM APIs poses huge privacy, compliance, and cost issues.

### The Solution: Overnight Gemma Agent
**Overnight Gemma Agent** monitors selected WhatsApp or Telegram groups overnight while you sleep, collects conversations in a local SQLite database, and at your designated morning hour (e.g., 7:00 AM), runs Google Gemma locally to deliver an executive **Strict Two-Line Digest**:

1. **Line 1 (The Vibe / Core Topic)**: What the group talked about overnight in under 20 words.
2. **Line 2 (Action Items & Blockers)**: Clear, prioritized tasks, deadlines, decisions, or emergency bug fixes.

---

## Key Features

- 🔒 **Zero Data Leakage / 100% Private**: Your chat logs, contacts, and group messages never leave your local machine.
- ⚡ **Local Google Gemma Inference**: Powered by `gemma2:2b` running locally via Ollama with zero API cost and ultra-low latency.
- 📱 **Multi-Platform Support**: Seamless integration for WhatsApp (instant QR code connection via Baileys) and Telegram.
- ⏰ **Morning Scheduler**: Automated delivery schedule (set your morning wake-up time).
- 🧪 **Instant Mock Seed Simulator**: Test group conversations and prompt engineering instantly without waiting overnight.
- 💻 **Clean React + Vite Dashboard**: Real-time connection status, group selector, scheduled time configuration, and interactive digest card.

---

## Architecture & How It Works

```
┌─────────────────────────────────┐      ┌─────────────────────────────┐
│  WhatsApp / Telegram Adapters   │ ───► │  Local SQLite Message Store │
│   (Baileys / Telegram Bot API)  │      │     (overnight_chats.db)    │
└─────────────────────────────────┘      └──────────────┬──────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────┐      ┌─────────────────────────────┐
│      Modern React Dashboard     │ ◄─── │      Gemma 2B Pipeline      │
│  (Vite + Tailwind / Responsive) │      │  (Ollama Local API / 11434) │
└─────────────────────────────────┘      └─────────────────────────────┘
```

### The Gemma Two-Line Extraction Prompt
In `backend/src/agent/gemmaSummarizer.js`, Gemma is configured with deterministic parameters (`temperature: 0.2`, `num_predict: 90`) to eliminate hallucinations and output strictly actionable morning briefings:

```javascript
const prompt = `You are an overnight group chat summarizer agent.
Read the following chat transcript from the group "${groupName}" and output STRICTLY TWO LINES of plain text.
Line 1: Summarize the core discussion or vibe in under 20 words.
Line 2: List any action items, deadlines, decisions, or important links (or write "No action items." if none).
Do NOT include bullet points, bold text, labels like "Line 1:", or greetings.

Chat Transcript:
${chatTranscript}`;
```

---

## How to Run Locally

### 1. Prerequisites
- Node.js v18+
- [Ollama](https://ollama.ai/) installed with Gemma:
  ```bash
  ollama pull gemma2:2b
  ```

### 2. Start Backend Server
```bash
cd backend
npm install
node server.js
```
The backend starts on `http://localhost:4000`.

### 3. Start Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Why Open Innovation & Local Models Matter

Group chats are deeply personal and sensitive. Open-weight models like **Google Gemma** democratize on-device AI:
- **Zero API bills**: Run continuous overnight cron jobs for unlimited groups at $0 marginal cost.
- **Offline Resilience**: Functions even if your external internet connection drops during the night.
- **Complete Data Sovereignty**: Compliance-friendly for workplace internal teams.

---

## My Agent Session

This entire agent architecture, DevRelay connection, and verification was recorded live using **Google Antigravity** and **DevRelay**:

{% agent_session 1072 %}

> 🔗 **Interactive Session Replay**: [View Session on DEV](https://dev.to/agent_sessions/overnight-gemma-agent-local-whatsapp-and-telegram-morning-digest-with-google-gemma-er0j9s)  
> *Recorded with DevRelay in Google Antigravity (Gemini 3.8 Flash)*
