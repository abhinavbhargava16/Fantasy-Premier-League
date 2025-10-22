// src/services/chatgptApi.ts
// ChatGPT integration (replaces Claude). Uses OpenAI Chat Completions API.

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  system?: string;
  temperature?: number;
  max_tokens?: number;
  toolsContext?: {
    currentGW?: number;
    fixtures?: any;
    players?: any;
    fdr?: Record<number, number>;
  };
}

export interface ChatResponse {
  text: string;
}

const API_URL = import.meta.env.VITE_OPENAI_API_URL;
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";

export async function askChatGPT(req: ChatRequest): Promise<ChatResponse> {
  if (!API_URL || !API_KEY) throw new Error("OpenAI API not configured");

  // Merge FPL context into system prompt
  const systemPrefix =
    "You are an intelligent Fantasy Premier League (FPL) assistant. " +
    "Be concise, data-driven, and use bullet points or tables where helpful. ";
  const systemCtx = req.toolsContext
    ? `\\nFPL-CONTEXT: ${JSON.stringify(req.toolsContext).slice(0, 12000)}`
    : "";

  const body = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content: (req.system || "") + systemPrefix + systemCtx,
      },
      ...req.messages,
    ],
    temperature: req.temperature ?? 0.4,
    max_tokens: req.max_tokens ?? 600,
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  return { text };
}
