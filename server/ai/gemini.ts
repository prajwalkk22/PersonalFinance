const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  (process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1beta";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not set — Gemini adapter will be inactive.");
}

function withApiKey(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${GEMINI_API_URL}${path}${separator}key=${GEMINI_API_KEY}`;
}

class GeminiHttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`Gemini API ${status} ${statusText}: ${body}`);
    this.name = "GeminiHttpError";
    this.status = status;
    this.body = body;
  }
}

async function apiPost(path: string, body: any) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const res = await fetch(withApiKey(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GeminiHttpError(res.status, res.statusText, text);
  }

  return res.json();
}

function toText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join(" ")
      .trim();
  }
  return "";
}

function toGeminiContents(messages: any[]) {
  const systemInstructions = messages
    .filter((m) => m?.role === "system")
    .map((m) => toText(m.content))
    .filter(Boolean)
    .join("\n");

  const chatContents = messages
    .filter((m) => m?.role !== "system")
    .map((m) => {
      const text = toText(m.content);
      if (!text) return null;
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text }],
      };
    })
    .filter(Boolean);

  if (systemInstructions) {
    chatContents.unshift({
      role: "user",
      parts: [{ text: `System instructions:\n${systemInstructions}` }],
    });
  }

  if (chatContents.length === 0) {
    chatContents.push({
      role: "user",
      parts: [{ text: "" }],
    });
  }

  return chatContents;
}

function extractGeneratedText(json: any): string {
  const candidates = json?.candidates;
  if (!Array.isArray(candidates)) return "";

  const text = candidates
    .map((candidate: any) =>
      (candidate?.content?.parts || [])
        .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
    )
    .join("\n")
    .trim();

  return text;
}

function uniqueModels(models: string[]) {
  return [...new Set(models.map((m) => m.trim()).filter(Boolean))];
}

function candidateModels(requestedModel?: string) {
  return uniqueModels([
    requestedModel || "",
    process.env.GEMINI_MODEL || "",
    process.env.GEMINI_FALLBACK_MODEL || "",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ]);
}

async function tryGenerateWithModel(model: string, body: any) {
  return apiPost(`/${GEMINI_API_VERSION}/models/${model}:generateContent`, body);
}

async function generateWithFallback(opts: { model?: string; body: any }) {
  const models = candidateModels(opts.model || DEFAULT_GEMINI_MODEL);
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const json = await tryGenerateWithModel(model, opts.body);
      return { json, model };
    } catch (error: any) {
      lastError = error;
      if (!(error instanceof GeminiHttpError) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No compatible Gemini model found");
}

export const gemini = {
  chat: {
    completions: {
      async create(opts: any) {
        const requestedModel = opts?.model || DEFAULT_GEMINI_MODEL;
        const generationConfig: Record<string, any> = {
          maxOutputTokens: opts?.max_completion_tokens || 1024,
        };

        if (opts?.response_format?.type === "json_object") {
          generationConfig.responseMimeType = "application/json";
        }

        const body = {
          contents: toGeminiContents(opts?.messages || []),
          generationConfig,
        };

        const { json } = await generateWithFallback({ model: requestedModel, body });
        const text = extractGeneratedText(json);

        if (opts?.stream) {
          const stream = async function* () {
            yield { choices: [{ delta: { content: text } }] };
          };
          return stream();
        }

        return { choices: [{ message: { content: text } }] };
      },
    },
  },

  images: {
    async generate(opts: any) {
      const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_MODEL;
      const prompt = opts?.prompt || opts?.prompt_text || "";
      const json = await apiPost(`/${GEMINI_API_VERSION}/models/${model}:generateContent`, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const text = extractGeneratedText(json);
      return { data: [{ b64_json: null, text }] };
    },
  },

  audio: {
    transcriptions: {
      async create() {
        throw new Error(
          "Gemini audio transcription wrapper is not implemented. Use a supported transcription provider."
        );
      },
    },
  },
};

export const openai = gemini;
