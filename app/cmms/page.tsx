'use client';
// /cmms — the Operations Hub as a standalone glass page (also embedded in the
// Jobs tab). Same component, one source of truth.
//
// This page used to paint its own navy + no grid, which is why the Ops Hub and
// the Work Orders tab inside it had no grid background: OperationsHub itself
// paints nothing (it's a plain grid container and inherits), so the wrapper was
// the whole problem. Now it uses the shared Nexus backdrop like everything else.
import { OperationsHub } from "@/components/nexus/OperationsHub";
import { NexusBackdrop } from "@/components/nexus/NexusBackdrop";

export default function CmmsPage() {
  return (
    <NexusBackdrop variant="page">
      <div style={{ color: "white", fontFamily: "Inter, system-ui, Arial, sans-serif", padding: 24 }}>
        <a href="/?tab=jobs" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.82)", textDecoration: "none", marginBottom: 20, fontSize: 14 }}>← Back to Nexus</a>
        <OperationsHub />
      </div>
    </NexusBackdrop>
  );
}
