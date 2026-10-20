import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
import * as schema from "./schema";
import { product } from "./config";
export const auth = betterAuth({
  appName: product.name,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  database: drizzleAdapter(db, { provider: "pg", schema }),
  rateLimit: { enabled: true, window: 60, max: 100 },
  databaseHooks: {
    user: {
      create: {
        after: async (u) => {
          await db
            .insert(schema.userRoles)
            .values({ userId: u.id, role: "STUDENT" })
            .onConflictDoNothing();
          await db
            .insert(schema.studentProfiles)
            .values({ userId: u.id })
            .onConflictDoNothing();
        },
      },
    },
  },
});
