import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TrainingLMS",
  description: "Fire department training LMS and shift exchange",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <AppHeader />
        <main className="min-h-[calc(100vh-5rem)] flex-1">{children}</main>
        <footer className="mt-auto border-t bg-muted/50 py-8">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>TrainingLMS · Fire Department Training</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
