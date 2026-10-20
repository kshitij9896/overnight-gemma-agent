const API_BASE = 'http://localhost:4000/api';

export async function selectPlatform(platform) {
  const res = await fetch(`${API_BASE}/platform/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform })
  });
  return res.json();
}

export async function logoutPlatform() {
  const res = await fetch(`${API_BASE}/platform/logout`, { method: 'POST' });
  return res.json();
}

export async function getPlatformStatus() {
  const res = await fetch(`${API_BASE}/platform/status`);
  return res.json();
}

export async function saveConfig(groupIds, hour, minute) {
  const res = await fetch(`${API_BASE}/config/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupIds, hour, minute })
  });
  return res.json();
}

export async function seedMockChats(platform) {
  const res = await fetch(`${API_BASE}/mock/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform })
  });
  return res.json();
}

export async function runGemmaNow() {
  const res = await fetch(`${API_BASE}/summarize/run-now`, { method: 'POST' });
  return res.json();
}

export async function fetchSummaries() {
  const res = await fetch(`${API_BASE}/summaries`);
  return res.json();
}