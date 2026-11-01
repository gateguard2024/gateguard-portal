'use client';

// Site Systems on the Operations site page — the same panel as the Systems tab
// (status, quick actions, Live · Doors & gates · People · Activity · Faults ·
// Network · Controllers), without the page header. One source for both places.
// 🔒 "Setup & keys" renders only for corporate users (credential endpoints also
// refuse non-corporate server-side).
import React, { useState } from 'react';
import { CSS } from '@/components/nexus/systems/shared';
import { SitePanel } from '@/components/nexus/SiteCommand';

export function SiteSystems({ siteId, isCorporate, initialTab }: { siteId: string; isCorporate: boolean; initialTab?: string; headerTheme?: 'dark' | 'light' }) {
  const [setupReq, setSetupReq] = useState(0);
  return (
    <div className="sy sy-emb">
      <style>{CSS}{'.sy.sy-emb{padding:0;max-width:none}'}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Systems</div>
          <div style={{ fontSize: 13, color: '#6E6E73' }}>Cameras, doors, people, activity and network for this property.</div>
        </div>
        {isCorporate && <button type="button" className="sy-b line" onClick={() => setSetupReq(n => n + 1)}>Setup &amp; keys</button>}
      </div>
      {/* initialTab "setup" (new sites) opens the vendor logins straight away. */}
      <SitePanel siteId={siteId} isCorporate={isCorporate} initialSetup={initialTab === 'setup'} setupRequest={setupReq} />
    </div>
  );
}
