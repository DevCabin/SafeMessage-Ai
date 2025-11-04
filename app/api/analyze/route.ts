import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { SAFE_MESSAGE_SYSTEM_PROMPT } from "@/lib/safeMessagePrompt";
import { getOrCreateUid } from "../_session";
import { getKV } from "@/lib/kv";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const FREE_LIMIT = 5;

export async function POST(req: NextRequest) {
  const { sender = "", body = "", context = "" } = await req.json().catch(() => ({}));
  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "Missing message body" }, { status: 400 });
  }

  const uid = await getOrCreateUid();
  const kv = getKV();

  const premium = (await kv.get<boolean>(`premium:${uid}`)) || false;
  let used = (await kv.get<number>(`usage:${uid}`)) || 0;

  if (!premium && used >= FREE_LIMIT) {
    return NextResponse.json({ error: "Free limit reached" }, { status: 402 });
  }

  // Increment usage pre-call for consistency; you can move post-call if desired
  if (!premium) {
    used += 1;
    await kv.set(`usage:${uid}`, used);
  }

  const userContent = [
    `Sender/From: ${sender || "(not provided)"}`,
    `Message Body: ${body}`,
    `Context: ${context || "(not provided)"}`
  ].join("\n");

  // Use Chat Completions for deterministic formatting
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: SAFE_MESSAGE_SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ]
  });

  const text = completion.choices[0]?.message?.content ?? "No response.";

  // Try to extract minimal structured bits for UI display
  const verdictMatch = text.match(/Verdict:\s*(SAFE|UNSAFE|UNKNOWN)/i);
  const threatMatch = text.match(/Threat Level:\s*([^\n]+)/i);

  return NextResponse.json({
    text,
    verdict: (verdictMatch?.[1]?.toUpperCase() ?? "UNKNOWN") as "SAFE" | "UNSAFE" | "UNKNOWN",
    threatLevel: threatMatch?.[1] ?? "N/A"
  });
}
