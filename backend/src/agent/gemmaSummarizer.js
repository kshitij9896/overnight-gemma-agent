// 127.0.0.1 instead of "localhost": on Windows, localhost can resolve to IPv6 (::1)
// while Ollama listens on IPv4, which causes connection refused errors.
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const MODEL = 'gemma2:2b'; // Fast & lightweight for local CPU execution

async function summarizeChatLog(groupName, messages) {
  if (!messages || messages.length === 0) {
    return {
      line1: `No new overnight activity in ${groupName}.`,
      line2: `No action items or mentions.`
    };
  }

  // Format chat log
  const chatTranscript = messages
    .map(m => `${m.sender}: ${m.content}`)
    .join('\n')
    .slice(-6000); // Keep within safe context window for fast CPU inference

  const prompt = `You are an overnight group chat summarizer agent.
Read the following chat transcript from the group "${groupName}" and output STRICTLY TWO LINES of plain text.
Line 1: Summarize the core discussion or vibe in under 20 words.
Line 2: List any action items, deadlines, decisions, or important links (or write "No action items." if none).
Do NOT include bullet points, bold text, labels like "Line 1:", or greetings.

Chat Transcript:
${chatTranscript}`;

  let response;
  try {
    response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2, // Low temperature for factual summaries
          num_predict: 90   // Hard cap token generation so it stays concise
        }
      })
    });
  } catch (err) {
    throw new Error(`Cannot reach Ollama at ${OLLAMA_URL} (${err.cause?.code || err.message}). Is "ollama serve" running?`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama returned ${response.status}: ${body}. Check the model name "${MODEL}" with "ollama list".`);
  }

  const data = await response.json();
  const lines = (data.response || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return {
    line1: lines[0] || 'General conversation occurred overnight.',
    line2: lines[1] || 'No immediate action items.'
  };
}

module.exports = { summarizeChatLog };
