const WhatsAppAdapter = require('./WhatsAppAdapter');
const { saveMessage, clearAllData } = require('../db/sqlite');

class PlatformManager {
  constructor() {
    this.activeAdapter = null;
    this.monitoredGroups = new Set();
  }

  async selectPlatform(platform) {
    if (platform !== 'whatsapp') {
      throw new Error('Only WhatsApp is supported');
    }

    const callback = (msg) => {
      if (this.monitoredGroups.size === 0 || this.monitoredGroups.has(msg.groupId)) {
        saveMessage(msg);
      }
    };

    this.activeAdapter = new WhatsAppAdapter(callback);
    await this.activeAdapter.initialize();
    return this.getStatus();
  }

  setMonitoredGroups(groupIds) {
    this.monitoredGroups = new Set(groupIds);
    return Array.from(this.monitoredGroups);
  }

  // Disconnect WhatsApp, delete the saved session, and wipe all stored chats and summaries
  async logout() {
    if (this.activeAdapter && typeof this.activeAdapter.logout === 'function') {
      await this.activeAdapter.logout();
    }
    this.activeAdapter = null;
    this.monitoredGroups = new Set();
    await clearAllData();
    return this.getStatus();
  }

  getStatus() {
    if (!this.activeAdapter) return { status: 'DISCONNECTED', platform: null, groups: [] };
    return {
      ...this.activeAdapter.getAuthPayload(),
      monitoredGroups: Array.from(this.monitoredGroups)
    };
  }

  async sendMorningDigestDM(summaries) {
    if (!this.activeAdapter || !summaries || summaries.length === 0) {
      return { sent: false, reason: 'No active adapter or empty summaries' };
    }

    const dateStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });

    const formattedBlocks = summaries.map(
      (s, i) => `*${i + 1}. ${s.groupName}*\n• ${s.line1}\n• ${s.line2}`
    );

    const fullDigestMessage =
      `🌅 *Morning Overnight Digest (${dateStr})*\n\n` +
      formattedBlocks.join('\n\n') +
      `\n\n_Generated locally by Gemma_`;

    try {
      const sent = await this.activeAdapter.sendSelfDM(fullDigestMessage);
      return { sent, preview: fullDigestMessage };
    } catch (err) {
      console.error('[Self-DM Error]:', err.message);
      return { sent: false, error: err.message, preview: fullDigestMessage };
    }
  }
}

module.exports = new PlatformManager();
