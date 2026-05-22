import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PortalShell } from "@/components/layout/PortalShell";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["300","400","500","600","700","800"] });

export const metadata: Metadata = {
  title: { default: "GateGuard Nexus", template: "%s — GateGuard Nexus" },
  description: "The operating system for multifamily access and channel dealer networks.",
  icons: { icon: "/favicon.ico" },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GG Tech',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1728',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClerkProvider>
          {/* Client-side SW registration — no render output */}
          <ServiceWorkerRegistration />
          {/* Offline status banner — fixed top, only shown when offline */}
          <OfflineBanner />
          <PortalShell>{children}</PortalShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
