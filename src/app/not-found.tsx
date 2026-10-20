import Link from "next/link";
export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link href="/student/home">Return home</Link>
    </main>
  );
}
