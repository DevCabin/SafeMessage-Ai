import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getOrCreateUid } from "../_session";

const FREE_LIMIT = 5;

export async function GET() {
  const uid = await getOrCreateUid();
  const kv = getKV();
  const used = (await kv.get<number>(`usage:${uid}`)) || 0;
  const premium = (await kv.get<boolean>(`premium:${uid}`)) || false;

  return NextResponse.json({ used, limit: FREE_LIMIT, premium });
}

export async function POST(req: NextRequest) {
  const { fingerprint } = await req.json().catch(() => ({}));
  const uid = await getOrCreateUid(fingerprint);
  const kv = getKV();
  const used = (await kv.get<number>(`usage:${uid}`)) || 0;
  const premium = (await kv.get<boolean>(`premium:${uid}`)) || false;

  return NextResponse.json({ used, limit: FREE_LIMIT, premium });
}
