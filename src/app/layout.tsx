import type { Metadata } from "next";
import { product } from "@/lib/config";
import "./globals.css";
export const metadata: Metadata = {
  title: product.name,
  description: product.description,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
