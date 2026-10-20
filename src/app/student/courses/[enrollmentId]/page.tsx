import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { protect } from "@/lib/session";
import { platform } from "@/lib/platform";
import { db } from "@/lib/db";
import { lessonProgress } from "@/lib/schema";
export default async function Page({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const actor = await protect("STUDENT"),
    { enrollmentId } = await params;
  let data;
  try {
    data = await platform.enrolled(actor, enrollmentId);
  } catch {
    notFound();
  }
  const progress = await db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.enrollmentId, enrollmentId));
  return (
    <>
      <p className="eyebrow">Version {data.version.number}</p>
      <h1>{data.version.metadata.title}</h1>
      <p>{data.version.metadata.description}</p>
      {data.version.tree.modules.map((m) => (
        <section className="panel" key={m.id}>
          <h2>{m.title}</h2>
          {m.lessons.map((l) => (
            <p key={l.id}>
              <Link href={`/student/courses/${enrollmentId}/lessons/${l.id}`}>
                {l.title}
              </Link>
              {progress.some((p) => p.lessonId === l.id) && (
                <span className="badge">Completed</span>
              )}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
