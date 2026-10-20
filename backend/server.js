const express = require('express');
const cors = require('cors');
const platformManager = require('./src/adapters/PlatformManager');
const scheduler = require('./src/agent/scheduler');
const { db, saveMessage } = require('./src/db/sqlite');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
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
  const groups = platformManager.setMonitoredGroups(groupIds || []);
  const time = scheduler.setMorningTime(hour ?? 7, minute ?? 0);
  res.json({ monitoredGroups: groups, ...time });
});

// 4. Seed realistic overnight group messages for instant testing with Gemma
app.post('/api/mock/seed', (req, res) => {
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

// Single unified listener at the bottom
app.listen(PORT, () => {
  console.log(`Agent Backend running on http://localhost:${PORT}`);
});