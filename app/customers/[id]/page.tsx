"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import {
  Mail, Phone, MapPin, Building2, Users,
  CheckCircle2, Clock, AlertTriangle, ExternalLink,
  Shield, Wrench, FileText, Star, Loader2,
  RefreshCw, X, Plus,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowLeft, Camera, DollarSign, Edit2, Activity, Save, Send, Trash2, Wifi, Network, Key, Eye } = require("lucide-react") as any;
import { QuickActions } from "@/components/shared/QuickActions";

type OrgTier =
  | "corporate" | "master_agent" | "master_dealer"
  | "full_dealer" | "service_dealer" | "install_contractor"
  | "sales_partner" | "client";

interface Site {
  id: string; name: string; address: string | null;
  city: string | null; state: string | null; status: string; created_at: string;
}

interface ChildOrg {
  id: string; name: string; org_tier: OrgTier;
  is_active: boolean; primary_contact_name: string | null;
}

interface WorkOrder {
  id: string; title: string; status: string;
  scheduled_date: string | null; priority: string; site_id: string;
}

interface OrgQuote {
  id: string;
  quote_number: string;
  status: string;
  property_name: string | null;
  units: number | null;
  total_one_time: number;
  total_mrr: number;
  created_at: string;
  sent_at: string | null;
  accepted_at: string | null;
}

