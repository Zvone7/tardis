import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { UserInfo } from "./components/UserInfo";
import { DarkModeToggle } from "./components/DarkModeToggle";
import Link from "next/link";
import { Home } from "lucide-react";
import { ThemeProvider } from "./providers/ThemeProvider";

const envCode = process.env.NEXT_PUBLIC_ENV_CODE?.toLowerCase()
const isLocalEnv = !envCode ? process.env.NODE_ENV !== "production" : envCode === "local"
const isDevEnv = envCode === "dev"
const iconPath = isLocalEnv ? "/favicon-local.svg" : isDevEnv ? "/favicon-dev.svg" : "/favicon.svg"
const titlePrefix = isLocalEnv ? "[L] " : isDevEnv ? "[D] " : ""

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: `${titlePrefix}Trip Planner`,
  description: "Trip planner app",
  icons: {
    icon: iconPath,
    shortcut: iconPath,
    apple: iconPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <ThemeProvider>
          <header className="p-4 flex justify-between items-center">
            <Link href="/trips" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
              <Home className="w-5 h-5" />
              <span className="ml-2 text-sm font-medium">Trips</span>
            </Link>
            <div className="flex items-center gap-2">
              <DarkModeToggle />
              <UserInfo />
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
