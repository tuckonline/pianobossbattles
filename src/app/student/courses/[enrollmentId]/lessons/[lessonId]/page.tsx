import { notFound } from "next/navigation";
import { protect } from "@/lib/session";
import { platform } from "@/lib/platform";
import { LessonRenderer } from "@/components/lesson/renderer";
export default async function Page({
  params,
}: {
  params: Promise<{ enrollmentId: string; lessonId: string }>;
}) {
  const actor = await protect("STUDENT"),
    { enrollmentId, lessonId } = await params;
  let data;
  try {
    data = await platform.enrolled(actor, enrollmentId);
  } catch {
    notFound();
  }
  const lesson = data.version.tree.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === lessonId);
  if (!lesson) notFound();
  const resources = await platform.resources({
    modules: [{ id: "authorized", title: "", lessons: [lesson] }],
  });
  return (
    <LessonRenderer
      lesson={lesson}
      enrollmentId={enrollmentId}
      {...resources}
    />
  );
}
