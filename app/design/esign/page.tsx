"use client";
import { useState } from "react";
import { FileText, Send, Eye, Copy, Plus, X, Check, Clock, AlertTriangle } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { FileSignature } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = 'pending'|'viewed'|'signed'|'declined'|'expired';

type ESignDoc = {
  id: string;
  name: string;
  type: string;
  status: DocStatus;
  signer: string;
  email: string;
  sentAt: string;
  signedAt: string | null;
};

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_DOCS: ESignDoc[] = [
  { id:'e1', name:'Sunset Commons Service Agreement',    type:'contract',    status:'signed',   signer:'Marcus Webb',    email:'mwebb@sunsetcommons.com',  sentAt:'2026-05-10', signedAt:'2026-05-11' },
  { id:'e2', name:'Riverview Apts - Quote #Q-4421',     type:'quote',       status:'viewed',   signer:'Dana Okonkwo',   email:'dana@riverviewpm.com',      sentAt:'2026-05-19', signedAt: null },
  { id:'e3', name:'Harbor Point NDA',                   type:'nda',         status:'pending',  signer:'James Tillman',  email:'jtillman@harborpoint.com',  sentAt:'2026-05-21', signedAt: null },
  { id:'e4', name:'Lakewood HOA - WO Sign-off',         type:'work_order',  status:'signed',   signer:'Sandra Ruiz',    email:'sruiz@lakewoodhoa.com',     sentAt:'2026-05-18', signedAt:'2026-05-18' },
  { id:'e5', name:'Tech NDA - Rick Cabrera',            type:'nda',         status:'declined', signer:'Rick Cabrera',   email:'rcabrera@gmail.com',        sentAt:'2026-05-15', signedAt: null },
  { id:'e6', name:'Cedar Grove Master Agreement',       type:'contract',    status:'pending',  signer:'Alicia Fenn',    email:'afenn@cedargrove.com',      sentAt:'2026-05-22', signedAt: null },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg: Record<DocStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#D97706', icon: <Clock size={10} /> },
    viewed:   { label: 'Viewed',   bg: '#EFF6FF', text: '#3B82F6', icon: <Eye size={10} /> },
    signed:   { label: 'Signed',   bg: '#ECFDF5', text: '#10B981', icon: <Check size={10} /> },
    declined: { label: 'Declined', bg: '#FEF2F2', text: '#EF4444', icon: <X size={10} /> },
    expired:  { label: 'Expired',  bg: '#F8FAFC', text: '#94A3B8', icon: <AlertTriangle size={10} /> },
  };
  const c = cfg[status];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.text }}>
      {c.icon} {c.label}
    </span>
  );
}

function typeLabel(t: string) {
  const m: Record<string, string> = { contract: 'Contract', quote: 'Quote', nda: 'NDA', work_order: 'WO Sign-off' };
  return m[t] ?? t;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ESignPage() {
  const [docs, setDocs] = useState<ESignDoc[]>(DEMO_DOCS);
  const [showSlideOver, setShowSlideOver] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'contract', signerName: '', signerEmail: '', expiry: '' });
  const [copied, setCopied] = useState<string|null>(null);

  const pending = docs.filter(d => d.status === 'pending').length;
  const awaiting = docs.filter(d => d.status === 'viewed').length;
  const signed = docs.filter(d => d.status === 'signed').length;
  const total = docs.length;

  function handleSend() {
    if (!form.name || !form.signerEmail) return;
    const newDoc: ESignDoc = {
      id: `e-${Date.now()}`,
      name: form.name,
      type: form.type,
      status: 'pending',
      signer: form.signerName,
      email: form.signerEmail,
      sentAt: new Date().toISOString().slice(0,10),
      signedAt: null,
    };
    setDocs(d => [newDoc, ...d]);
    setShowSlideOver(false);
    setForm({ name: '', type: 'contract', signerName: '', signerEmail: '', expiry: '' });
  }

  function copyLink(docId: string) {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/design/esign/sign/${docId}`;
    void navigator.clipboard.writeText(url);
    setCopied(docId);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileSignature size={20} className="text-[#6B7EFF]" />
            E-Sign
          </h1>
          <p className="text-xs text-gray-500">Send, track, and collect document signatures</p>
        </div>
        <button onClick={() => setShowSlideOver(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-[#6B7EFF] text-white rounded-lg text-sm font-semibold hover:bg-[#5a6ee8] transition-colors">
          <Plus size={14} /> New Document
        </button>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        {[
          { label: 'Awaiting Signature', value: pending, color: '#F59E0B' },
          { label: 'Sent / Viewed',      value: awaiting, color: '#3B82F6' },
          { label: 'Signed This Month',  value: signed,   color: '#10B981' },
          { label: 'Total Docs',         value: total,    color: '#6B7EFF' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-3">
            <div className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-gray-500 leading-tight">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Document</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Signer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Sent</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Signed</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr key={doc.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{doc.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{doc.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold uppercase">{typeLabel(doc.type)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{doc.signer || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{doc.sentAt}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{doc.signedAt ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {(doc.status === 'pending' || doc.status === 'viewed') && (
                        <button className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded text-[10px] font-semibold hover:bg-amber-100 transition-colors">
                          <Send size={9} /> Remind
                        </button>
                      )}
                      <button
                        onClick={() => copyLink(doc.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-semibold hover:bg-gray-200 transition-colors"
                      >
                        {copied === doc.id ? <Check size={9} /> : <Copy size={9} />}
                        {copied === doc.id ? 'Copied!' : 'Link'}
                      </button>
                      <a
                        href={`/design/esign/sign/${doc.id}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 bg-[#6B7EFF]/10 text-[#6B7EFF] rounded text-[10px] font-semibold hover:bg-[#6B7EFF]/20 transition-colors"
                      >
                        <Eye size={9} /> View
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SlideOver */}
      {showSlideOver && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowSlideOver(false)} />
          <div className="w-96 bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="text-base font-bold text-gray-900">New Document</div>
              <button onClick={() => setShowSlideOver(false)} className="p-1 rounded hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Document Name</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Sunset Commons Service Agreement"
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Document Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]">
                  <option value="contract">Contract</option>
                  <option value="quote">Quote</option>
                  <option value="nda">NDA</option>
                  <option value="work_order">Work Order Sign-off</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Signer Name</label>
                <input value={form.signerName} onChange={e => setForm(f => ({...f, signerName: e.target.value}))} placeholder="e.g. Marcus Webb"
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Signer Email</label>
                <input type="email" value={form.signerEmail} onChange={e => setForm(f => ({...f, signerEmail: e.target.value}))} placeholder="signer@example.com"
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Expires (optional)</label>
                <input type="date" value={form.expiry} onChange={e => setForm(f => ({...f, expiry: e.target.value}))}
                  className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowSlideOver(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200">Cancel</button>
              <button onClick={handleSend} className="flex-1 py-2 bg-[#6B7EFF] text-white rounded-lg text-sm font-semibold hover:bg-[#5a6ee8] flex items-center justify-center gap-1.5">
                <Send size={13} /> Send for Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
