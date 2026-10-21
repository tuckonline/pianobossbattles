type SessionRecovery = () => Promise<boolean>;
let recoverSession: SessionRecovery | undefined;
let recovering: Promise<boolean> | undefined;

// Supplied only by the independent public app. Legacy/Sites auth is unchanged.
export function configurePlatformSessionRecovery(recover?: SessionRecovery) {
  recoverSession = recover;
}

export async function platformRequest(data: unknown): Promise<Response> {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
  const response = await fetch("/api/platform", options);
  const recover = recoverSession;
  if (response.status !== 401 || !recover) return response;
  // A rejected request has not reached gameplay/SQL. Retry the exact receipt
  // once after renewing the server cookie; never loop or clear the outbox.
  if (!recovering) {
    const pending = Promise.resolve().then(recover).catch(() => false);
    recovering = pending;
    void pending.finally(() => { if (recovering === pending) recovering = undefined; });
  }
  return await recovering ? fetch("/api/platform", options) : response;
}
