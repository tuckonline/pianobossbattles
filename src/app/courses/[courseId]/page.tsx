import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { protect } from "@/lib/session";
import { db } from "@/lib/db";
import { courses, publishedVersions, versions } from "@/lib/schema";
import { ActionButton } from "@/components/ui/actions";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  await protect("STUDENT");
  const { courseId } = await params;
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.status, "PUBLISHED")));
  if (!course || course.visibility === "PRIVATE") notFound();
  const [published] = await db
    .select({ version: versions })
    .from(publishedVersions)
    .innerJoin(versions, eq(publishedVersions.versionId, versions.id))
    .where(eq(publishedVersions.courseId, courseId));
  if (!published) notFound();
  return (
    <main id="main">
      <p className="eyebrow">Published course</p>
      <h1>{published.version.metadata.title}</h1>
      <p>{published.version.metadata.description}</p>
      {published.version.metadata.accessPolicy === "FREE" ? (
        <ActionButton
          label="Enroll in course"
          data={{ action: "enroll", courseId }}
          redirectTo="/student/learn"
        />
      ) : (
        <p>Contact the teacher for access.</p>
      )}
    </main>
  );
}
