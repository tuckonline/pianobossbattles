import { createClient } from "@supabase/supabase-js";
const env = import.meta.env;
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
export async function syncServerSession(accessToken?: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!response.ok) throw new Error("Could not establish your secure game session. Please sign in again.");
}
