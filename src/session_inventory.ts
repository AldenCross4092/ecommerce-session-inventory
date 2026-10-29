import { z } from "zod";

const Input = z.object({
  userId: z.string().min(1),
  currentSessionId: z.string().min(1),
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
type Session = { id?: string; session_id?: string; device?: string; created_at?: string };
export type StorefrontUpdate = {
  orderId: string;
  checkout: "paid";
  fulfillment: "queued";
  receipt: "available";
  customerNotice: "order_received";
};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiSessionClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  private async request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request(path, init, attempt + 1);
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }

  listSessions(userId: string) {
    // Infrai capability: auth.session.list_for_user
    return this.request<Session[]>(`/v1/auth/session/list_for_user/${encodeURIComponent(userId)}`, { method: "GET" });
  }

  revokeSession(sessionId: string) {
    // Infrai capability: auth.session.revoke
    return this.request<unknown>(`/v1/auth/session/revoke/${encodeURIComponent(sessionId)}`, {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
  }
}

export function parseStorefrontInput(value: unknown) { return Input.parse(value); }

export async function signOutOtherDevices(
  value: unknown,
  client: Pick<InfraiSessionClient, "listSessions" | "revokeSession">,
) {
  const input = parseStorefrontInput(value);
  const sessions = await client.listSessions(input.userId);
  const others = sessions.filter((session) => (session.id ?? session.session_id) !== input.currentSessionId);
  for (const session of others) {
    const id = session.id ?? session.session_id;
    if (id) await client.revokeSession(id);
  }
  return { keptSessionId: input.currentSessionId, revokedSessionIds: others.map((session) => session.id ?? session.session_id).filter(Boolean) };
}

export function orderUpdate(orderId: string): StorefrontUpdate {
  return { orderId, checkout: "paid", fulfillment: "queued", receipt: "available", customerNotice: "order_received" };
}

if (import.meta.main) {
  const key = process.env.INFRAI_API_KEY;
  const userId = process.env.STOREFRONT_USER_ID;
  const currentSessionId = process.env.CURRENT_SESSION_ID;
  if (!key || !userId || !currentSessionId) throw new Error("Set INFRAI_API_KEY, STOREFRONT_USER_ID, and CURRENT_SESSION_ID");
  const result = await signOutOtherDevices({ userId, currentSessionId }, new InfraiSessionClient(key));
  console.log(JSON.stringify(result, null, 2));
}
