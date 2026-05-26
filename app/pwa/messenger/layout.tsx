import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "GateGuard Messenger",
  description: "Unified company communications — SMS, email, org chat",
  manifest: "/pwa-messenger-manifest.json",
  appleWebApp: {
    capable:       true,
    statusBarStyle: "black-translucent",
    title:         "GG Messenger",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width:              "device-width",
  initialScale:       1,
  maximumScale:       1,
  userScalable:       false,
  themeColor:         "#6B7EFF",
  viewportFit:        "cover",
};

export default function PwaMessengerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Service worker registration */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw-messenger.js')
                  .catch(function(err) { console.log('SW registration failed:', err); });
              });
            }
          `,
        }}
      />
      {children}
    </>
  );
}
