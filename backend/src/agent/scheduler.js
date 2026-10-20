const cron = require('node-cron');
const { db, getUnsummarizedMessages, markGroupSummarized } = require('../db/sqlite');
const { summarizeChatLog } = require('./gemmaSummarizer');
const platformManager = require('../adapters/PlatformManager');

// Promise wrapper so we can await sqlite3 queries (db.all needs a callback)
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

class DigestScheduler {
  constructor() {
    this.cronExpression = '0 7 * * *'; // Default 7:00 AM
    this.task = null;
    this.startCron(this.cronExpression);
  }

  startCron(cronExp) {
    if (this.task) this.task.stop();
    this.cronExpression = cronExp;
    this.task = cron.schedule(this.cronExpression, async () => {
      console.log('[Scheduler] Running overnight Gemma summarization + Self-DM...');
      try {
        await this.runMorningDigest();
      } catch (err) {
        console.error('[Scheduler] Digest failed:', err.message);
      }
    });
  }

  setMorningTime(hour, minute) {
    const exp = `${minute} ${hour} * * *`;
    this.startCron(exp);
    return { schedule: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
  }

  async runMorningDigest() {
    const groups = await dbAll(`
      SELECT DISTINCT group_id, group_name, platform
      FROM messages
      WHERE summarized = 0
    `);

    const generated = [];

    for (const group of groups) {
      const msgs = await getUnsummarizedMessages(group.group_id);
      const summary = await summarizeChatLog(group.group_name, msgs);

      await dbRun(
        `INSERT INTO summaries (platform, group_name, line_one, line_two) VALUES (?, ?, ?, ?)`,
        [group.platform, group.group_name, summary.line1, summary.line2]
      );

      markGroupSummarized(group.group_id);
      generated.push({
        platform: group.platform,
        groupName: group.group_name,
        line1: summary.line1,
        line2: summary.line2
      });
    }

    // Automatically push the combined 2-line digest to WhatsApp "Message Yourself" or Telegram "Saved Messages"
    const dmStatus = await platformManager.sendMorningDigestDM(generated);

    return { generated, dmStatus };
  }
}

module.exports = new DigestScheduler();
