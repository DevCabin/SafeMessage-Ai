import { NextResponse } from "next/server";
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
