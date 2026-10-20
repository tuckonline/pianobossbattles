import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { authCallback, supabase, syncServerSession } from "./supabase";

export function useAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const recoveryComplete = useRef(false);
  useEffect(() => {
    let active = true, serial = Promise.resolve(), previousUser = "";
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Do not call auth methods inside Supabase's auth-state lock.
      serial = serial.then(async () => {
        try {
          if (!active) return;
          const initialized = await supabase.auth.initialize();
          if (!active) return;
          if (initialized.error || authCallback.hasError) {
            throw new Error("This email link could not be verified. It may have expired or already been used. Request a new link and open it in the same browser where you requested it.");
          }
          // Without the original browser's PKCE verifier, the SDK silently skips
          // code exchange. Do not disguise that failure as an ordinary login.
          if (authCallback.hasCode && new URL(location.href).searchParams.has("code")) {
            throw new Error("This email link was opened in a different browser or its recovery data is missing. Open the link in the same browser where you requested it. If it has expired, request a new reset link there.");
          }
          const recoveryRequested = new URL(location.href).searchParams.get("recovery") === "1";
          if (recoveryRequested && !next) {
            throw new Error("No verified password-reset session is available. Request a new reset link and open it in the same browser.");
          }
          if (previousUser && next?.user.id !== previousUser) {
            await syncServerSession();
            location.reload(); // singleton MIDI/session/outbox must never cross accounts
            return;
          }
          await syncServerSession(next?.access_token);
          if (!active) return;
          if (next && !recoveryComplete.current && (event === "PASSWORD_RECOVERY" || recoveryRequested)) {
            // Keep the form across reloads and late subscriptions to INITIAL_SESSION.
            // This flag selects the UI only; Supabase and the API still verify the session.
            const url = new URL(location.href);
            url.searchParams.set("recovery", "1");
            history.replaceState(history.state, "", url);
            setRecovery(true);
          } else if (!next) setRecovery(false);
          previousUser = next?.user.id ?? "";
          setSession(next); setError(""); setReady(true);
        } catch (e) { if(active){setError((e as Error).message);setReady(true);} }
      });
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return { session, ready, error, recovery, finishRecovery: () => {
    recoveryComplete.current = true;
    const url = new URL(location.href);
    url.searchParams.delete("recovery");
    history.replaceState(history.state, "", url);
    setRecovery(false);
  } };
}
export function AccountForm({ recovery=false, onRecovered }: { recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<"login"|"register"|"reset">("login");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");setMessage("");
    const form=new FormData(event.currentTarget), email=String(form.get("email")??"").trim(),password=String(form.get("password")??"");
    try {
      if(recovery){const r=await supabase.auth.updateUser({password});if(r.error)throw r.error;setMessage("Password updated.");onRecovered?.();}
      else if(mode==="register"){
        const r=await supabase.auth.signUp({email,password,options:{data:{name:String(form.get("name")).trim()},emailRedirectTo:location.origin+"/"}});
        if(r.error)throw r.error;setMessage("Check your email to verify your account, then sign in.");
      } else if(mode==="reset"){
        const r=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/?recovery=1"});if(r.error)throw r.error;
        setMessage("If this address has an account, you’ll receive a password reset link. Open it in this same browser. If your email app opens another browser, copy the email link into this browser’s address bar. Never share the link.");
      } else { const r=await supabase.auth.signInWithPassword({email,password});if(r.error)throw r.error; }
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const title=recovery?"Choose a new password":mode==="register"?"Create your player account":mode==="reset"?"Reset your password":"Welcome back, pianist";
  return <section className="account-card" aria-label="Player account">
    <span className="eyebrow">YOUR NEXT CHAPTER</span><h2>{title}</h2>
    <p>Save your progress. Build your skills. Take on the next boss.</p>
    <form onSubmit={submit}>
      {!recovery&&mode==="register"&&<label>Player name<input name="name" autoComplete="name" required maxLength={80}/></label>}
      {!recovery&&<label>Email<input type="email" name="email" autoComplete="email" required maxLength={254}/></label>}
      {(recovery||mode!=="reset")&&<label>Password<input aria-label="Password" type="password" name="password" autoComplete={recovery||mode==="register"?"new-password":"current-password"} required minLength={recovery||mode==="register"?12:1}/>{(recovery||mode==="register")&&<small>Use at least 12 characters.</small>}</label>}
      <button className="primary" disabled={busy}>{busy?"Please wait…":recovery?"Update password":mode==="register"?"Create account":mode==="reset"?"Send reset link":"Log in"}</button>
    </form>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
    {!recovery&&<div className="account-links">{mode!=="login"&&<button onClick={()=>{setMode("login");setError("");setMessage("");}}>Log in</button>}{mode!=="register"&&<button onClick={()=>{setMode("register");setError("");setMessage("");}}>Create account</button>}{mode==="login"&&<button onClick={()=>{setMode("reset");setError("");setMessage("");}}>Forgot password?</button>}</div>}
  </section>;
}
