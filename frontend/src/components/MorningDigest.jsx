import React, { useEffect, useState } from 'react';
import { fetchSummaries, runGemmaNow, seedMockChats } from '../api';

export default function MorningDigest({ onBack }) {
  const [summaries, setSummaries] = useState([]);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState('');
  const [dmPreview, setDmPreview] = useState('');

  const loadSummaries = async () => {
    try {
      const data = await fetchSummaries();
      setSummaries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load summaries:', err);
    }
  };

  useEffect(() => {
    loadSummaries();
  }, []);

  const handleSeedAndTest = async () => {
    setRunning(true);
    setToast('Seeding sample overnight chats & querying local Gemma (Ollama)...');
    try {
      await seedMockChats('whatsapp');
      const res = await runGemmaNow();
      if (res.error) throw new Error(res.error);
      await loadSummaries();

      const generatedCount = res?.generated?.generated?.length ?? 0;
      if (generatedCount === 0) {
        setToast('No new messages to summarize. Click Simulate again to add sample chats.');
        return;
      }

      const dmInfo = res?.generated?.dmStatus;
      if (dmInfo?.preview) setDmPreview(dmInfo.preview);

      setToast(
        dmInfo?.sent
          ? '2-line summaries generated & sent to your Self-DM!'
          : '2-line summaries generated locally! (Your Self-DM is sent once WhatsApp is connected.)'
      );
    } catch (err) {
      console.error(err);
      setToast(`Summarize failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="digest-container">
      <div className="digest-header">
        <div className="digest-title">
          <h2>Morning Two-Line Digest</h2>
          <p className="subtitle">
            Powered locally by Ollama (<code>gemma2:2b</code>) • Platform: <strong>WhatsApp</strong>
          </p>
        </div>
        <div className="button-group">
          <button className="secondary-btn" onClick={onBack}>
            Edit Groups &amp; Time
          </button>
          <button className="primary-btn" disabled={running} onClick={handleSeedAndTest}>
            {running ? 'Gemma is thinking...' : 'Simulate Overnight Chats & Summarize Now'}
          </button>
        </div>
      </div>

      {toast && <div className="status-banner">{toast}</div>}

      {dmPreview && <pre className="dm-preview">{dmPreview}</pre>}

      <div className="summary-list">
        {summaries.length === 0 ? (
          <div className="empty-state">
            No summaries yet. Click <strong>"Simulate Overnight Chats & Summarize Now"</strong> above to test your local Gemma pipeline.
          </div>
        ) : (
          summaries.map((item) => (
            <div key={item.id} className="summary-card">
              <div className="summary-meta">
                <span className={`tag ${item.platform}`}>{item.platform}</span>
                <h3>{item.group_name}</h3>
                <span className="timestamp">{item.created_at}</span>
              </div>
              <p className="line-one"><strong>Vibe:</strong> {item.line_one}</p>
              <p className="line-two"><strong>Action:</strong> {item.line_two}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
