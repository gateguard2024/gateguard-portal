'use client';

// Site Systems — a single scrolling, widget-based dashboard for everything we run
// at a property: live cameras, doors (unlock + camera linking), recent activity,
// network, relays, and controllers. Real per-site data via each widget's API.
// Corporate-only credential setup lives behind the ⚙ gear (dealers never see keys).
import React, { useState } from "react";
import { Settings } from "lucide-react";
import { SiteSecurity } from "@/components/nexus/SiteSecurity";
import { SiteDoors } from "@/components/nexus/SiteDoors";
import { SiteRelays } from "@/components/nexus/SiteRelays";
import { SiteNetwork } from "@/components/nexus/SiteNetwork";
import { SitePanels } from "@/components/nexus/SitePanels";
import { SiteActivity } from "@/components/nexus/SiteActivity";
import { SiteConnections } from "@/components/nexus/SiteConnections";

export function SiteSystems({ siteId, isCorporate, initialTab }: { siteId: string; isCorporate: boolean; initialTab?: string }) {
  // initialTab "setup" opens the credential panel straight away (e.g. new sites).
  const [showSetup, setShowSetup] = useState(initialTab === "setup");

  const gear = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, borderRadius: 999, padding: "7px 14px", cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.8)" } as const;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>Site Systems</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Live cameras, doors, network &amp; more — all this property&apos;s systems in one place.</div>
        </div>
        {isCorporate && (
          <button onClick={() => setShowSetup(s => !s)} style={gear}><Settings size={14} /> {showSetup ? "Hide setup" : "Setup & keys"}</button>
        )}
      </div>

      {/* Corporate-only: vendor credentials + connect (collapsed by default). */}
      {isCorporate && showSetup && <SiteConnections siteId={siteId} />}

      {/* Widgets — one scrolling dashboard. */}
      <SiteSecurity siteId={siteId} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>
        <SiteDoors siteId={siteId} />
        <SiteActivity siteId={siteId} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>
        <SiteNetwork siteId={siteId} />
        <SiteRelays siteId={siteId} />
      </div>

      <SitePanels siteId={siteId} isCorporate={isCorporate} />
    </div>
  );
}
