import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, syncServerSession } from "./supabase";

export function useAccount() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let active = true, serial = Promise.resolve(), previousUser = "";
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Do not call auth methods inside Supabase's auth-state lock.
      serial = serial.then(async () => {
        try {
          if (!active) return;
          if (event === "PASSWORD_RECOVERY") setRecovery(true);
          if (previousUser && next?.user.id !== previousUser) {
            await syncServerSession();
            location.reload(); // singleton MIDI/session/outbox must never cross accounts
            return;
          }
          await syncServerSession(next?.access_token);
          if (!active) return;
          previousUser = next?.user.id ?? "";
          setSession(next); setError(""); setReady(true);
        } catch (e) { if(active){setError((e as Error).message);setReady(true);} }
      });
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return { session, ready, error, recovery, finishRecovery: () => setRecovery(false) };
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
        setMessage("If this address has an account, you’ll receive a password reset link.");
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
