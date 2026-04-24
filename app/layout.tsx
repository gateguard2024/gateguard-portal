import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300","400","500","600","700","800"] });

export const metadata: Metadata = {
  title: { default: "GateGuard OS", template: "%s — GateGuard OS" },
  description: "The all-in-one security operations platform for dealers, MSOs, and properties.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" disableTransitionOnChange>
          <div className="flex h-screen overflow-hidden relative">
            {/* Gate background image at 8% opacity — place gate-bg.jpg in /public to activate */}
            <div className="gate-bg-layer" aria-hidden="true" />
            <Sidebar />
            <main className="flex-1 flex flex-col ml-64 overflow-y-auto min-w-0 transition-all duration-200 relative z-10">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
