// Minimal Gemini Interactions API client for code discovery.
//
// Uses Google Search grounding, so the model returns citations alongside its answer.
// The caller must still fetch and verify every citation: grounding proves the model
// looked somewhere, not that the code it printed exists on the page.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// 3.5 Flash-Lite is the model new projects can use. Its Google Search grounding
// requires billing enabled (Tier 1), which includes 5,000 free grounded searches per
// month. Older models with free grounding are closed to new projects.
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const API_REVISION = '2026-05-20';
const RETRY_DELAYS_MS = [2000, 8000];
const REQUEST_TIMEOUT_MS = 90000;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    codes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          reward: { type: 'string' },
          gems: { type: 'integer' },
          tickets: { type: 'integer' },
          sourceUrls: { type: 'array', items: { type: 'string' } },
          firstSeenDate: { type: 'string' },
        },
        required: ['code', 'reward', 'sourceUrls'],
      },
    },
  },
  required: ['codes'],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(knownCodes, today) {
  return [
    `Today is ${today}. Find currently active promo codes for the mobile game "Invincible: Guarding the Globe" (Ubisoft Barcelona).`,
    '',
    'Rules:',
    '- Search the web. Only report a code if a page you found shows both the code and its reward.',
    '- Prefer the official Ubisoft help centre and official social accounts over code aggregators.',
    '- Never guess, never invent, never report an expired code.',
    '- If a code and its reward are not visible together on a page, omit it.',
    '',
    'Return the code exactly as written, the reward exactly as the page words it, and the URLs where you saw them.',
    'Put the number of gems in "gems" and the number of tickets in "tickets"; use 0 when the reward is something else.',
    '',
    knownCodes.length
      ? `Already tracked, do not return these: ${knownCodes.join(', ')}`
      : 'No codes are tracked yet.',
  ].join('\n');
}

function collectText(data) {
  const chunks = [];
  for (const step of data.steps || []) {
    if (step.type !== 'model_output') continue;
    for (const block of step.content || []) {
      if (block.type === 'text' && typeof block.text === 'string') chunks.push(block.text);
    }
  }
  if (!chunks.length && typeof data.output_text === 'string') chunks.push(data.output_text);
  if (!chunks.length && Array.isArray(data.outputs)) {
    for (const output of data.outputs) {
      for (const block of output.content || []) {
        if (block.type === 'text' && typeof block.text === 'string') chunks.push(block.text);
      }
    }
  }
  return chunks.join('\n').trim();
}

function collectCitations(data) {
  const urls = [];
  for (const step of data.steps || []) {
    if (step.type !== 'model_output') continue;
    for (const block of step.content || []) {
      for (const annotation of block.annotations || []) {
        if (annotation.type === 'url_citation' && annotation.url) urls.push(annotation.url);
      }
    }
  }
  return urls;
}

// The model is asked for JSON, but a stray sentence or code fence still happens.
function extractJson(text) {
  if (!text) throw new Error('empty model response');
  const cleaned = String(text).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const objectStart = cleaned.indexOf('{');
  const arrayStart = cleaned.indexOf('[');
  const useArray = arrayStart !== -1 && (objectStart === -1 || arrayStart < objectStart);
  const start = useArray ? arrayStart : objectStart;
  const end = useArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in model response');
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (Array.isArray(parsed)) return { codes: parsed };
  if (!Array.isArray(parsed.codes)) throw new Error('model response has no codes array');
  return parsed;
}

// Grounding annotations are evidence too: keep them when the model forgets to copy URLs
// into the structured field.
function mergeSourceUrls(claimed, citations) {
  const merged = [];
  for (const url of [...(Array.isArray(claimed) ? claimed : []), ...(Array.isArray(citations) ? citations : [])]) {
    if (typeof url === 'string' && url && !merged.includes(url)) merged.push(url);
  }
  return merged;
}

async function requestOnce({ apiKey, model, prompt, useSchema }) {
  const body = {
    model,
    input: prompt,
    system_instruction:
      'You extract verified video-game promo codes. You only report what a cited page actually shows. You never guess.',
    tools: [{ type: 'google_search' }],
  };
  if (useSchema) {
    body.response_format = { type: 'text', mime_type: 'application/json', schema: RESPONSE_SCHEMA };
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': API_REVISION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.ok) return res.json();
  const detail = await res.text().catch(() => '');
  const error = new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`);
  error.status = res.status;
  error.detail = detail;
  throw error;
}

async function discoverCodes({ apiKey, model = DEFAULT_MODEL, knownCodes = [], today }) {
  const prompt = buildPrompt(knownCodes, today);
  let useSchema = true;

  for (let attempt = 0; ; attempt++) {
    try {
      const data = await requestOnce({ apiKey, model, prompt, useSchema });
      const text = collectText(data);
      const parsed = extractJson(text);
      const citations = collectCitations(data);
      return {
        codes: parsed.codes
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({ ...item, sourceUrls: mergeSourceUrls(item.sourceUrls, citations) })),
        citations,
        model,
        rawText: text,
      };
    } catch (error) {
      // A 400 usually means this model rejects the schema/tool combination; retry
      // once without the schema before giving up.
      if (useSchema && error.status === 400) {
        useSchema = false;
        continue;
      }
      const retryable = error.status === 429 || error.status >= 500;
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw error;
    }
  }
}

module.exports = {
  DEFAULT_MODEL,
  buildPrompt,
  collectCitations,
  collectText,
  discoverCodes,
  extractJson,
  mergeSourceUrls,
};
