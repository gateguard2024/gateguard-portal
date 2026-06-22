'use client';

// One tabbed "Site Systems" panel — consolidates the per-site system controls
// (Security, Doors, Relays, Network) + corporate-only Setup (Connections) so the
// site view stays clean instead of a long stack of cards.
import React, { useState } from "react";
import { SiteSecurity } from "@/components/nexus/SiteSecurity";
import { SiteDoors } from "@/components/nexus/SiteDoors";
import { SiteRelays } from "@/components/nexus/SiteRelays";
import { SiteNetwork } from "@/components/nexus/SiteNetwork";
import { SiteConnections } from "@/components/nexus/SiteConnections";

export function SiteSystems({ siteId, isCorporate, initialTab }: { siteId: string; isCorporate: boolean; initialTab?: string }) {
  const tabs = [
    { key: "security", label: "🛡 Security" },
    { key: "doors", label: "🚪 Doors" },
    { key: "relays", label: "🔌 Relays" },
    { key: "network", label: "🌐 Network" },
    ...(isCorporate ? [{ key: "setup", label: "🔑 Setup" }] : []),
  ];
  const [tab, setTab] = useState(initialTab && tabs.some(t => t.key === initialTab) ? initialTab : "security");

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)", marginBottom: 10 }}>Site Systems</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            fontSize: 12.5, fontWeight: 600, borderRadius: 999, padding: "6px 13px", cursor: "pointer",
            background: tab === t.key ? "rgba(0,200,255,0.18)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${tab === t.key ? "rgba(0,200,255,0.45)" : "rgba(255,255,255,0.12)"}`,
            color: tab === t.key ? "#7DE5FF" : "rgba(255,255,255,0.6)",
          }}>{t.label}</button>
        ))}
      </div>
      {tab === "security" && <SiteSecurity siteId={siteId} />}
      {tab === "doors" && <SiteDoors siteId={siteId} />}
      {tab === "relays" && <SiteRelays siteId={siteId} />}
      {tab === "network" && <SiteNetwork siteId={siteId} />}
      {tab === "setup" && isCorporate && <SiteConnections siteId={siteId} />}
    </div>
  );
}
