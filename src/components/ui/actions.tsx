"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { platformRequest } from "../../lib/platform-request";
export async function command<T = unknown>(data: unknown): Promise<T> {
  const response = await platformRequest(data);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result;
}
export function ActionButton({
  label,
  data,
  redirectTo,
}: {
  label: string;
  data: unknown;
  redirectTo?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await command(data);
            if (redirectTo) router.push(redirectTo);
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : label}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}
