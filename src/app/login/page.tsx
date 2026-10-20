"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { product } from "@/lib/config";
export default function Login() {
  const router = useRouter();
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login" id="main">
      <p className="eyebrow">{product.name}</p>
      <h1>{register ? "Create your account" : "Welcome back"}</h1>
      <p>One account for learning and teaching.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          const args = {
            email: String(data.get("email")),
            password: String(data.get("password")),
          };
          try {
            const result = register
              ? await authClient.signUp.email({
                  ...args,
                  name: String(data.get("name")),
                })
              : await authClient.signIn.email(args);
            if (result.error)
              setError(result.error.message ?? "Unable to sign in");
            else { router.push("/student/home"); router.refresh(); }
          } catch {
            setError("Unable to connect. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <label>
            Name
            <input name="name" autoComplete="name" required maxLength={200} />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={12}
            required
          />
        </label>
        {register && (
          <small>
            Use at least 12 characters. An administrator can enable Teacher
            Studio for your account.
          </small>
        )}
        <button disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
      <button
        className="quiet"
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register ? "Already have an account? Sign in" : "Create an account"}
      </button>
    </main>
  );
}
