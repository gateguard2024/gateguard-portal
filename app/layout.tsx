import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PortalShell } from "@/components/layout/PortalShell";
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
        <ClerkProvider>
          <PortalShell>{children}</PortalShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
