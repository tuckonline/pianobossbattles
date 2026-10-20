import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { user, userRoles, teacherProfiles } from "../src/lib/schema";
const [email, role] = process.argv.slice(2);
if (!email || !["STUDENT", "TEACHER", "ADMIN"].includes(role))
  throw new Error("Usage: npm run grant-role -- email STUDENT|TEACHER|ADMIN");
const [u] = await db.select().from(user).where(eq(user.email, email));
if (!u) throw new Error("User must register first");
await db
  .insert(userRoles)
  .values({ userId: u.id, role: role as "STUDENT" | "TEACHER" | "ADMIN" })
  .onConflictDoNothing();
if (role === "TEACHER")
  await db
    .insert(teacherProfiles)
    .values({ userId: u.id, displayName: u.name })
    .onConflictDoNothing();
console.log(`Granted ${role} to ${email}`);
process.exit(0);
