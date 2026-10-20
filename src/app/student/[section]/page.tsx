import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { protect } from "@/lib/session";
import { platform } from "@/lib/platform";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { ActionButton, Empty } from "@/components/ui/actions";
import { MidiSetup, VirtualKeyboard } from "@/components/midi/setup";
const sections = [
  "home",
  "learn",
  "sight-read",
  "practice",
  "repertoire",
  "progress",
  "profile",
  "settings",
];
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ invitation?: string }>;
}) {
  const actor = await protect("STUDENT"),
    { section } = await params,
    query = await searchParams;
  if (!sections.includes(section)) notFound();
  const courses = await platform.studentCourses(actor);
  if (section === "settings")
    return (
      <>
        <h1>Settings</h1>
        <MidiSetup />
        <VirtualKeyboard />
      </>
    );
  if (section === "profile")
    return (
      <>
        <h1>Your profile</h1>
        <div className="panel">
          <h2>{actor.name}</h2>
          <p>{actor.email}</p>
          <p>{actor.roles.join(" · ")}</p>
        </div>
      </>
    );
  if (["sight-read", "practice", "repertoire"].includes(section)) {
    const title =
      section === "sight-read"
        ? "Sight Read"
        : section === "practice"
          ? "Practice"
          : "Repertoire";
    return (
      <>
        <h1>{title}</h1>
        <Empty
          title={`No ${section === "repertoire" ? "repertoire" : "activities"} yet`}
        >
          Teacher-created and assigned content will appear here when it becomes
          available.
        </Empty>
      </>
    );
  }
  if (section === "progress") {
    const performances = await db
      .select()
      .from(s.performances)
      .where(eq(s.performances.userId, actor.id))
      .orderBy(desc(s.performances.createdAt))
      .limit(100);
    return (
      <>
        <h1>Your progress</h1>
        <div className="grid">
          <div className="metric">
            Enrolled courses<strong>{courses.length}</strong>
          </div>
          <div className="metric">
            Completed courses
            <strong>
              {courses.filter((c) => c.enrollment.completedAt).length}
            </strong>
          </div>
          <div className="metric">
            Recent attempts<strong>{performances.length}</strong>
          </div>
        </div>
        {performances.length ? (
          <div className="table-wrap spacer">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Score</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {performances.map((p) => (
                  <tr key={p.id}>
                    <td>{p.createdAt.toLocaleDateString("en-US")}</td>
                    <td>{p.mode}</td>
                    <td>{Math.round(p.score)}%</td>
                    <td>{p.passed ? "Passed" : "Keep practicing"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Your progress starts here">
            Complete an interactive course activity to save your first
            performance.
          </Empty>
        )}
      </>
    );
  }
  const assignments = await db
    .select()
    .from(s.assignments)
    .where(eq(s.assignments.assignedTo, actor.id));
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Student workspace</p>
          <h1>
            {section === "home"
              ? `Welcome, ${actor.name.split(" ")[0]}`
              : "My courses"}
          </h1>
          <p>
            {section === "home"
              ? "Continue learning at your own pace."
              : "Your enrolled courses and saved progress."}
          </p>
        </div>
      </header>
      {query.invitation && (
        <div className="panel">
          <h2>Teacher invitation</h2>
          <ActionButton
            label="Accept teacher invitation"
            data={{ action: "acceptInvite", token: query.invitation }}
            redirectTo="/student/home"
          />
        </div>
      )}
      {courses.length ? (
        <div className="grid">
          {courses.map(({ enrollment, version }) => (
            <div className="panel course-card" key={enrollment.id}>
              <span className="badge">
                {enrollment.completedAt ? "Completed" : "Enrolled"} · Version{" "}
                {version.number}
              </span>
              <h2>{version.metadata.title}</h2>
              <p>{version.metadata.description}</p>
              <Link href={`/student/courses/${enrollment.id}`}>
                Open course
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No courses yet">
          Your teacher can invite you and assign a course. You can also enroll
          using a published course link.
        </Empty>
      )}
      {assignments.length > 0 && (
        <>
          <h2>Assignments</h2>
          {assignments.map((a) => (
            <div className="panel" key={a.id}>
              <span className="badge">{a.status}</span>
              <p>{a.instructions || "Your teacher has assigned a course."}</p>
            </div>
          ))}
        </>
      )}
      {section === "home" && (
        <div className="panel">
          <h2>Set up your piano</h2>
          <p>
            Connect a MIDI keyboard to play interactive activities, or test
            input with the on-screen keyboard.
          </p>
          <Link href="/student/settings">Open MIDI setup</Link>
        </div>
      )}
    </>
  );
}
