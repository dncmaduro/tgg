export type ClientIdentity = { playerId: string; credential: string; nickname: string };

const STORAGE_KEY = "miniplay:identity";

function randomToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getClientIdentity(): ClientIdentity {
  if (typeof window === "undefined") return { playerId: "", credential: "", nickname: "" };
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<ClientIdentity>;
      if (parsed.playerId && parsed.credential) return { playerId: parsed.playerId, credential: parsed.credential, nickname: parsed.nickname ?? "" };
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }
  const identity = { playerId: randomToken(), credential: randomToken(), nickname: "" };
  saveClientIdentity(identity);
  return identity;
}

export function saveClientIdentity(identity: ClientIdentity): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function updateNickname(nickname: string): ClientIdentity {
  const identity = getClientIdentity();
  const next = { ...identity, nickname };
  saveClientIdentity(next);
  return next;
}
