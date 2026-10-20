import React, { useEffect, useRef, useState } from 'react';
import AuthAndGroupConfig from './components/AuthAndGroupConfig';
import MorningDigest from './components/MorningDigest';
import { selectPlatform, logoutPlatform } from './api';
import './App.css';

const PLATFORM = 'whatsapp';

export default function App() {
  const [step, setStep] = useState(1); // 1: Connect & configure, 2: Morning digest
  const [connected, setConnected] = useState(false); // true only after the device is linked
  const [sessionKey, setSessionKey] = useState(0); // bump to reset the setup screen with a fresh QR
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  // Start a fresh WhatsApp session (generates a QR code)
  const startSession = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await selectPlatform(PLATFORM);
      if (data.error) throw new Error(data.error);
      setConnected(false);
      setSessionKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setError(`Could not start WhatsApp: ${err.message}. Make sure the backend is running on port 4000.`);
    } finally {
      setLoading(false);
    }
  };

  // Guard so React's development double-mount doesn't start two WhatsApp sessions
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession();
  }, []);

  const handleLogout = async () => {
    const ok = window.confirm(
      'Log out and permanently delete the saved WhatsApp session, all saved chats, and all summaries? A new QR code will be shown for the next user.'
    );
    if (!ok) return;

    setLoading(true);
    setError('');
    try {
      await logoutPlatform();
      setStep(1);
      await startSession();
    } catch (err) {
      console.error(err);
      setError('Logout failed. Check that the backend is running on port 4000.');
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Overnight Gemma Chat Agent</h1>
        <div className="header-actions">
          <span className="pill">100% Local Privacy</span>
          {connected && (
            <button className="logout-btn" onClick={handleLogout} disabled={loading}>
              Logout
            </button>
          )}
        </div>
      </header>

      {error && <div className="status-banner error">{error}</div>}
      {loading && <div className="status-banner waiting">Starting WhatsApp session...</div>}

      <main className="main-content">
        {step === 1 && (
          <AuthAndGroupConfig
            key={sessionKey}
            onConnected={() => setConnected(true)}
            onComplete={() => setStep(2)}
          />
        )}
        {step === 2 && <MorningDigest onBack={() => setStep(1)} />}
      </main>
    </div>
  );
}
