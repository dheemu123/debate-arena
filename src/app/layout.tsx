import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DebateArena",
  description:
    "Structured LLM debates with multi-judge evaluation and human feedback",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <nav className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-accent-foreground"
            >
              DebateArena
            </Link>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/create" className="hover:text-foreground transition">
                Create
              </Link>
              <Link href="/gallery" className="hover:text-foreground transition">
                Gallery
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
