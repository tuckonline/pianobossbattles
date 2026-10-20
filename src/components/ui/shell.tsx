import Link from "next/link";
import { product } from "@/lib/config";
import { SignOut } from "./sign-out";
const student = [
  "Home",
  "Learn",
  "Sight Read",
  "Practice",
  "Repertoire",
  "Progress",
  "Profile",
  "Settings",
];
const teacher = [
  "Dashboard",
  "Courses",
  "Students",
  "Analytics",
  "Media",
  "Content Library",
  "Settings",
];
const admin = [
  "Users",
  "Teachers",
  "Courses",
  "Published Content",
  "Reports",
  "System",
];
export function Shell({
  area,
  name,
  roles,
  children,
}: {
  area: "student" | "teacher" | "admin";
  name: string;
  roles: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside>
        <Link className="brand" href="/student/home">
          <span className="brand-mark">▥</span>
          {product.name}
        </Link>
        <p className="eyebrow">
          {area === "teacher"
            ? "Teacher Studio"
            : area === "admin"
              ? "Administration"
              : "Student workspace"}
        </p>
        <nav aria-label={`${area} navigation`}>
          {(area === "student"
            ? student
            : area === "teacher"
              ? teacher
              : admin
          ).map((label) => (
            <Link
              key={label}
              href={`/${area}/${label.toLowerCase().replaceAll(" ", "-")}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="workspace-switch">
          <Link href="/student/home">Student workspace</Link>
          {roles.includes("TEACHER") && (
            <Link href="/teacher/dashboard">Teacher Studio</Link>
          )}
          {roles.includes("ADMIN") && <Link href="/admin/users">Admin</Link>}
        </div>
        <div className="account">
          <span>{name}</span>
          <SignOut />
        </div>
      </aside>
      <main id="main">{children}</main>
    </div>
  );
}
