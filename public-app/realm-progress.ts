import { useCallback, useEffect, useRef, useState } from "react";
import { platformRequest } from "../src/lib/platform-request";
import { emptyProgress } from "../src/domains/realms/registry";
import type {
  AttemptReceipt,
  RealmProgress,
  RunConfig,
  PerformanceResult,
} from "../src/domains/realms/types";
import { type EconomySnapshot, type GoldAward } from "../src/domains/economy/rewards";
export function useRealmProgress(userId: string, difficulty?: number) {
  const [progress, setProgress] = useState<RealmProgress>(emptyProgress);
  const [economy, setEconomy] = useState<EconomySnapshot>();
  const [awards, setAwards] = useState<Record<string, GoldAward>>({});
  const [confirmed, setConfirmed] = useState<Record<string, { result: PerformanceResult; firstClear: boolean; improved: boolean }>>({});
  const acceptEconomy = useCallback((next?: EconomySnapshot) => { if (next) setEconomy(old => !old || next.revision >= old.revision ? next : old); }, []);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const pending = useRef<AttemptReceipt[]>([]),
    flight = useRef<Promise<void> | null>(null);
  const scope = difficulty ?? 0,
    latestScope = useRef(scope);
  latestScope.current = scope;
  const [loadedScope, setLoadedScope] = useState<number | null>(null);
  const key = `pbb:realm-outbox:v1:${userId}`;
  const request = useCallback(
    async (action: "state" | "finish", receipt?: AttemptReceipt) => {
      const response = await platformRequest(
        {
          action,
          expectedUserId: userId,
          ...(receipt ? { receipt } : { difficulty }),
        },
        "/api/realms",
      );
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error ?? "Your realm progress could not be saved.");
      return body as { progress: RealmProgress; economy?: EconomySnapshot; award?: GoldAward; result?: PerformanceResult; completion?: { firstClear: boolean; improved: boolean } };
    },
    [userId, difficulty],
  );
  const flush = useCallback(() => {
    if (flight.current) return flight.current;
    // Loading an empty outbox must not leave a completed promise blocking later saves.
    if (!pending.current.length) return Promise.resolve();
    const task = (async () => {
      setSaving(true);
      try {
        while (pending.current.length) {
          const receipt = pending.current[0];
          const result = await request("finish", receipt);
          acceptEconomy(result.economy);
          if (result.award) setAwards(old => ({ ...old, [receipt.id]: result.award! }));
          if (result.result) setConfirmed(old => ({ ...old, [receipt.id]: {
            result: result.result!, firstClear: result.completion?.firstClear ?? false, improved: result.completion?.improved ?? false,
          } }));
          pending.current = pending.current.filter((r) => r.id !== receipt.id);
          localStorage.setItem(key, JSON.stringify(pending.current));
          if ((receipt.config.difficulty ?? 0) === latestScope.current) {
            setProgress(result.progress);
            setLoadedScope(latestScope.current);
            setReady(true);
          }
        }
        setError("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
        flight.current = null;
      }
    })();
    flight.current = task;
    return task;
  }, [key, request, acceptEconomy]);
  const reload = useCallback(async () => {
    try {
      const result = await request("state");
      acceptEconomy(result.economy);
      if (scope !== latestScope.current) return;
      setProgress(result.progress);
      setLoadedScope(scope);
      setReady(true);
      setError("");
      await flush();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [flush, request, scope, acceptEconomy]);
  useEffect(() => {
    try {
      pending.current = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (!Array.isArray(pending.current)) throw Error();
    } catch {
      setError(
        "Saved attempts could not be read. Existing local data has been kept.",
      );
      return;
    }
    void reload();
    const online = () => void reload();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [key, reload]);
  const save = useCallback(
    (receipt: AttemptReceipt) => {
      if (!pending.current.some((r) => r.id === receipt.id))
        pending.current.push(receipt);
      try {
        localStorage.setItem(key, JSON.stringify(pending.current));
      } catch {
        setError(
          "Browser storage is full. Keep this page open and retry saving.",
        );
      }
      return flush();
    },
    [flush, key],
  );
  const begin = useCallback(async (attemptId: string, config: RunConfig) => {
    const response = await platformRequest({ action: "begin", expectedUserId: userId, attemptId, config }, "/api/realms");
    if (!response.ok) { const body = await response.json(); throw Error(body.error ?? "Could not start your trial. Please retry."); }
  }, [userId]);
  return {
    economy, awards, confirmed, begin,
    progress: loadedScope === scope ? progress : emptyProgress(),
    ready: ready && loadedScope === scope,
    error,
    saving,
    save,
    retry: reload,
  };
}
