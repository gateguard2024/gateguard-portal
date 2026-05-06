import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PortalShell } from "@/components/layout/PortalShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300","400","500","600","700","800"] });

export const metadata: Metadata = {
  title: { default: "GateGuard Nexus", template: "%s — GateGuard Nexus" },
  description: "The operating system for multifamily access and channel dealer networks.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClerkProvider>
          <PortalShell>{children}</PortalShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
