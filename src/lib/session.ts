import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { userRoles } from "./schema";
import {
  DomainError,
  requireRole,
  type Role,
} from "@/domains/auth/permissions";
export async function getActor() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new DomainError("Please sign in", 401);
  const roles = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, session.user.id));
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: roles.map((r) => r.role),
  };
}
export async function protect(role?: Role) {
  let actor;
  try {
    actor = await getActor();
  } catch {
    redirect("/login");
  }
  if (role)
    try {
      requireRole(actor, role);
    } catch {
      redirect("/student/home?access=denied");
    }
  return actor;
}
