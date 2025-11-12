import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { SAFE_MESSAGE_SYSTEM_PROMPT } from "@/lib/safeMessagePrompt";
import { getOrCreateUid } from "../_session";
import { getKV } from "@/lib/kv";

const FREE_LIMIT = 5;

export async function POST(req: NextRequest) {
  const { sender = "", body = "", context = "", fingerprint } = await req.json().catch(() => ({}));
  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "Missing message body" }, { status: 400 });
  }

  const uid = await getOrCreateUid(fingerprint);
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

  // Check if using local LM Studio or OpenAI
  const forceLocal = req.nextUrl.searchParams.get('local') === 'true' || process.env.USE_LOCAL_LM_STUDIO === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';

  let text: string;
  let usedLocalFallback = false;

  try {
    if (forceLocal) {
      throw new Error('Force local mode');
    }

    // Try OpenAI first
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SAFE_MESSAGE_SYSTEM_PROMPT },
        { role: "user", content: userContent }
      ]
    });

    text = completion.choices[0]?.message?.content ?? "No response.";
  } catch (error) {
    // If OpenAI fails and we're in development, try LM Studio as fallback
    if (isDevelopment || forceLocal) {
      try {
        console.log('OpenAI failed, trying LM Studio fallback...', error instanceof Error ? error.message : String(error));
        const lmStudioUrl = process.env.LM_STUDIO_URL || 'http://192.168.1.11:1234';
        const response = await fetch(`${lmStudioUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-20b',
            messages: [
              { role: 'system', content: SAFE_MESSAGE_SYSTEM_PROMPT },
              { role: 'user', content: userContent }
            ],
            temperature: 0.2,
            max_tokens: 1000
          })
        });

        if (!response.ok) {
          throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        text = data.choices?.[0]?.message?.content ?? "No response from local model.";
        usedLocalFallback = true;
      } catch (lmError) {
        console.error('Both OpenAI and LM Studio failed:', lmError instanceof Error ? lmError.message : String(lmError));
        throw new Error('Both OpenAI and local LM Studio are unavailable. Please check your API keys and LM Studio setup.');
      }
    } else {
      throw error; // Re-throw original error if not in development
    }
  }

  // Try to extract minimal structured bits for UI display
  const verdictMatch = text.match(/Verdict:\s*(SAFE|UNSAFE|UNKNOWN)/i);
  const threatMatch = text.match(/Threat Level:\s*([^\n]+)/i);

  return NextResponse.json({
    text,
    verdict: (verdictMatch?.[1]?.toUpperCase() ?? "UNKNOWN") as "SAFE" | "UNSAFE" | "UNKNOWN",
    threatLevel: threatMatch?.[1] ?? "N/A"
  });
}
