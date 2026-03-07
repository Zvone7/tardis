import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Home } from "lucide-react";
import { UserInfo } from "./components/UserInfo";

const envCode = process.env.NEXT_PUBLIC_ENV_CODE?.toLowerCase()
const isLocalEnv = !envCode ? process.env.NODE_ENV !== "production" : envCode === "local"
const isDevEnv = envCode === "dev"
const iconPath = isLocalEnv ? "/favicon-local.svg" : isDevEnv ? "/favicon-dev.svg" : "/favicon.svg"
const titlePrefix = isLocalEnv ? "[L] " : isDevEnv ? "[D] " : ""

export const metadata: Metadata = {
  title: `${titlePrefix}ApartmentPicker`,
  description: "Rank and compare apartments with weighted scoring criteria",
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
      <body className="antialiased min-h-screen">
        <header className="border-b">
          <div className="container mx-auto p-4 flex justify-between items-center">
            <Link href="/ranking-cases" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
              <Home className="w-5 h-5" />
              <span className="ml-2 text-sm font-medium">ApartmentPicker</span>
            </Link>
            <UserInfo />
          </div>
        </header>
        <main className="container mx-auto p-4">
          {children}
        </main>
      </body>
    </html>
  );
}
