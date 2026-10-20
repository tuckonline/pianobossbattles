import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { protect } from "@/lib/session";
import { platform } from "@/lib/platform";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
import { Empty } from "@/components/ui/actions";
import { CreateCourse } from "@/components/teacher/course-builder";
import {
  InviteStudent,
  AssignCourse,
  AddMedia,
} from "@/components/teacher/management";
import { MidiSetup, VirtualKeyboard } from "@/components/midi/setup";
const sections = [
  "dashboard",
  "courses",
  "students",
  "analytics",
  "media",
  "content-library",
  "settings",
];
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const actor = await protect("TEACHER"),
    { section } = await params;
  if (!sections.includes(section)) notFound();
  const courses = await platform.teacherCourses(actor);
  const title =
    section === "content-library"
      ? "Content Library"
      : section[0].toUpperCase() + section.slice(1);
  if (section === "settings")
    return (
      <>
        <h1>Studio settings</h1>
        <p>
          {actor.name} · {actor.email}
        </p>
        <MidiSetup />
        <VirtualKeyboard />
      </>
    );
  if (section === "media") {
    const assets = await db
        .select()
        .from(s.contentAssets)
        .where(eq(s.contentAssets.ownerId, actor.id)),
      recordings = await platform.recordings(actor);
    return (
      <>
        <h1>Media library</h1>
        <AddMedia />
        {!assets.length && !recordings.length ? (
          <Empty title="Your media library is empty">
            Add hosted media here, or record MIDI in the lesson builder.
          </Empty>
        ) : (
          <div className="grid">
            {[
              ...assets.map((a) => ({
                id: a.id,
                title: a.title,
                kind: a.kind,
              })),
              ...recordings.map((r) => ({
                id: r.id,
                title: r.title,
                kind: "MIDI",
              })),
            ].map((a) => (
              <div className="panel" key={a.id}>
                <span className="badge">{a.kind}</span>
                <h2>{a.title}</h2>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }
  if (section === "content-library")
    return (
      <>
        <h1>{title}</h1>
        <Empty title="No reusable content yet">
          Your future exercises, sight-reading collections, and repertoire will
          live here. Course lessons are authored in Courses.
        </Empty>
      </>
    );
  if (section === "courses")
    return (
      <>
        <header className="page-head">
          <div>
            <p className="eyebrow">Teacher Studio</p>
            <h1>Courses</h1>
            <p>Create, preview, and publish your courses.</p>
          </div>
        </header>
        <CreateCourse />
        {courses.length ? (
          <div className="grid">
            {courses.map((c) => (
              <div className="panel course-card" key={c.id}>
                <span className="badge">
                  {c.status} · {c.visibility}
                </span>
                <h2>
                  <Link href={`/teacher/courses/${c.id}`}>
                    {c.metadata.title}
                  </Link>
                </h2>
                <p>{c.metadata.shortDescription || "No description yet"}</p>
                <Link href={`/teacher/courses/${c.id}`}>
                  Open course builder
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Create your first course">
            Start with a title, then add modules, lessons, and interactive
            blocks.
          </Empty>
        )}
      </>
    );
  const analytics = await platform.analytics(actor);
  if (section === "students") {
    const students = await db
      .select({ id: s.user.id, name: s.user.name })
      .from(s.relationships)
      .innerJoin(s.user, eq(s.relationships.studentId, s.user.id))
      .where(eq(s.relationships.teacherId, actor.id));
    return (
      <>
        <h1>Your students</h1>
        <div className="grid">
          <InviteStudent />
          <AssignCourse
            courses={courses
              .filter((c) => c.status === "PUBLISHED")
              .map((c) => ({ id: c.id, title: c.metadata.title }))}
            students={students}
          />
        </div>
        {students.length ? (
          <div className="panel">
            {students.map((s) => (
              <p key={s.id}>{s.name}</p>
            ))}
          </div>
        ) : (
          <Empty title="No connected students">
            Invite a student to start assigning courses.
          </Empty>
        )}
        <h2>Lesson completions</h2>
        <p>
          {analytics.progress.length} completed lessons across your courses.
        </p>
      </>
    );
  }
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Teacher Studio</p>
          <h1>
            {section === "dashboard"
              ? `Welcome, ${actor.name.split(" ")[0]}`
              : title}
          </h1>
          <p>
            {section === "dashboard"
              ? "Your teaching workspace."
              : "Course engagement and recent student performances."}
          </p>
        </div>
        <Link href="/teacher/courses">Manage courses</Link>
      </header>
      <div className="grid">
        <div className="metric">
          Courses<strong>{courses.length}</strong>
        </div>
        <div className="metric">
          Published
          <strong>
            {courses.filter((c) => c.status === "PUBLISHED").length}
          </strong>
        </div>
        <div className="metric">
          Enrolled students
          <strong>
            {
              new Set(analytics.students.map((s) => s.enrollment.studentId))
                .size
            }
          </strong>
        </div>
        <div className="metric">
          Completed lessons<strong>{analytics.progress.length}</strong>
        </div>
      </div>
      <h2 className="spacer">Recent performances</h2>
      {analytics.performances.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Result</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {analytics.performances.map((p) => (
                <tr key={p.id}>
                  <td>
                    {analytics.students.find(
                      (s) => s.enrollment.studentId === p.userId,
                    )?.name ?? "Student"}
                  </td>
                  <td>{Math.round(p.score)}%</td>
                  <td>{p.passed ? "Passed" : "Practice needed"}</td>
                  <td>{p.createdAt.toLocaleDateString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No performances yet">
          Student activity will appear here after an enrolled student completes
          an exercise.
        </Empty>
      )}
      <h2 className="spacer">Course activity</h2>
      {courses.length ? (
        courses.map((c) => (
          <div className="panel" key={c.id}>
            <Link href={`/teacher/courses/${c.id}`}>{c.metadata.title}</Link>
            <p className="muted">
              {c.status} ·{" "}
              {
                analytics.students.filter((s) => s.enrollment.courseId === c.id)
                  .length
              }{" "}
              enrollments
            </p>
          </div>
        ))
      ) : (
        <Empty title="A blank canvas for your teaching">
          <Link href="/teacher/courses">Create a course</Link> to start
          building.
        </Empty>
      )}
    </>
  );
}
