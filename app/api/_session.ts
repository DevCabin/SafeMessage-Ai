import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";

const COOKIE_NAME = "safemessage_uid";
export async function getOrCreateUid(fingerprint?: string | null) {
  // Use fingerprint as primary identifier if available
  if (fingerprint && typeof fingerprint === "string" && fingerprint.length > 10) {
    return fingerprint;
  }

  // Fallback to UUID cookie
  const store = await cookies();
  let uid = store.get(COOKIE_NAME)?.value;
  if (!uid) {
    uid = uuid();
    // httpOnly cookie so users can't tamper easily
    store.set(COOKIE_NAME, uid, { httpOnly: true, path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  return uid as string;
}
