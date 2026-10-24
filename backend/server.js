const express = require('express');
const cors = require('cors');

// Load .env if present and the optional "dotenv" package is installed.
// This is wrapped in try/catch so the server still runs fine without it,
// using whatever environment variables are already set (or the defaults below).
try {
  require('dotenv').config();
} catch {
  // dotenv not installed - that's fine, PORT/HOST/etc. fall back to defaults
}

const platformManager = require('./src/adapters/PlatformManager');
const scheduler = require('./src/agent/scheduler');
const { db, saveMessage } = require('./src/db/sqlite');

const app = express();
const PORT = process.env.PORT || 4000;
// Bind to localhost only by default, so the API isn't reachable from other
// devices on the network. Set HOST=0.0.0.0 explicitly if you need that.
const HOST = process.env.HOST || '127.0.0.1';
const isProduction = process.env.NODE_ENV === 'production';

// Only the frontend's own origin(s) may call this API. Vite's default dev
// port (5173) and preview port (4173) are allowed out of the box; add more
// with a comma-separated FRONTEND_ORIGINS env var, e.g.
// FRONTEND_ORIGINS=http://localhost:5173,http://192.168.1.20:5173
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Middleware
app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (curl, server-to-server, mobile webviews)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

// Base Route
app.get('/', (req, res) => {
  res.send('Agent Backend server is running!');
});

// 1. Select Platform (WhatsApp or Telegram)
app.post('/api/platform/select', async (req, res) => {
  try {
    const status = await platformManager.selectPlatform(req.body.platform);
    res.json(status);
  } catch (err) {
    console.error('[select] failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Poll connection status, QR code, and available groups
app.get('/api/platform/status', (req, res) => {
  res.json(platformManager.getStatus());
});

// Logout: disconnect, delete the saved session data, and clear in-memory state
app.post('/api/platform/logout', async (req, res) => {
  try {
    const status = await platformManager.logout();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Save monitored groups & morning delivery time
app.post('/api/config/save', (req, res) => {
  const { groupIds, hour, minute } = req.body;

  if (groupIds !== undefined && !Array.isArray(groupIds)) {
    return res.status(400).json({ error: 'groupIds must be an array' });
  }

  const h = hour ?? 7;
  const m = minute ?? 0;
  if (!Number.isInteger(h) || h < 0 || h > 23) {
    return res.status(400).json({ error: 'hour must be an integer between 0 and 23' });
  }
  if (!Number.isInteger(m) || m < 0 || m > 59) {
    return res.status(400).json({ error: 'minute must be an integer between 0 and 59' });
  }

  const groups = platformManager.setMonitoredGroups(groupIds || []);
  const time = scheduler.setMorningTime(h, m);
  res.json({ monitoredGroups: groups, ...time });
});

// 4. Seed realistic overnight group messages for instant testing with Gemma.
// Disabled when NODE_ENV=production, since it lets anyone who can reach the
// API inject fake messages. Leave NODE_ENV unset (the default) for local use.
app.post('/api/mock/seed', (req, res) => {
  if (isProduction) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { platform = 'whatsapp' } = req.body;
  const now = Date.now();
  const sampleMessages = [
    { groupId: 'grp_1', groupName: 'Project Dev Team', sender: 'Rohan', content: 'Guys the Docker container on staging is throwing a 502 Bad Gateway on port 8080.' },
    { groupId: 'grp_1', groupName: 'Project Dev Team', sender: 'Priya', content: 'I checked Nginx logs, the upstream backend service crashed due to DB pool timeout.' },
    { groupId: 'grp_1', groupName: 'Project Dev Team', sender: 'Rohan', content: 'Fixed the connection string and pushed commit 4f92a. Can someone verify before the 10 AM standup?' },
    { groupId: 'grp_2', groupName: 'Weekend Trek & Outing', sender: 'Aman', content: 'Are we still leaving at 5:30 AM on Saturday from the main square?' },
    { groupId: 'grp_2', groupName: 'Weekend Trek & Outing', sender: 'Neha', content: 'Yes! Everyone please pay 600 INR to Aman via UPI by tonight for the cab booking.' }
  ];

  sampleMessages.forEach((m, idx) => {
    saveMessage({ platform, ...m, timestamp: now - (sampleMessages.length - idx) * 60000 });
  });

  res.json({ message: 'Seeded 5 overnight messages across 2 groups.' });
});

// 5. Trigger Gemma Summarization Now
app.post('/api/summarize/run-now', async (req, res) => {
  try {
    const results = await scheduler.runMorningDigest();
    res.json({ generated: results });
  } catch (err) {
    console.error('[run-now] failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 6. Get all saved Morning Summaries
app.get('/api/summaries', (req, res) => {
  db.all(`SELECT * FROM summaries ORDER BY created_at DESC LIMIT 30`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// Single unified listener at the bottom, bound to localhost by default
app.listen(PORT, HOST, () => {
  console.log(`Agent Backend running on http://${HOST}:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.warn('[security] Listening on all network interfaces (HOST=0.0.0.0). Anyone on your network can reach this API.');
  }
});