"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>We couldn’t load this page</h1>
      <p>Check your connection and try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
