import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { protect } from "@/lib/session";
import { platform } from "@/lib/platform";
import { db } from "@/lib/db";
import { contentAssets } from "@/lib/schema";
import { CourseBuilder } from "@/components/teacher/course-builder";
export default async function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const actor = await protect("TEACHER");
  const { courseId } = await params;
  let data;
  try {
    data = await platform.draft(actor, courseId);
    await platform.courseAccess(actor, courseId, "edit");
  } catch {
    notFound();
  }
  const version = data.draft ?? data.versions[0];
  const [recordings, assets, resources] = await Promise.all([
    platform.recordings(actor),
    db.select().from(contentAssets).where(eq(contentAssets.ownerId, actor.id)),
    platform.resources(version.tree),
  ]);
  return (
    <CourseBuilder
      courseId={courseId}
      initialVersion={version}
      initialVisibility={data.course.visibility}
      initialRecordings={[
        ...new Map(
          [...recordings, ...resources.recordings].map((r) => [r.id, r]),
        ).values(),
      ]}
      assets={[
        ...new Map(
          [...assets, ...resources.assets].map((a) => [a.id, a]),
        ).values(),
      ]}
      canPublish={
        data.course.ownerId === actor.id || actor.roles.includes("ADMIN")
      }
    />
  );
}
