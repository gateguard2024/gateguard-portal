'use client';

import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { ExternalLink } from "lucide-react";
import { BrivoUsersSurface } from "@/components/nexus/BrivoUsersSurface";

const connectActions = (
  <Link
    href="/admin"
    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
    style={{ background: "#6B7EFF" }}
  >
    <ExternalLink size={12} /> Connect Brivo
  </Link>
);

export default function AccessPage() {
  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Access Control" subtitle="Brivo · Site Users" actions={connectActions} />
      <div className="flex-1 p-6 flex justify-center">
        <BrivoUsersSurface />
      </div>
    </div>
  );
}
