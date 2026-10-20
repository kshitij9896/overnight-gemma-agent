const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const BaseAdapter = require('./BaseAdapter');

class WhatsAppAdapter extends BaseAdapter {
  constructor(onMessageCallback) {
    super(onMessageCallback);
    this.sock = null;
    this.qrDataUrl = null;
  }

  async initialize() {
    this.status = 'AWAITING_AUTH';
    const { state, saveCreds } = await useMultiFileAuthState('./wa_auth_session');

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrDataUrl = await QRCode.toDataURL(qr); console.log('[WhatsApp] QR code ready - scan it in WhatsApp > Linked Devices');
        this.status = 'AWAITING_AUTH';
      }

      if (connection === 'open') {
        this.status = 'CONNECTED';
        this.qrDataUrl = null;
        await this.fetchJoinedGroups();
      } else if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut; console.log('[WhatsApp] connection closed, reconnecting =', shouldReconnect, lastDisconnect?.error?.message || '');
        if (shouldReconnect && !this.loggingOut) this.initialize();
      }
    });

    // Listen for overnight group messages
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        const jid = msg.key.remoteJid || '';
        if (!jid.endsWith('@g.us') || !msg.message) continue; // Only group chats

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          '';

        if (text) {
          const groupMeta = this.groups.find(g => g.id === jid);
          this.onMessage({
            platform: 'whatsapp',
            groupId: jid,
            groupName: groupMeta ? groupMeta.name : 'WhatsApp Group',
            sender: msg.pushName || 'Member',
            content: text,
            timestamp: (msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000
          });
        }
      }
    });
  }

  async logout() {
    this.loggingOut = true;
    try {
      if (this.sock) {
        await this.sock.logout().catch((err) => console.log('[WhatsApp] logout warning:', err.message));
        this.sock.end(undefined);
      }
    } finally {
      this.sock = null;
      this.qrDataUrl = null;
      this.groups = [];
      this.status = 'DISCONNECTED';
      try {
        fs.rmSync('./wa_auth_session', { recursive: true, force: true });
        console.log('[WhatsApp] logged out and session data deleted');
      } catch (err) {
        console.log('[WhatsApp] could not delete session folder:', err.message);
      }
    }
  }

  async fetchJoinedGroups() {
    const chats = await this.sock.groupFetchAllParticipating();
    this.groups = Object.values(chats).map(g => ({
      id: g.id,
      name: g.subject,
      platform: 'whatsapp'
    }));
  }

  getAuthPayload() {
    return {
      platform: 'whatsapp',
      status: this.status,
      qrCode: this.qrDataUrl,
      groups: this.groups
    };
  }

async sendSelfDM(text) {
    if (!this.sock || this.status !== 'CONNECTED' || !this.sock.user?.id) {
      console.log('[WhatsApp Self-DM Skipped] Not connected to live session.');
      return false;
    }

    // Normalize '919876543210:14@s.whatsapp.net' -> '919876543210@s.whatsapp.net'
    const rawId = this.sock.user.id;
    const selfJid = rawId.includes(':')
      ? `${rawId.split(':')[0]}@s.whatsapp.net`
      : rawId;

    await this.sock.sendMessage(selfJid, { text });
    return true;
  }
}




module.exports = WhatsAppAdapter;