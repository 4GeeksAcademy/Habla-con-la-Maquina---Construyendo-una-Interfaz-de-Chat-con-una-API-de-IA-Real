import { NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

export async function POST(request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing GROQ_API_KEY. Add it in your .env.local file before sending messages.",
      },
      { status: 500 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const messages = payload?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "The request must include at least one message." },
      { status: 400 }
    );
  }

  const startedAt = Date.now();

  const groqResponse = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.6,
      messages,
    }),
  });

  const endedAt = Date.now();
  const latencyMs = endedAt - startedAt;

  const raw = await groqResponse.json();

  if (!groqResponse.ok) {
    return NextResponse.json(
      {
        error:
          raw?.error?.message ||
          "Groq request failed. Check your API key and try again.",
      },
      { status: groqResponse.status }
    );
  }

  const content = raw?.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: "Groq response did not include message content." },
      { status: 502 }
    );
  }

  const usage = {
    prompt_tokens: raw?.usage?.prompt_tokens || 0,
    completion_tokens: raw?.usage?.completion_tokens || 0,
    total_tokens: raw?.usage?.total_tokens || 0,
  };

  const tokensPerSecond =
    latencyMs > 0
      ? Number((usage.completion_tokens / (latencyMs / 1000)).toFixed(2))
      : 0;

  return NextResponse.json({
    message: content,
    usage,
    metrics: {
      model: raw?.model || DEFAULT_MODEL,
      latencyMs,
      tokensPerSecond,
    },
  });
}
