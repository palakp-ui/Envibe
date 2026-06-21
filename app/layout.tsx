import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Envibe Relational Assessment",
  description:
    "Behavioral assessment MVP for explainable relational style profiling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            Envibe
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/assessment">Candidate assessment</Link>
            <Link href="/developer">Developer dashboard</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
