import { protect } from "@/lib/session";
import { Shell } from "@/components/ui/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await protect("TEACHER");
  return (
    <Shell area="teacher" name={actor.name} roles={actor.roles}>
      {children}
    </Shell>
  );
}
