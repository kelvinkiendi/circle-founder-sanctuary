// Kenyan phone number utilities
export function normalizeKePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  let p = digits;
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0") && p.length === 10) p = "254" + p.slice(1);
  if (p.startsWith("7") && p.length === 9) p = "254" + p;
  if (p.startsWith("1") && p.length === 9) p = "254" + p;
  if (!/^254[17]\d{8}$/.test(p)) return null;
  return "+" + p;
}

export function isValidKePhone(raw: string): boolean {
  return normalizeKePhone(raw) !== null;
}

export function formatKePhone(raw: string): string {
  const n = normalizeKePhone(raw);
  return n ?? raw;
}
