'use client';
// /cmms — the Operations Hub as a standalone page (also opened inline from the
// Operations tab). Same component, one source of truth.
//
// Light look: the same navy-to-light fade as the Operations, Sales and My Day
// pages. The Hub draws its own header (title + back link), so this page only
// paints the background.
import { OperationsHub } from "@/components/nexus/OperationsHub";
import { PAGE_BG_GRADIENT } from "@/components/nexus/tasks/shared";

export default function CmmsPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#EEF2F7", backgroundImage: PAGE_BG_GRADIENT, backgroundRepeat: "no-repeat", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <OperationsHub onBack={() => { window.location.href = "/?tab=jobs"; }} />
      </div>
    </div>
  );
}
