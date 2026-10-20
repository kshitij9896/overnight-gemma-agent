import React, { useEffect, useState } from 'react';
import { getPlatformStatus, saveConfig } from '../api';

export default function AuthAndGroupConfig({ onComplete, onConnected }) {
  const [statusData, setStatusData] = useState({ status: 'AWAITING_AUTH', groups: [], qrCode: null });
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [wakeTime, setWakeTime] = useState('07:00');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getPlatformStatus();
        if (cancelled) return;
        setStatusData(data);
        if (data.status === 'CONNECTED') onConnected?.();
      } catch (err) {
        console.error('Status poll failed:', err);
      }
    };

    poll(); // check right away, then every 2.5 seconds
    const interval = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const toggleGroup = (id) => {
    setSelectedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    const [hour, minute] = wakeTime.split(':').map(Number);
    setSaving(true);
    setSaveError('');
    try {
      await saveConfig(selectedGroups, hour, minute);
      onComplete();
    } catch (err) {
      console.error(err);
      setSaveError('Could not save the schedule. Check that the backend is running on port 4000.');
    } finally {
      setSaving(false);
    }
  };

  const isConnected = statusData.status === 'CONNECTED';

  return (
    <div className="card-container">
      <h2>Step 1: Connect WhatsApp &amp; Set Wake-Up Time</h2>
      <p className="subtitle">
        Open WhatsApp on your phone, go to Linked Devices, and scan the QR code below.
      </p>

      {isConnected && (
        <div className="status-banner">
          ✅ WhatsApp connected! Choose the groups to monitor below.
        </div>
      )}

      {!isConnected && statusData.qrCode && (
        <div className="qr-box">
          <p className="qr-caption">Scan with WhatsApp &gt; Linked Devices</p>
          <img src={statusData.qrCode} alt="WhatsApp QR Code" />
        </div>
      )}

      {!isConnected && !statusData.qrCode && (
        <div className="status-banner waiting">
          Waiting for the WhatsApp QR code... (status: {statusData.status || 'AWAITING_AUTH'}). If it never appears, check the backend terminal for errors.
        </div>
      )}

      <div className="config-section">
        <label className="field-label" htmlFor="wake-time">Morning summary delivery time:</label>
        <input
          id="wake-time"
          type="time"
          value={wakeTime}
          onChange={(e) => setWakeTime(e.target.value)}
          className="time-input"
        />
      </div>

      {statusData.groups?.length > 0 && (
        <div className="group-list">
          <h4>Select groups to monitor overnight:</h4>
          <div className="group-grid">
            {statusData.groups.map(group => (
              <label key={group.id} className="group-item">
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                />
                <span>{group.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {saveError && <div className="status-banner error">{saveError}</div>}

      <div className="action-row">
        <button className="primary-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Schedule & Open Morning Dashboard'}
        </button>
      </div>
    </div>
  );
}
