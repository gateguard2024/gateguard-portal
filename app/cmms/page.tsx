'use client';
// /cmms — the Operations Hub as a standalone glass page (also embedded in the
// Jobs tab). Same component, one source of truth.
import { OperationsHub } from "@/components/nexus/OperationsHub";

export default function CmmsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% -8%, rgba(0,124,255,0.10), transparent 55%), linear-gradient(180deg, #0a1430 0%, #060b1a 60%, #04060f 100%)", color: "white", fontFamily: "Inter, system-ui, Arial, sans-serif", padding: 24 }}>
      <a href="/?tab=jobs" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.82)", textDecoration: "none", marginBottom: 20, fontSize: 14 }}>← Back to Nexus</a>
      <OperationsHub />
    </div>
  );
}