interface OrgContact {
  id: string;
  org_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

interface OrgAttachment {
  id: string;
  org_id: string;
  name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  category: string;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
}

const ATTACHMENT_CATEGORIES = ['general', 'contract', 'invoice', 'permit', 'photo', 'other']

interface ApiCredentials {
  een?: { api_key?: string; account_id?: string; subdomain?: string };
  brivo?: { client_id?: string; client_secret?: string; api_key?: string };
  unifi?: { host?: string; username?: string; password?: string; site_id?: string };
  custom?: Array<{ name: string; api_key: string; url?: string; notes?: string }>;
}

interface OrgDetail {
  id: string; name: string; org_tier: OrgTier;
  is_active: boolean;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  address: string | null;
  city: string | null; state: string | null; zip: string | null;
  parent_org_id: string | null;
  parent_name: string | null;
  onboarded_at: string | null;
  notes: string | null;
  api_credentials?: ApiCredentials;
  sites: Site[];
  children: ChildOrg[];
  recent_work_orders: WorkOrder[];
  stats: { sites: number; cameras: number; doors: number; children: number };
}

const TIER_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  corporate:          { label: "Corporate",    cls: "bg-brand-400/10 text-brand-400 border border-brand-400/20",    icon: "🏢" },
  master_agent:       { label: "Master Agent", cls: "bg-violet-50 text-violet-700 border border-violet-200",         icon: "⭐" },
  master_dealer:      { label: "MSO",          cls: "bg-violet-50 text-violet-700 border border-violet-200",         icon: "🌐" },
  full_dealer:        { label: "Dealer",        cls: "bg-sky-50 text-sky-700 border border-sky-200",                 icon: "🔧" },
  service_dealer:     { label: "Svc Partner",  cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",     icon: "🛠️" },
  install_contractor: { label: "Installer",    cls: "bg-teal-50 text-teal-700 border border-teal-200",              icon: "🔩" },
  sales_partner:      { label: "Sales Partner",cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",     icon: "🤝" },
  client:             { label: "Client",        cls: "bg-amber-50 text-amber-700 border border-amber-200",           icon: "🏘️" },
};

const WO_STATUS_COLOR: Record<string, string> = {
  open:         "text-blue-500",
  in_progress:  "text-amber-500",
  completed:    "text-emerald-500",
  cancelled:    "text-muted-foreground",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg]           = useState<OrgDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OrgDetail>>({});
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);
  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Integrations
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [apiCreds, setApiCreds] = useState<ApiCredentials>({});
  const [savingCreds, setSavingCreds] = useState(false);
  // Address autocomplete
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);
  const [quotes, setQuotes]     = useState<OrgQuote[]>([]);
  const [quotesLoaded, setQuotesLoaded] = useState(false);
  const [activities, setActivities] = useState<{id:string;type:string;subject:string;body?:string;outcome?:string;created_by_name?:string;created_at:string}[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  // Contacts
  const [contacts, setContacts]       = useState<OrgContact[]>([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact]   = useState<OrgContact | null>(null)
  const [contactForm, setContactForm] = useState({ name: '', title: '', email: '', phone: '', is_primary: false, notes: '' })
  const [contactSaving, setContactSaving] = useState(false)
  // Attachments
  const [attachments, setAttachments]   = useState<OrgAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [attachUploadErr, setAttachUploadErr] = useState<string | null>(null)

  async function fetchOrg() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const data: OrgDetail = await res.json();
      setOrg(data);
      setEditForm({
        name: data.name,
        address: data.address ?? "",
        city: data.city ?? "",
        state: data.state ?? "",
        zip: data.zip ?? "",
        primary_contact_name: data.primary_contact_name ?? "",
        primary_contact_email: data.primary_contact_email ?? "",
        primary_contact_phone: data.primary_contact_phone ?? "",
        notes: data.notes ?? "",
      });
      setApiCreds(data.api_credentials ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchOrg(); }, [id]);

  useEffect(() => {
    if (!id) return;
    async function fetchQuotes() {
      try {
        const res = await fetch(`/api/quotes?client_org_id=${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setQuotes(data.records ?? []);
      } catch { /* non-blocking */ }
      finally { setQuotesLoaded(true); }
    }
    fetchQuotes();

    async function fetchActivities() {
      try {
        const res = await fetch(`/api/activities?record_type=customer&record_id=${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setActivities(data.activities ?? []);
      } catch { /* non-blocking */ }
      finally { setActivitiesLoaded(true); }
    }
    fetchActivities();

    async function fetchContacts() {
      try {
        const res = await fetch(`/api/customers/${id}/contacts`)
        if (!res.ok) return
        const data = await res.json()
        setContacts(data.contacts ?? [])
      } catch { /* non-blocking */ }
    }
    fetchContacts();

    async function fetchAttachments() {
      try {
        const res = await fetch(`/api/customers/${id}/attachments`)
        if (!res.ok) return
        const data = await res.json()
        setAttachments(data.attachments ?? [])
      } catch { /* non-blocking */ }
    }
    fetchAttachments();
  }, [id]);

  // ── Contact helpers ──────────────────────────────────────────────────────────
  function openAddContact() {
    setEditingContact(null)
    setContactForm({ name: '', title: '', email: '', phone: '', is_primary: contacts.length === 0, notes: '' })
    setShowContactForm(true)
  }
  function openEditContact(c: OrgContact) {
    setEditingContact(c)
    setContactForm({ name: c.name, title: c.title ?? '', email: c.email ?? '', phone: c.phone ?? '', is_primary: c.is_primary, notes: c.notes ?? '' })
    setShowContactForm(true)
  }
  async function saveContact() {
    if (!contactForm.name.trim()) return
    setContactSaving(true)
    try {
      const url = editingContact
        ? `/api/customers/${id}/contacts/${editingContact.id}`
        : `/api/customers/${id}/contacts`
      const method = editingContact ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactForm) })
      if (!res.ok) return
      const data = await res.json()
      if (editingContact) {
        setContacts(cs => cs.map(c => c.id === editingContact.id ? data.contact : c))
      } else {
        setContacts(cs => [...cs, data.contact])
      }
      setShowContactForm(false)
    } catch { /* swallow */ }
    finally { setContactSaving(false) }
  }
  async function deleteContact(contactId: string) {
    if (!confirm('Remove this contact?')) return
    await fetch(`/api/customers/${id}/contacts/${contactId}`, { method: 'DELETE' })
    setContacts(cs => cs.filter(c => c.id !== contactId))
  }

  // ── Attachment helpers ────────────────────────────────────────────────────────
  async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    setAttachUploadErr(null)
    try {
      // Step 1: get signed upload URL from generic upload endpoint
      const safeName = file.name.replace(/\s+/g, '-')
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `org-attachments/${id}/${Date.now()}_${safeName}`,
          content_type: file.type,
          bucket: 'attachments',
        }),
      })
      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error ?? 'Could not get upload URL')
      }
      const { upload_url, public_url } = await urlRes.json() as { upload_url: string; public_url: string }
      // Step 2: upload directly to Supabase Storage
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      // Step 3: register in DB
      const regRes = await fetch(`/api/customers/${id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, file_url: public_url, file_size: file.size, mime_type: file.type }),
      })
      if (!regRes.ok) throw new Error('Upload registered but DB save failed')
      const { attachment } = await regRes.json()
      setAttachments(prev => [attachment, ...prev])
    } catch (err) {
      setAttachUploadErr(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }
  async function deleteAttachment(attachId: string) {
    if (!confirm('Remove this attachment?')) return
    await fetch(`/api/customers/${id}/attachments?attachment_id=${attachId}`, { method: 'DELETE' })
    setAttachments(prev => prev.filter(a => a.id !== attachId))
  }

  async function saveEdit() {
    if (!org) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setOrg(o => o ? { ...o, ...updated } : o);
      setShowEdit(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.deleted) {
        router.push('/customers');
      } else if (data.deactivated) {
        setOrg(o => o ? { ...o, is_active: false } : o);
        setShowDeleteConfirm(false);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function saveCredentials() {
    setSavingCreds(true);
    try {
      await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_credentials: apiCreds }),
      });
      setOrg(o => o ? { ...o, api_credentials: apiCreds } : o);
      setShowIntegrations(false);
    } catch { /* swallow */ }
    finally { setSavingCreds(false); }
  }

  // ── Google Places autocomplete ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = () => (window as any).google;
  const initAutocomplete = useCallback(() => {
    if (!addressInputRef.current || !g()?.maps?.places) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Places = g().maps.places;
    const ac = new Places.Autocomplete(addressInputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components'],
    });
    autocompleteRef.current = ac;
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.address_components) return;
      let street = '', city = '', state = '', zip = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const comp of place.address_components as any[]) {
        const types: string[] = comp.types;
        if (types.includes('street_number')) street = comp.long_name + ' ';
        if (types.includes('route')) street += comp.short_name;
        if (types.includes('locality')) city = comp.long_name;
        if (types.includes('administrative_area_level_1')) state = comp.short_name;
        if (types.includes('postal_code')) zip = comp.long_name;
      }
      setEditForm(f => ({ ...f, address: street.trim(), city, state, zip }));
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !showEdit) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    if (g()?.maps?.places) { setTimeout(initAutocomplete, 50); return; }
    const existing = document.getElementById('gg-gmaps-script');
    if (existing) { existing.addEventListener('load', initAutocomplete); return; }
    const script = document.createElement('script');
    script.id = 'gg-gmaps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = initAutocomplete;
    document.head.appendChild(script);
  }, [showEdit, initAutocomplete]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Loading…" />
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" /> Loading account…
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Account Not Found" />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-muted-foreground text-sm">{error ?? "Account not found."}</p>
          <div className="flex items-center gap-3">
            <button onClick={fetchOrg} className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent">
              <RefreshCw size={12} /> Retry
            </button>
            <Link href="/customers" className="text-brand-400 hover:underline text-sm flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tc = TIER_CONFIG[org.org_tier] ?? TIER_CONFIG.client;
  const location = [org.city, org.state].filter(Boolean).join(", ");
  const fullAddress = [org.address, org.city, org.state].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={org.name}
        subtitle={`${tc.icon} ${tc.label}${fullAddress ? ` · ${fullAddress}` : ""}`}
        actions={
          <Link
            href="/customers"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} /> Customers
          </Link>
        }
      />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-5">

        {/* Header card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center text-xl font-bold text-brand-400">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-foreground">{org.name}</h2>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${tc.cls}`}>
                    {tc.icon} {tc.label}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${org.is_active ? "bg-emerald-500" : "bg-amber-400"}`} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {location && (
                    <span className="flex items-center gap-1"><MapPin size={13} /> {location}</span>
                  )}
                  {org.parent_name && (
                    <span className="flex items-center gap-1"><Building2 size={13} /> Under: {org.parent_name}</span>
                  )}
                  {org.onboarded_at && (
                    <span className="text-xs">
                      Onboarded {new Date(org.onboarded_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowIntegrations(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors"
                title="API & Integrations"
              >
                <Key size={13} /> Integrations
              </button>
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors"
              >
                <Edit2 size={13} /> Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
            {[
              { label: "Sites",    value: org.stats.sites    },
              { label: "Children", value: org.stats.children },
              { label: "Cameras",  value: org.stats.cameras  },
              { label: "Doors",    value: org.stats.doors    },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl bg-background/50 border border-border/50">
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quick action buttons */}
          <div className="mt-4 pt-4 border-t border-border">
            <QuickActions
              recordType="customer"
              recordId={org.id}
              recordName={org.name}
              contactEmail={org.primary_contact_email ?? undefined}
              contactName={org.primary_contact_name ?? undefined}
              onActivityCreated={() => {
                fetch(`/api/activities?record_type=customer&record_id=${id}`)
                  .then(r => r.json())
                  .then(d => d.activities && setActivities(d.activities))
                  .catch(() => {})
              }}
            />
          </div>
        </div>

        {/* ── Contacts panel ──────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users size={14} className="text-brand-400" /> Contacts ({contacts.length})
            </h3>
            <button
              onClick={openAddContact}
              className="flex items-center gap-1 text-xs text-brand-400 hover:underline"
            >
              <Plus size={12} /> Add Contact
            </button>
          </div>

          {/* Add / Edit contact form */}
          {showContactForm && (
            <div className="mb-4 border border-border rounded-xl p-4 bg-background/50 space-y-3">
              <p className="text-xs font-semibold text-foreground">{editingContact ? 'Edit contact' : 'New contact'}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Name *</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Title</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={contactForm.title} onChange={e => setContactForm(f => ({ ...f, title: e.target.value }))} placeholder="Property Manager" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Email</label>
                  <input type="email" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Phone</label>
                  <input type="tel" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 555-5555" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={contactForm.is_primary}
                  onChange={e => setContactForm(f => ({ ...f, is_primary: e.target.checked }))}
                  className="rounded border-border" />
                Primary contact
              </label>
              <div className="flex gap-2">
                <button onClick={saveContact} disabled={contactSaving} className="flex-1 text-xs bg-brand-400 text-white py-2 rounded-lg font-medium hover:bg-brand-500 disabled:opacity-50">
                  {contactSaving ? 'Saving…' : editingContact ? 'Save Changes' : 'Add Contact'}
                </button>
                <button onClick={() => setShowContactForm(false)} className="flex-1 text-xs border border-border text-muted-foreground py-2 rounded-lg hover:bg-accent">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {contacts.length === 0 && !showContactForm ? (
            <div className="text-center py-5 text-sm text-muted-foreground">
              <Users size={20} className="mx-auto mb-2 text-muted-foreground/40" />
              <p>No contacts yet.</p>
              <button onClick={openAddContact} className="text-brand-400 hover:underline text-xs mt-1">Add first contact →</button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {contacts.map(c => (
                <div key={c.id} className="py-3 flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-brand-400/10 border border-brand-400/20 flex items-center justify-center text-xs font-bold text-brand-400 shrink-0 mt-0.5">
                    {c.name.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      {c.is_primary && <span className="text-[10px] bg-brand-400/10 text-brand-400 border border-brand-400/20 px-1.5 py-0.5 rounded-full font-semibold">Primary</span>}
                      {c.title && <span className="text-xs text-muted-foreground">{c.title}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      {c.email && <a href={`mailto:${c.email}`} className="text-xs text-muted-foreground hover:text-brand-400 flex items-center gap-1"><Mail size={11} />{c.email}</a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-muted-foreground hover:text-brand-400 flex items-center gap-1"><Phone size={11} />{c.phone}</a>}
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground italic mt-1">{c.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEditContact(c)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-brand-400">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => deleteContact(c.id)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Info row: Address · Notes ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin size={14} className="text-brand-400" /> Address
            </h3>
            {fullAddress ? (
              <div className="space-y-1">
                <p className="text-sm text-foreground">{fullAddress}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={11} /> Open in Google Maps
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No address. Click Edit to add.</p>
            )}
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Star size={14} className="text-brand-400" /> Notes
            </h3>
            {org.notes ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{org.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes. Click Edit to add.</p>
            )}
          </div>
        </div>

        {/* Child organizations */}
        {org.children.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 size={14} className="text-brand-400" /> Sub-Organizations ({org.children.length})
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {org.children.map(child => {
                const childTc = TIER_CONFIG[child.org_tier] ?? TIER_CONFIG.client;
                return (
                  <Link key={child.id} href={`/customers/${child.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-brand-400/30 hover:bg-accent transition-all">
                    <div className="w-8 h-8 rounded-lg bg-brand-400/10 flex items-center justify-center text-xs font-bold text-brand-400">
                      {child.name.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{child.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${childTc.cls}`}>
                        {childTc.icon} {childTc.label}
                      </span>
                    </div>
                    {child.primary_contact_name && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{child.primary_contact_name}</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Sites / Properties */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 size={14} className="text-brand-400" /> Properties / Sites ({org.stats.sites})
            </h3>
            <Link href="/sites" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              View all <ExternalLink size={11} />
            </Link>
          </div>
          {org.sites.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Building2 size={24} className="mx-auto mb-2 text-muted-foreground/40" />
              <p>No sites yet for this organization.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {org.sites.map(site => (
                <Link key={site.id} href={`/sites/${site.id}`} className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-brand-400/30 hover:bg-accent transition-all group">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${site.status === "active" ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-brand-400 transition-colors">{site.name}</p>
                      {(site.city || site.state) && (
                        <p className="text-xs text-muted-foreground">{[site.city, site.state].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{site.status}</span>
                </Link>
              ))}
              {org.stats.sites > org.sites.length && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{org.stats.sites - org.sites.length} more sites —{" "}
                  <Link href="/sites" className="text-brand-400 hover:underline">View all</Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent work orders */}
        {org.recent_work_orders.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wrench size={14} className="text-brand-400" /> Recent Work Orders
              </h3>
              <Link href="/maintenance" className="text-xs text-brand-400 hover:underline flex items-center gap-1">
                View all <ExternalLink size={11} />
              </Link>
            </div>
            <div className="space-y-2">
              {org.recent_work_orders.map(wo => (
                <Link key={wo.id} href={`/maintenance/${wo.id}`} className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-brand-400/30 hover:bg-accent transition-all group">
                  <div className="flex items-center gap-3">
                    <Wrench size={13} className={WO_STATUS_COLOR[wo.status] ?? "text-muted-foreground"} />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-brand-400 transition-colors">{wo.title}</p>
                      {wo.scheduled_date && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(wo.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold capitalize ${wo.priority === "urgent" ? "text-red-500" : wo.priority === "high" ? "text-amber-500" : "text-muted-foreground"}`}>
                      {wo.priority}
                    </span>
                    <span className={`text-[10px] capitalize ${WO_STATUS_COLOR[wo.status] ?? "text-muted-foreground"}`}>
                      {wo.status.replace("_", " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quotes */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText size={14} className="text-brand-400" /> Quotes ({quotes.length})
            </h3>
            <Link
              href={`/quotes/new?client_org_id=${id}`}
              className="flex items-center gap-1 text-xs text-brand-400 hover:underline"
            >
              <Plus size={12} /> New Quote
            </Link>
          </div>
          {!quotesLoaded ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <FileText size={24} className="mx-auto mb-2 text-muted-foreground/40" />
              <p>No quotes for this organization.</p>
              <Link href={`/quotes/new?client_org_id=${id}`} className="text-brand-400 hover:underline text-xs mt-1 inline-block">
                Create the first quote
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium uppercase tracking-wide px-3 py-2">Quote #</th>
                    <th className="text-left text-xs text-muted-foreground font-medium uppercase tracking-wide px-3 py-2">Property</th>
                    <th className="text-right text-xs text-muted-foreground font-medium uppercase tracking-wide px-3 py-2">Setup</th>
                    <th className="text-right text-xs text-muted-foreground font-medium uppercase tracking-wide px-3 py-2">MRR</th>
                    <th className="text-left text-xs text-muted-foreground font-medium uppercase tracking-wide px-3 py-2">Status</th>
                    <th className="text-left text-xs text-muted-foreground font-medium uppercase tracking-wide px-3 py-2">Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotes.map(q => (
                    <tr key={q.id} className="hover:bg-background/40 transition-colors group">
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-mono text-brand-400">{q.quote_number}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-sm text-foreground">{q.property_name ?? '—'}</span>
                        {q.units ? <span className="text-xs text-muted-foreground ml-1">({q.units} units)</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-sm text-foreground">${q.total_one_time.toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-sm text-violet-400">${q.total_mrr.toLocaleString()}<span className="text-xs text-muted-foreground">/mo</span></span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize
                          ${q.status === 'accepted' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                          : q.status === 'sent' || q.status === 'viewed' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                          : q.status === 'declined' ? 'text-red-400 bg-red-400/10 border-red-400/20'
                          : 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'}`}
                        >
                          {q.status === 'accepted' ? <CheckCircle2 size={9} /> : q.status === 'sent' ? <Send size={9} /> : null}
                          {q.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/quotes/${q.id}`} className="opacity-0 group-hover:opacity-100 text-xs text-brand-400 hover:underline flex items-center gap-0.5 transition-opacity">
                          <ExternalLink size={11} /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity size={14} className="text-brand-400" /> Activity ({activities.length})
            </h3>
          </div>
          {!activitiesLoaded ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <span className="text-xs">Loading…</span>
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No activity yet — use the Email, To-Do, or Log Activity buttons above to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map(act => {
                const typeColors: Record<string, string> = {
                  email:   'bg-violet-50 text-violet-700 border-violet-200',
                  call:    'bg-blue-50 text-blue-700 border-blue-200',
                  meeting: 'bg-amber-50 text-amber-700 border-amber-200',
                  note:    'bg-slate-50 text-slate-600 border-slate-200',
                  task:    'bg-emerald-50 text-emerald-700 border-emerald-200',
                }
                const cls = typeColors[act.type?.toLowerCase()] ?? typeColors.note
                return (
                  <div key={act.id} className="flex gap-3">
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg border capitalize h-fit ${cls}`}>
                      {act.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{act.subject}</p>
                      {act.body && <p className="text-xs text-muted-foreground mt-0.5">{act.body}</p>}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        {act.created_by_name && <span>{act.created_by_name}</span>}
                        <span>·</span>
                        <span>{new Date(act.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Attachments ─────────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText size={14} className="text-brand-400" /> Attachments ({attachments.length})
            </h3>
            <label className={`flex items-center gap-1 text-xs text-brand-400 hover:underline cursor-pointer ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
              <Plus size={12} /> {uploadingFile ? 'Uploading…' : 'Upload File'}
              <input type="file" className="hidden" onChange={handleAttachmentUpload} disabled={uploadingFile} />
            </label>
          </div>

          {attachUploadErr && (
            <p className="text-xs text-red-500 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{attachUploadErr}</p>
          )}

          {attachments.length === 0 ? (
            <div className="text-center py-5 text-sm text-muted-foreground">
              <FileText size={20} className="mx-auto mb-2 text-muted-foreground/40" />
              <p>No attachments yet.</p>
              <p className="text-xs mt-1">Upload contracts, permits, photos, invoices.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {attachments.map(att => {
                const isImage = att.mime_type?.startsWith('image/')
                const isPDF   = att.mime_type === 'application/pdf'
                const icon    = isImage ? '🖼️' : isPDF ? '📄' : '📎'
                const sizeStr = att.file_size ? att.file_size > 1_000_000
                  ? `${(att.file_size / 1_000_000).toFixed(1)} MB`
                  : `${Math.round(att.file_size / 1024)} KB`
                  : null
                const catColors: Record<string, string> = {
                  contract: 'bg-violet-50 text-violet-700',
                  invoice:  'bg-emerald-50 text-emerald-700',
                  permit:   'bg-amber-50 text-amber-700',
                  photo:    'bg-sky-50 text-sky-700',
                  other:    'bg-slate-50 text-slate-600',
                  general:  'bg-slate-50 text-slate-600',
                }
                return (
                  <div key={att.id} className="py-3 flex items-center gap-3 group">
                    <span className="text-lg shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:text-brand-400 truncate block">
                        {att.name}
                      </a>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize font-medium ${catColors[att.category] ?? catColors.general}`}>{att.category}</span>
                        {sizeStr && <span className="text-[10px] text-muted-foreground">{sizeStr}</span>}
                        {att.uploaded_by && <span className="text-[10px] text-muted-foreground">by {att.uploaded_by}</span>}
                        <span className="text-[10px] text-muted-foreground">{new Date(att.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-brand-400">
                        <ExternalLink size={12} />
                      </a>
                      <button onClick={() => deleteAttachment(att.id)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Edit slide-over */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowEdit(false)} />
          <div className="w-[420px] bg-card border-l border-border flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Edit Account</h2>
              <button onClick={() => setShowEdit(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Organization Name</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                  value={editForm.name ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Street Address
                  {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                    <span className="ml-1 text-[10px] text-emerald-500 font-normal">✓ autocomplete active</span>
                  )}
                </label>
                <input
                  ref={(el) => { addressInputRef.current = el; if (el && showEdit) initAutocomplete(); }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                  placeholder="123 Main St — type to search or enter manually"
                  value={(editForm as Record<string, unknown>).address as string ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">City</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={editForm.city ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">State</label>
                  <input
                    maxLength={2}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={editForm.state ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, state: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Zip</label>
                  <input
                    maxLength={10}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={(editForm as Record<string, unknown>).zip as string ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, zip: e.target.value }))}
                    placeholder="30301"
                  />
                </div>
              </div>
              <hr className="border-border" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Contact</p>
              {(["primary_contact_name", "primary_contact_email", "primary_contact_phone"] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 capitalize">
                    {field.replace("primary_contact_", "").replace("_", " ")}
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50"
                    value={(editForm[field] as string) ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <hr className="border-border" />
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50 resize-none"
                  value={editForm.notes ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              {saveErr && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveErr}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button onClick={() => setShowEdit(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy-DEFAULT text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ─────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Delete Account</h3>
                <p className="text-xs text-muted-foreground">{org?.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              If this account has active sites or child organizations, it will be <strong>deactivated</strong> (not deleted).
              Otherwise it will be <strong>permanently removed</strong>.
            </p>
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Integrations Panel ──────────────────────────────────────────────── */}
      {showIntegrations && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowIntegrations(false)} />
          <div className="w-[480px] bg-card border-l border-border flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">API & Integrations</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Store credentials per account — used by NEXUS and field tech tools</p>
              </div>
              <button onClick={() => setShowIntegrations(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Eagle Eye Networks */}
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye size={14} className="text-brand-400" />
                  <p className="text-sm font-semibold text-foreground">Eagle Eye Networks (Cameras)</p>
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'api_key', label: 'API Key', placeholder: 'een_api_key_...' },
                    { key: 'account_id', label: 'Account ID', placeholder: '12345' },
                    { key: 'subdomain', label: 'Subdomain', placeholder: 'gateguard' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">{f.label}</label>
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50 font-mono text-xs"
                        placeholder={f.placeholder}
                        value={(apiCreds.een as Record<string, string>)?.[f.key] ?? ''}
                        onChange={e => setApiCreds(c => ({ ...c, een: { ...c.een, [f.key]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Brivo */}
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={14} className="text-violet-500" />
                  <p className="text-sm font-semibold text-foreground">Brivo (Access Control)</p>
                </div>
                <div className="space-y-2">
                  {[
                    { key: 'client_id', label: 'Client ID', placeholder: 'brivo_client_id' },
                    { key: 'client_secret', label: 'Client Secret', placeholder: '••••••••' },
                    { key: 'api_key', label: 'API Key', placeholder: 'brivo_api_key' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">{f.label}</label>
                      <input
                        type={f.key.includes('secret') ? 'password' : 'text'}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50 font-mono text-xs"
                        placeholder={f.placeholder}
                        value={(apiCreds.brivo as Record<string, string>)?.[f.key] ?? ''}
                        onChange={e => setApiCreds(c => ({ ...c, brivo: { ...c.brivo, [f.key]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* UniFi */}
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wifi size={14} className="text-sky-500" />
                  <p className="text-sm font-semibold text-foreground">UniFi Network</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'host', label: 'Host / IP', placeholder: '192.168.1.1', full: false },
                    { key: 'username', label: 'Username', placeholder: 'admin', full: false },
                    { key: 'password', label: 'Password', placeholder: '••••••••', full: false },
                    { key: 'site_id', label: 'Site ID', placeholder: 'default', full: false },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">{f.label}</label>
                      <input
                        type={f.key === 'password' ? 'password' : 'text'}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-brand-400/50 font-mono text-xs"
                        placeholder={f.placeholder}
                        value={(apiCreds.unifi as Record<string, string>)?.[f.key] ?? ''}
                        onChange={e => setApiCreds(c => ({ ...c, unifi: { ...c.unifi, [f.key]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom */}
              <div className="border border-dashed border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Network size={14} className="text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Other APIs</p>
                  </div>
                  <button
                    onClick={() => setApiCreds(c => ({ ...c, custom: [...(c.custom ?? []), { name: '', api_key: '', url: '', notes: '' }] }))}
                    className="text-xs text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <Plus size={11} /> Add
                  </button>
                </div>
                {(apiCreds.custom ?? []).map((entry, i) => (
                  <div key={i} className="mb-3 p-3 bg-background/50 rounded-lg border border-border/50 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">Name</label>
                        <input
                          className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs focus:outline-none"
                          placeholder="Service name"
                          value={entry.name}
                          onChange={e => setApiCreds(c => { const arr = [...(c.custom ?? [])]; arr[i] = { ...arr[i], name: e.target.value }; return { ...c, custom: arr }; })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-muted-foreground mb-1">API Key</label>
                        <input
                          className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs font-mono focus:outline-none"
                          placeholder="key_..."
                          value={entry.api_key}
                          onChange={e => setApiCreds(c => { const arr = [...(c.custom ?? [])]; arr[i] = { ...arr[i], api_key: e.target.value }; return { ...c, custom: arr }; })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 px-2 py-1.5 rounded border border-border bg-background text-xs focus:outline-none"
                        placeholder="API URL (optional)"
                        value={entry.url ?? ''}
                        onChange={e => setApiCreds(c => { const arr = [...(c.custom ?? [])]; arr[i] = { ...arr[i], url: e.target.value }; return { ...c, custom: arr }; })}
                      />
                      <button
                        onClick={() => setApiCreds(c => ({ ...c, custom: (c.custom ?? []).filter((_, j) => j !== i) }))}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {!(apiCreds.custom?.length) && (
                  <p className="text-xs text-muted-foreground text-center py-2">No custom integrations yet — click Add to store any API credentials</p>
                )}
              </div>

            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button onClick={() => setShowIntegrations(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent">
                Cancel
              </button>
              <button
                onClick={saveCredentials}
                disabled={savingCreds}
                className="flex-1 py-2.5 rounded-lg bg-brand-400 hover:bg-brand-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingCreds ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {savingCreds ? 'Saving…' : 'Save Credentials'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
