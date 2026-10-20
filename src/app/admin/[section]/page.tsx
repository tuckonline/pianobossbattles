import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { protect } from "@/lib/session";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { ActionButton, Empty } from "@/components/ui/actions";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  await protect("ADMIN");
  const { section } = await params;
  if (
    ![
      "users",
      "teachers",
      "courses",
      "published-content",
      "reports",
      "system",
    ].includes(section)
  )
    notFound();
  if (section === "users" || section === "teachers") {
    const users = await db.select().from(s.user).limit(200),
      roles = await db.select().from(s.userRoles);
    return (
      <>
        <h1>{section === "users" ? "Users" : "Teachers"}</h1>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter(
                  (u) =>
                    section === "users" ||
                    roles.some(
                      (r) => r.userId === u.id && r.role === "TEACHER",
                    ),
                )
                .map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      {roles
                        .filter((r) => r.userId === u.id)
                        .map((r) => r.role)
                        .join(", ")}
                    </td>
                    <td>
                      {!roles.some(
                        (r) => r.userId === u.id && r.role === "TEACHER",
                      ) && (
                        <ActionButton
                          label="Grant Teacher role"
                          data={{
                            action: "grantRole",
                            userId: u.id,
                            role: "TEACHER",
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  if (section === "courses" || section === "published-content") {
    const courses = await db.select().from(s.courses);
    return (
      <>
        <h1>{section === "courses" ? "Courses" : "Published content"}</h1>
        {courses
          .filter((c) => section === "courses" || c.status === "PUBLISHED")
          .map((c) => (
            <div className="panel" key={c.id}>
              <h2>{c.metadata.title}</h2>
              <p>
                {c.status} · {c.visibility}
              </p>
              <ActionButton
                label="Archive course"
                data={{
                  action: "moderate",
                  courseId: c.id,
                  status: "ARCHIVED",
                  notes: "Archived through Admin content view",
                }}
              />
            </div>
          ))}
      </>
    );
  }
  if (section === "reports") {
    const reports = await db.select().from(s.reports);
    return (
      <>
        <h1>Reports</h1>
        {reports.length ? (
          reports.map((r) => (
            <div className="panel" key={r.id}>
              <strong>{r.status}</strong>
              <p>{r.reason}</p>
            </div>
          ))
        ) : (
          <Empty title="No content reports" />
        )}
      </>
    );
  }
  const log = await db
    .select()
    .from(s.auditLog)
    .orderBy(desc(s.auditLog.createdAt))
    .limit(100);
  return (
    <>
      <h1>System</h1>
      <h2>Audit history</h2>
      {log.length ? (
        log.map((row) => (
          <p key={row.id}>
            {row.createdAt.toISOString()} · {row.action}
          </p>
        ))
      ) : (
        <Empty title="No administrative actions yet" />
      )}
    </>
  );
}
