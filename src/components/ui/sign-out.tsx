"use client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="quiet"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
