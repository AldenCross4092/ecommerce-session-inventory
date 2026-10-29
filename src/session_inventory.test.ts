import assert from "node:assert/strict";
import { signOutOtherDevices } from "./session_inventory.ts";

const calls: string[] = [];
const client = {
  async listSessions(userId: string) { calls.push(`list:${userId}`); return [{ id: "current" }, { id: "tablet" }, { id: "phone" }]; },
  async revokeSession(sessionId: string) { calls.push(`revoke:${sessionId}`); },
};

const result = await signOutOtherDevices({ userId: "customer-42", currentSessionId: "current" }, client);
assert.deepEqual(result, { keptSessionId: "current", revokedSessionIds: ["tablet", "phone"] });
assert.deepEqual(calls, ["list:customer-42", "revoke:tablet", "revoke:phone"]);
console.log("session decision test passed");
