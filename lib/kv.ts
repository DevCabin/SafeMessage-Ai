import { kv } from "@vercel/kv";

// Local storage fallback for development
class LocalKV {
  private data: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any): Promise<void> {
    this.data.set(key, value);
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
