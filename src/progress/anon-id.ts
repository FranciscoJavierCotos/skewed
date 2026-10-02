const KEY = "skewed:v1:anon_id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let memory: string | null = null;

export function getAnonId(storage: Storage | null): string {
  try {
    const existing = storage?.getItem(KEY);
    if (existing && UUID.test(existing)) return existing;
    const id = crypto.randomUUID();
    storage?.setItem(KEY, id);
    if (storage) return id;
  } catch { /* fall through to memory */ }
  return (memory ??= crypto.randomUUID());
}
