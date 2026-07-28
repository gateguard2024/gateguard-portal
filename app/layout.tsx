import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PortalShell } from "@/components/layout/PortalShell";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400","500","700"], variable: "--font-dm-sans" });
// IBM Plex Mono is the design system's mono (tech chips, ARIA machine UI). It was
// referenced by Tailwind `font-mono` but never actually loaded, so every mono element
// fell back to the OS Courier/Menlo — the "legacy" look. Load it as a CSS variable.
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: { default: "GateGuard Nexus", template: "%s — GateGuard Nexus" },
  description: "The operating system for multifamily access and channel dealer networks.",
  icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nexus',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#020713',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Satellite domain: when beta runs under the PRODUCTION Clerk instance it is a
  // satellite of the primary domain. These are set on beta only (blank on main),
  // so main renders ClerkProvider exactly as before.
  const isSatellite = process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === 'true';
  // Typed as any: ClerkProvider's props are a discriminated union that rejects a
  // string|undefined domain; this is a pass-through config object, not app logic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const satelliteProps: any = isSatellite
    ? {
        isSatellite: true,
        domain: process.env.NEXT_PUBLIC_CLERK_DOMAIN,
        signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
      }
    : {};
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${plexMono.variable} font-sans`}>
        <ClerkProvider {...satelliteProps}>
          <ServiceWorkerRegistration />
          <OfflineBanner />
          <PortalShell>{children}</PortalShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
