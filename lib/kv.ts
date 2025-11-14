import { kv } from "@vercel/kv";

// Local storage fallback for development
class LocalKV {
  private data: Map<string, unknown> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) || null;
  }

  async set(key: string, value: unknown, options?: { ex?: number }): Promise<void> {
    this.data.set(key, value);
    // Note: expiration not implemented for local development
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
}

const localKV = new LocalKV();

export const getKV = () => {
  // Use Vercel KV if available, otherwise local fallback
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return kv;
  }
  return localKV;
};
