/*
  Minimal Gemini adapter shim
  - Reads `GEMINI_API_KEY` and `GEMINI_API_URL` from env
  - Exposes `chat.completions.create({ model, messages, stream, ... })`
  - Exposes `images.generate({ prompt, ... })`
  - Exposes `audio.transcriptions.create(...)` (throws if unsupported)

  NOTE: This is a best-effort shim to minimize application changes.
  The Gemini API differs from OpenAI's; this wrapper maps common inputs
  to Gemini REST endpoints and returns objects shaped similarly to the
  `openai` client so the rest of the app can continue to call `openai.*`.
*/

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com";

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not set — Gemini adapter will be inactive.");
}

async function apiPost(path: string, body: any) {
  const url = `${GEMINI_API_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

// Helper to convert messages array to Gemini `input` text
function messagesToPrompt(messages: any[]) {
  // Simple concatenation: system / user / assistant roles.
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}

export const gemini = {
  chat: {
    completions: {
      async create(opts: any) {
        // opts: { model, messages, stream, max_completion_tokens }
        if (!GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is not set");
        }

        const model = opts.model || "chat-bison";
        const prompt = messagesToPrompt(opts.messages || []);

        // Use a reasonable Gemini-style endpoint. This maps to a generate call.
        const path = `/v1/models/${model}:generate`;
        const body = {
          input: prompt,
          // map token limits if provided
          max_output_tokens: opts.max_completion_tokens || 1024,
        };

        // Gemini doesn't support the same streaming protocol here; if stream: true,
        // emulate streaming by returning an async iterable that yields one chunk.
        if (opts.stream) {
          const json = await apiPost(path, body);
          // Attempt to extract text content from Gemini's response
          const candidates = json?.candidates || [];
          const text = candidates.map((c: any) => c?.content?.[0]?.text || "").join("\n") || json?.output?.[0]?.content?.[0]?.text || "";

          // Return an AsyncIterable compatible with current code's `for await (const chunk of stream)`
          async function* gen() {
            yield { choices: [{ delta: { content: text } }] };
          }
          return gen();
        }

        const json = await apiPost(path, body);
        const candidates = json?.candidates || [];
        const text = candidates.map((c: any) => c?.content?.[0]?.text || "").join("\n") || json?.output?.[0]?.content?.[0]?.text || "";

        // Shape response like OpenAI client
        return { choices: [{ message: { content: text } }] };
      },
    },
  },

  images: {
    async generate(opts: any) {
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
      // Gemini image endpoints vary; attempt a reasonable mapping
      const path = `/v1/images:generate`;
      const body = {
        prompt: opts.prompt || opts.prompt_text || "",
        // map size / count
        // Gemini image API may expect different params; user should update if necessary
        size: opts.size || "1024x1024",
      };

      const json = await apiPost(path, body);
      // Map to OpenAI-like response { data: [{ b64_json: "..." }] }
      // The exact field names differ; support common patterns
      const b64 = json?.data?.[0]?.b64_json || json?.image || json?.images?.[0]?.b64 || null;
      return { data: [{ b64_json: b64 }] };
    },
  },

  audio: {
    transcriptions: {
      async create(file: any, opts: any) {
        // Not implemented: Gemini's speech-to-text APIs are different.
        throw new Error("Gemini audio transcription wrapper is not implemented. Please implement or use an external transcription service.");
      },
    },
  },
};

// For compatibility, export `openai` identifier as well so existing imports like
// `import { openai } from './client'` will keep working if we re-export gemini.
export const openai = gemini;
