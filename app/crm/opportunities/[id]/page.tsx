"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import {
  ChevronRight, Check, Phone, Mail,
  ClipboardList, Plus, X,
  ExternalLink, Wrench, FileText, Zap,
  ChevronLeft, Trash2, RefreshCw, MapPin,
} from "lucide-react";
import { TrackerBoard } from "@/components/tracker/TrackerBoard";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CalendarClock, StickyNote, Pencil, AlertCircle, Edit2, CheckSquare, Square } = require("lucide-react") as any;
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type Stage =
  | "meet_present"
  | "survey_request"
  | "propose"
  | "negotiate"
  | "won"
  | "lost";

type ActivityType = "call" | "email" | "meeting" | "task" | "note";
type Tab = "details" | "activity" | "documents" | "tasks";

interface Contact {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  role?: string;
}

interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  body?: string;
  outcome?: string;
  duration_mins?: number;
  due_at?: string;
  created_at: string;
  completed_at?: string | null;
  created_by_name?: string;
  opportunity_name?: string;
  // Email tracking
  sent_via_resend?: boolean;
  email_status?: "draft" | "sending" | "sent" | "delivered" | "opened" | "bounced" | "failed" | "received";
  opened_at?: string | null;
  open_count?: number;
  to_email?: string;
  from_email?: string;
}

interface StageHistoryItem {
  id: string;
  stage: Stage;
  amount?: number;
  changed_at: string;
  changed_by?: string;
}

type OppType =
  | 'master_agent' | 'mso' | 'dealer'
  | 'install_partner' | 'service_partner' | 'sales_partner'
  | 'property' | 'company' | 'customer';

const OPP_TYPE_LABELS: Record<OppType, string> = {
  master_agent:    'Master Agent',
  mso:             'MSO',
  dealer:          'Dealer',
  install_partner: 'Install Partner',
  service_partner: 'Service Partner',
  sales_partner:   'Sales Partner',
  property:        'Property',
  company:         'Company',
  customer:        'Customer',
};

const OPP_TYPE_BADGE: Record<OppType, string> = {
  master_agent:    'bg-violet-100 text-violet-700',
  mso:             'bg-sky-100 text-sky-700',
  dealer:          'bg-emerald-100 text-emerald-700',
  install_partner: 'bg-orange-100 text-orange-700',
  service_partner: 'bg-yellow-100 text-yellow-700',
  sales_partner:   'bg-pink-100 text-pink-700',
  property:        'bg-teal-100 text-teal-700',
  company:         'bg-blue-100 text-blue-700',
  customer:        'bg-purple-100 text-purple-700',
};

// Document types available for e-sign, keyed by opportunity type
const OPP_DOCS: Partial<Record<OppType, { value: string; label: string; advanceStage: string }[]>> = {
  master_agent:    [
    { value: 'nda',                   label: 'Mutual NDA',           advanceStage: 'NDA Signed' },
    { value: 'master_agent_agreement',label: 'Master Agent Agreement', advanceStage: 'Agreement Signed' },
  ],
  mso:             [
    { value: 'dealer_agreement',      label: 'MSO Agreement',        advanceStage: 'Agreement Signed' },
  ],
  dealer:          [
    { value: 'dealer_agreement',      label: 'Dealer Agreement',     advanceStage: 'Agreement Signed' },
  ],
  install_partner: [
    { value: 'install_partner_agreement', label: 'Install Partner Agreement', advanceStage: 'Agreement Signed' },
  ],
  service_partner: [
    { value: 'service_agreement',     label: 'Service Agreement',    advanceStage: 'Agreement Signed' },
  ],
  sales_partner:   [
    { value: 'sales_partner_agreement', label: 'Sales Partner Agreement', advanceStage: 'Agreement Signed' },
  ],
};

const DOC_TYPE_LABELS: Record<string, string> = {
  nda:                        'Mutual NDA',
  master_agent_agreement:     'Master Agent Agreement',
  dealer_agreement:           'Dealer Agreement',
  service_agreement:          'Service Agreement',
  install_partner_agreement:  'Install Partner Agreement',
  sales_partner_agreement:    'Sales Partner Agreement',
};

// Stage checklists per opportunity type — drives the sales cycle panel
const STAGE_CHECKLIST: Partial<Record<OppType, string[]>> = {
  master_agent:    ['NDA sent', 'NDA signed', 'Agreement sent', 'Agreement negotiated', 'Agreement signed', 'Background check complete'],
  mso:             ['Agreement sent', 'Agreement negotiated', 'Agreement signed', 'Territory confirmed'],
  dealer:          ['Agreement sent', 'Agreement signed', 'Tech certification scheduled'],
  install_partner: ['Vetting complete', 'Agreement sent', 'Agreement signed', 'Insurance verified'],
  service_partner: ['Vetting complete', 'Agreement sent', 'Agreement signed', 'Insurance verified', 'SLA confirmed'],
  sales_partner:   ['Commission agreement sent', 'Commission agreement signed', 'CRM access granted'],
  property:        ['Site survey complete', 'Quote sent', 'Quote approved', 'Agreement signed', 'Install scheduled'],
  company:         ['Site walk complete', 'Quote sent', 'Quote approved', 'Agreement signed', 'Install scheduled'],
  customer:        ['Quote sent', 'Quote approved', 'Service scheduled'],
};

interface Opportunity {
  id: string;
  name: string;
  account_name: string;
  stage: Stage;
  opportunity_type?: OppType;
  amount: number;
  close_date?: string;
  description?: string;
  owner_name?: string;
  owner_initials?: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  site_contact_email?: string;
  next_step?: string;
  probability?: number;
  forecast_category?: string;
  units?: number;
  vehicle_gates?: number;
  pedestrian_gates?: number;
  amenity_doors?: number;
  existing_cameras?: number;
  new_cameras?: number;
  est_deposit?: number;
  monthly_per_unit?: number;
  monthly_total?: number;
  est_mrr?: number;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  source?: string;
  directv_package?: string;
  isp_service?: string;
  mdu_contract_expiry?: string;
  quote_url?: string;
  contacts: Contact[];
  activities: Activity[];
  stage_history: StageHistoryItem[];
  created_at: string;
  won_at?: string;
  site_id?: string | null;
  related_org_id?: string | null;
}

// ── Stage Config ──────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  Stage,
  { label: string; dot: string; pill: string; guidance: string }
> = {
  meet_present: {
    label: "Meet & Present",
    dot: "bg-blue-400",
    pill: "bg-blue-100 text-blue-700",
    guidance:
      "Schedule an on-site visit. Understand their current pain points. Has a demo been shown?",
  },
  survey_request: {
    label: "Survey Request",
    dot: "bg-violet-400",
    pill: "bg-violet-100 text-violet-700",
    guidance:
      "Conduct the site walk via the /tech Survey tool. Capture full device inventory and auto-generate SOW.",
  },
  propose: {
    label: "Propose",
    dot: "bg-amber-400",
    pill: "bg-amber-100 text-amber-700",
    guidance:
      "Send the quote. Does it cover the complete solution? Present how GateGuard solves their specific problems.",
  },
  negotiate: {
    label: "Negotiate",
    dot: "bg-orange-400",
    pill: "bg-orange-100 text-orange-700",
    guidance:
      'Make the offer. Address objections. Share the Elevate Model: residents fund it at $150/yr each.',
  },
  won: {
    label: "Closed Won",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700",
    guidance:
      "🎉 Closed! Create the work order and schedule kickoff within 48 hours.",
  },
  lost: {
    label: "Lost",
    dot: "bg-red-400",
    pill: "bg-red-100 text-red-600",
    guidance: "",
  },
};

const AI_TIPS: Record<Stage, { tip: string; showAria?: boolean }> = {
  meet_present: {
    tip: "Reference their specific property. ARIA can mine public reviews for pain signals.",
    showAria: true,
  },
  survey_request: {
    tip: "Use /tech Site Survey to capture the full device inventory. It auto-generates your SOW.",
    showAria: true,
  },
  propose: {
    tip: "The Elevate Model closes deals: 100 units × $150/yr = $15K/yr resident revenue. Net profit after GG cost: $10K+/yr.",
    showAria: false,
  },
  negotiate: {
    tip: "Counter 'too expensive' with: 'Residents fund it at $150/yr. Your net after GG cost is under $3/unit/mo.'",
    showAria: false,
  },
  won: {
    tip: "Create the work order now. Strike while momentum is hot. Kickoff within 48 hours drives 3x install success rate.",
    showAria: false,
  },
  lost: {
    tip: "Log the loss reason to train the pipeline. Every lost deal teaches the next win.",
    showAria: false,
  },
};

const ORDERED_STAGES: Stage[] = [
  "meet_present",
  "survey_request",
  "propose",
  "negotiate",
  "won",
];

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt$(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function activityTypeColor(type: ActivityType): string {
  switch (type) {
    case "call":    return "bg-blue-100 text-blue-600";
    case "email":   return "bg-violet-100 text-violet-600";
    case "meeting": return "bg-amber-100 text-amber-600";
    case "task":    return "bg-emerald-100 text-emerald-600";
    default:        return "bg-slate-100 text-slate-600";
  }
}

function ActivityIcon({ type, size = 14 }: { type: ActivityType; size?: number }) {
  switch (type) {
    case "call":    return <Phone size={size} />;
    case "email":   return <Mail size={size} />;
    case "meeting": return <CalendarClock size={size} />;
    case "task":    return <ClipboardList size={size} />;
    default:        return <StickyNote size={size} />;
  }
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  // Edit slide-over
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    account_name: "",
    amount: "",
    close_date: "",
    stage: "" as Stage | "",
    description: "",
    next_step: "",
    probability: "",
    forecast_cat: "",
    opportunity_type: "" as OppType | "",
    site_contact_name:  "",
    site_contact_email: "",
    site_contact_phone: "",
    property_address:   "",
    property_city:      "",
    property_state:     "",
    property_zip:       "",
    units:              "",
    source:             "",
    est_mrr:            "",
    related_org_id:     "" as string | null,
    related_org_name:   "",  // display label only — not sent to API
  });

  // Sales cycle checklist — keys from documents_status JSONB
  const [checklistStatus, setChecklistStatus] = useState<Record<string, boolean>>({});
  const [checklistSaving, setChecklistSaving] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Unified Log Activity form
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [logActType, setLogActType] = useState<ActivityType>("note");
  const [logActSubject, setLogActSubject] = useState("");
  const [logActBody, setLogActBody] = useState("");
  const [logActDueAt, setLogActDueAt] = useState("");
  const [logActOutcome, setLogActOutcome] = useState("");
  const [logActSaving, setLogActSaving] = useState(false);

  // Activity forms
  const [showLogCall, setShowLogCall] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  // Stage progression
  const [stageSaving, setStageSaving] = useState(false);

  // Follow
  const [following, setFollowing] = useState(false);
  const [followToast, setFollowToast] = useState(false);
  const handleFollow = () => {
    setFollowing(f => !f);
    setFollowToast(true);
    setTimeout(() => setFollowToast(false), 2000);
  };

  // Contact form
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", title: "", phone: "", email: "", role: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Activity forms state
  const [callForm, setCallForm] = useState({ subject: "", outcome: "Connected", duration: "", notes: "" });
  const [taskForm, setTaskForm] = useState({ subject: "", due_date: "", notes: "" });
  const [eventForm, setEventForm] = useState({ subject: "", date: "", time: "", notes: "" });
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", body: "" });
  const [activitySaving, setActivitySaving] = useState(false);

  // Inline activity edit
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editActForm, setEditActForm] = useState({
    subject: "", body: "", type: "note" as ActivityType, due_at: "", outcome: "",
  });
  const [editActSaving, setEditActSaving] = useState(false);

  const [emailSending, setEmailSending] = useState(false);
  const [emailSendError, setEmailSendError] = useState<string | null>(null);

  // Send Document / e-sign
  const [showSendDoc, setShowSendDoc] = useState(false);
  const [sendDocType, setSendDocType] = useState<string>('nda');
  const [sendDocSignerName, setSendDocSignerName] = useState('');
  const [sendDocSignerEmail, setSendDocSignerEmail] = useState('');
  const [sendDocSignerTitle, setSendDocSignerTitle] = useState('');
  const [sendDocAdvanceStage, setSendDocAdvanceStage] = useState('');
  const [sendDocSending, setSendDocSending] = useState(false);
  const [sendDocError, setSendDocError] = useState<string | null>(null);
  const [sendDocSuccess, setSendDocSuccess] = useState<string | null>(null);
  // Template repository — active templates keyed by document_type
  const [docTemplates, setDocTemplates] = useState<Record<string, { version: string; is_active: boolean }>>({});

  // Document signatures lifecycle
  interface DocSig {
    id: string;
    document_type: string;
    document_version: string | null;
    document_url: string | null;
    signer_name: string | null;
    signer_email: string;
    signer_title: string | null;
    signer_company: string | null;
    signed_name: string | null;
    signed_at: string | null;
    countersigned_name: string | null;
    countersigned_at: string | null;
    executed_at: string | null;
    status: string;
    sent_by_name: string | null;
    sent_at: string;
  }
  const [docSigs, setDocSigs]     = useState<DocSig[]>([]);
  const [docSigsLoading, setDocSigsLoading] = useState(false);
  // Countersign form
  const [countersignId,    setCountersignId]    = useState<string | null>(null);
  const [countersignName,  setCountersignName]  = useState('Russel Feldman');
  const [countersignTitle, setCountersignTitle] = useState('CEO');
  const [countersigning,   setCountersigning]   = useState(false);
  const [countersignError, setCountersignError] = useState<string | null>(null);

  // Quotes linked to this opportunity
  const [quoteCreating, setQuoteCreating] = useState(false);
  const [oppQuotes,     setOppQuotes]     = useState<{ id: string; quote_number: string; status: string; total_one_time: number; total_mrr: number; created_at: string }[]>([]);
  const [quotesLoaded,  setQuotesLoaded]  = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/quotes?opportunity_id=${id}`)
      .then(r => r.json())
      .then(j => { setOppQuotes(j.records ?? j.quotes ?? []); setQuotesLoaded(true); })
      .catch(() => setQuotesLoaded(true));
  }, [id]);

  const handleCreateQuote = async () => {
    if (!opp) return;
    setQuoteCreating(true);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:          `Quote — ${opp.account_name}`,
          property_name:  opp.account_name,
          units:          opp.units            ?? null,
          site_id:        opp.site_id          ?? null,
          opportunity_id: id,
          client_org_id:  opp.related_org_id   ?? null,  // link to customer org if set
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed to create quote'); }
      const { quote } = await res.json();
      // Keep quote_url on opportunity for backwards compat (latest quote link)
      await fetch(`/api/crm/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote_url: `/quotes/${quote.id}` }),
      });
      setOpp(prev => prev ? { ...prev, quote_url: `/quotes/${quote.id}` } : prev);
      setOppQuotes(prev => [{
        id: quote.id, quote_number: quote.quote_number,
        status: quote.status, total_one_time: quote.total_one_time ?? 0,
        total_mrr: quote.total_mrr ?? 0, created_at: quote.created_at,
      }, ...prev]);
      router.push(`/quotes/${quote.id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setQuoteCreating(false);
    }
  };

  // Create Property from won opportunity
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [createPropSaving,   setCreatePropSaving]   = useState(false);
  const [createPropError,    setCreatePropError]     = useState<string | null>(null);
  const [createPropForm, setCreatePropForm] = useState({
    name: "", address: "", city: "", state: "", zip: "",
    property_type: "Multifamily", units: "",
    pm_name: "", pm_email: "", pm_phone: "",
    access_notes: "", notes: "",
  });

  const handleCreateProperty = async () => {
    if (!createPropForm.name.trim()) { setCreatePropError("Property name is required."); return; }
    setCreatePropSaving(true); setCreatePropError(null);
    try {
      const res  = await fetch("/api/sites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createPropForm,
          units:     createPropForm.units ? parseInt(createPropForm.units, 10) : null,
          crm_opp_id: id,
          primary_contact_name:  opp?.site_contact_name  ?? null,
          primary_contact_email: opp?.site_contact_email ?? null,
          primary_contact_phone: opp?.site_contact_phone ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create property");
      const siteId = json.site?.id;
      // Link opp → site
      await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId }),
      });
      setOpp(prev => prev ? { ...prev, site_id: siteId } : prev);
      setShowCreateProperty(false);
      // Navigate to new site
      window.location.href = `/sites/${siteId}`;
    } catch (e: unknown) {
      setCreatePropError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreatePropSaving(false);
    }
  };

  // ── Inline field save ───────────────────────────────────────────────────
  const saveField = async (key: string, val: string) => {
    const numericFields = ['units','vehicle_gates','pedestrian_gates','amenity_doors',
      'existing_cameras','new_cameras','est_deposit','monthly_per_unit',
      'monthly_total','est_mrr','amount','probability'];
    const payload: Record<string, string | number | null> = {
      [key]: numericFields.includes(key) ? (val === '' ? null : Number(val)) : (val || null),
    };
    const res = await fetch(`/api/crm/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Save failed'); }
    setOpp(prev => prev ? { ...prev, ...payload } as typeof prev : prev);
  };

  // Upload Executed Doc state
  const [showUploadExec,   setShowUploadExec]   = useState(false);
  const [uploadFile,       setUploadFile]       = useState<File | null>(null);
  const [uploadForm,       setUploadForm]       = useState({
    document_type:      'nda',
    source:             'uploaded',       // 'uploaded' | 'their_nda'
    signer_name:        '',
    signer_email:       '',
    signer_title:       '',
    signer_company:     '',
    signed_at:          new Date().toISOString().split('T')[0],
    countersigned_name: 'Russel Feldman',
    countersigned_title:'CEO',
    countersigned_at:   new Date().toISOString().split('T')[0],
    notes:              '',
  });
  const [uploading,        setUploading]        = useState(false);
  const [uploadError,      setUploadError]      = useState<string | null>(null);
  const uploadFileRef = useRef<HTMLInputElement>(null);

  const fetchOpp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/opportunities/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOpp(data);
      // Sync checklist from DB
      if (data.documents_status && typeof data.documents_status === "object") {
        setChecklistStatus(data.documents_status as Record<string, boolean>);
      }
      // Pre-fill Create Property form from opp data
      setCreatePropForm(f => ({
        ...f,
        name:    data.account_name     ?? f.name,
        address: data.property_address ?? f.address,
        city:    data.property_city    ?? f.city,
        state:   data.property_state   ?? f.state,
        zip:     data.property_zip     ?? f.zip,
        units: data.units ? String(data.units) : f.units,
        pm_name:  data.site_contact_name  ?? f.pm_name,
        pm_email: data.site_contact_email ?? f.pm_email,
        pm_phone: data.site_contact_phone ?? f.pm_phone,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = async (key: string) => {
    const next = { ...checklistStatus, [key]: !checklistStatus[key] };
    setChecklistStatus(next); // optimistic
    setChecklistSaving(key);
    try {
      await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents_status: next }),
      });
    } finally {
      setChecklistSaving(null);
    }
  };

  const fetchDocSigs = async () => {
    if (!id) return;
    setDocSigsLoading(true);
    try {
      const res = await fetch(`/api/signatures/by-record?opportunity_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setDocSigs(data.signatures ?? []);
      }
    } catch (_) {}
    setDocSigsLoading(false);
  };

  useEffect(() => {
    if (id) fetchOpp();
    if (id) fetchDocSigs();
    // Fetch active document templates for version display + auto-lookup
    fetch('/api/document-templates')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.templates) return;
        const map: Record<string, { version: string; is_active: boolean }> = {};
        for (const t of data.templates) map[t.document_type] = { version: t.version, is_active: t.is_active };
        setDocTemplates(map);
      })
      .catch(() => {/* non-blocking */});
  }, [id]);

  // Auto-fill signer fields from opportunity contact data
  const openSendDoc = (docValue: string, advStage: string) => {
    setSendDocType(docValue);
    setSendDocAdvanceStage(advStage);
    setSendDocError(null);
    setSendDocSuccess(null);
    // Pre-populate from primary contact or site contact
    const primaryContact = opp?.contacts?.[0];
    setSendDocSignerName(primaryContact?.name ?? opp?.site_contact_name ?? '');
    setSendDocSignerEmail(primaryContact?.email ?? opp?.site_contact_email ?? '');
    setSendDocSignerTitle(primaryContact?.title ?? '');
    setShowSendDoc(true);
  };

  const handleSendDoc = async () => {
    if (!sendDocSignerEmail.trim() || !sendDocSignerName.trim()) return;
    setSendDocSending(true);
    setSendDocError(null);
    setSendDocSuccess(null);
    try {
      const res = await fetch('/api/signatures/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type:   sendDocType,
          opportunity_id:  opp?.id,
          signer_name:     sendDocSignerName.trim(),
          signer_email:    sendDocSignerEmail.trim(),
          signer_title:    sendDocSignerTitle.trim() || undefined,
          signer_company:  opp?.account_name || undefined,
          advance_stage:   sendDocAdvanceStage || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send');
      setSendDocSuccess(`✓ ${DOC_TYPE_LABELS[sendDocType] ?? sendDocType} sent to ${sendDocSignerEmail.trim()}`);
      setSendDocSignerEmail('');
      setSendDocSignerName('');
      setSendDocSignerTitle('');
      setSendDocAdvanceStage('');
      // Auto-close after a moment
      setTimeout(() => {
        setShowSendDoc(false);
        setSendDocSuccess(null);
      }, 3000);
    } catch (e: unknown) {
      setSendDocError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSendDocSending(false);
    }
  };

  const handleCountersign = async () => {
    if (!countersignId || !countersignName.trim()) return;
    setCountersigning(true);
    setCountersignError(null);
    try {
      const res = await fetch('/api/signatures/countersign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_id:       countersignId,
          countersigned_name:  countersignName.trim(),
          countersigned_title: countersignTitle.trim() || 'CEO',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Countersign failed');
      setCountersignId(null);
      await fetchDocSigs();
      await fetchOpp(); // refresh stage
    } catch (e: unknown) {
      setCountersignError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCountersigning(false);
    }
  };

  const handleUploadExec = async () => {
    if (!uploadForm.signer_name.trim() || !uploadForm.signer_email.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      if (uploadFile) fd.append('file', uploadFile);
      fd.append('document_type',      uploadForm.document_type);
      fd.append('source',             uploadForm.source);
      fd.append('opportunity_id',     id);
      fd.append('signer_name',        uploadForm.signer_name.trim());
      fd.append('signer_email',       uploadForm.signer_email.trim());
      fd.append('signer_title',       uploadForm.signer_title.trim());
      fd.append('signer_company',     uploadForm.signer_company.trim());
      fd.append('signed_at',          uploadForm.signed_at ? new Date(uploadForm.signed_at).toISOString() : new Date().toISOString());
      fd.append('countersigned_name', uploadForm.countersigned_name.trim());
      fd.append('countersigned_title',uploadForm.countersigned_title.trim());
      fd.append('countersigned_at',   uploadForm.countersigned_at ? new Date(uploadForm.countersigned_at).toISOString() : new Date().toISOString());
      if (uploadForm.notes.trim()) fd.append('notes', uploadForm.notes.trim());

      const res = await fetch('/api/signatures/upload-executed', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');

      setShowUploadExec(false);
      setUploadFile(null);
      setUploadForm(f => ({ ...f, signer_name: '', signer_email: '', signer_title: '', signer_company: '', notes: '' }));
      await fetchDocSigs();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const advanceStage = async () => {
    if (!opp) return;
    const currentIdx = ORDERED_STAGES.indexOf(opp.stage);
    if (currentIdx === -1 || currentIdx >= ORDERED_STAGES.length - 1) return;
    const nextStage = ORDERED_STAGES[currentIdx + 1];
    setStageSaving(true);
    try {
      await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStage }),
      });
      await fetchOpp();
    } finally {
      setStageSaving(false);
    }
  };

  const submitActivity = async (
    type: ActivityType,
    payload: Record<string, unknown>
  ) => {
    setActivitySaving(true);
    try {
      await fetch(`/api/crm/opportunities/${id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, created_by_name: "Russel Feldman", ...payload }),
      });
      await fetchOpp();
      setShowLogCall(false);
      setShowNewTask(false);
      setShowNewEvent(false);
      setShowEmail(false);
      setCallForm({ subject: "", outcome: "Connected", duration: "", notes: "" });
      setTaskForm({ subject: "", due_date: "", notes: "" });
      setEventForm({ subject: "", date: "", time: "", notes: "" });
      setEmailForm({ to: "", subject: "", body: "" });
    } finally {
      setActivitySaving(false);
    }
  };

  const submitLogActivity = async () => {
    if (!logActSubject.trim()) return;
    setLogActSaving(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: logActType,
          subject: logActSubject.trim(),
          body: logActBody.trim() || null,
          due_at: logActDueAt || null,
          outcome: logActOutcome.trim() || null,
          created_by_name: opp?.owner_name ?? "Russel Feldman",
        }),
      });
      const json = await res.json();
      if (res.ok && json.id) {
        // Optimistically prepend the new activity
        setOpp(prev => prev ? {
          ...prev,
          activities: [json, ...(prev.activities ?? [])],
        } : prev);
      }
      setShowLogActivity(false);
      setLogActSubject("");
      setLogActBody("");
      setLogActDueAt("");
      setLogActOutcome("");
    } finally {
      setLogActSaving(false);
    }
  };

  // ── Activity edit/delete/complete handlers ────────────────────────────────
  const startEditActivity = (act: Activity) => {
    setEditingActivityId(act.id);
    setEditActForm({
      subject: act.subject ?? "",
      body:    act.body    ?? "",
      type:    act.type,
      due_at:  act.due_at ? act.due_at.slice(0, 16) : "",
      outcome: act.outcome ?? "",
    });
  };

  const saveActivityEdit = async () => {
    if (!editingActivityId) return;
    setEditActSaving(true);
    try {
      const res = await fetch(`/api/crm/activities/${editingActivityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editActForm.subject.trim(),
          body:    editActForm.body.trim() || null,
          type:    editActForm.type,
          due_at:  editActForm.due_at ? new Date(editActForm.due_at).toISOString() : null,
          outcome: editActForm.outcome.trim() || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOpp(prev => prev ? {
          ...prev,
          activities: (prev.activities ?? []).map(a => a.id === editingActivityId ? { ...a, ...updated } : a),
        } : prev);
        setEditingActivityId(null);
      }
    } finally {
      setEditActSaving(false);
    }
  };

  const deleteActivity = async (actId: string) => {
    await fetch(`/api/crm/activities/${actId}`, { method: "DELETE" });
    setOpp(prev => prev ? {
      ...prev,
      activities: (prev.activities ?? []).filter(a => a.id !== actId),
    } : prev);
  };

  const toggleActivityComplete = async (act: Activity) => {
    const nowIso = new Date().toISOString();
    const newCompleted = act.completed_at ? null : nowIso;
    const res = await fetch(`/api/crm/activities/${act.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed_at: newCompleted }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOpp(prev => prev ? {
        ...prev,
        activities: (prev.activities ?? []).map(a => a.id === act.id ? { ...a, ...updated } : a),
      } : prev);
    }
  };

  const sendEmail = async () => {
    if (!emailForm.to.trim() || !emailForm.subject.trim() || !emailForm.body.trim()) return;
    setEmailSending(true);
    setEmailSendError(null);
    try {
      const res = await fetch("/api/crm/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: id,
          to_email: emailForm.to.trim(),
          to_name: opp?.site_contact_name ?? "",
          subject: emailForm.subject.trim(),
          body: emailForm.body.trim(),
          sender_name: opp?.owner_name ?? "Russel Feldman",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      // Optimistically add to feed
      setOpp(prev => prev ? {
        ...prev,
        activities: [{ ...data, type: "email" }, ...(prev.activities ?? [])],
      } : prev);
      setShowEmail(false);
      setEmailForm({ to: "", subject: "", body: "" });
    } catch (e: unknown) {
      setEmailSendError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setEmailSending(false);
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim()) return;
    setSavingContact(true);
    setContactError(null);
    try {
      const res = await fetch(`/api/crm/opportunities/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setContactError(err.error ?? `Failed to save contact (${res.status})`);
        return;
      }
      await fetchOpp();
      setShowAddContact(false);
      setContactForm({ name: "", title: "", phone: "", email: "", role: "" });
    } catch (err: any) {
      setContactError(err.message ?? "Network error saving contact");
    } finally {
      setSavingContact(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    try {
      const res = await fetch(
        `/api/crm/opportunities/${id}/contacts?contactId=${contactId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setContactError(err.error ?? "Failed to delete contact");
        return;
      }
      await fetchOpp();
    } catch (err: any) {
      setContactError(err.message ?? "Network error deleting contact");
    }
  };

  // Pre-fill edit form when slide-over opens
  useEffect(() => {
    if (showEdit && opp) {
      setEditForm({
        name: opp.name ?? "",
        account_name: opp.account_name ?? "",
        amount: opp.amount != null ? String(opp.amount) : "",
        close_date: opp.close_date ? opp.close_date.slice(0, 10) : "",
        stage: opp.stage ?? "",
        description: opp.description ?? "",
        next_step: opp.next_step ?? "",
        probability: opp.probability != null ? String(opp.probability) : "",
        forecast_cat: opp.forecast_category ?? "",
        opportunity_type: opp.opportunity_type ?? "",
        site_contact_name:  opp.site_contact_name  ?? "",
        site_contact_email: opp.site_contact_email ?? "",
        site_contact_phone: opp.site_contact_phone ?? "",
        property_address:   opp.property_address ?? "",
        property_city:      opp.property_city  ?? "",
        property_state:     opp.property_state ?? "",
        property_zip:       opp.property_zip   ?? "",
        units:              opp.units ? String(opp.units) : "",
        source:             opp.source ?? "",
        est_mrr:            opp.est_mrr ? String(opp.est_mrr) : "",
        related_org_id:     opp.related_org_id ?? null,
        related_org_name:   "",
      });
    }
  }, [showEdit]);

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               editForm.name              || undefined,
          account_name:       editForm.account_name      || undefined,
          amount:             editForm.amount !== ""     ? Number(editForm.amount)      : undefined,
          close_date:         editForm.close_date        || undefined,
          stage:              editForm.stage             || undefined,
          description:        editForm.description       || undefined,
          next_step:          editForm.next_step         || undefined,
          probability:        editForm.probability !== "" ? Number(editForm.probability) : undefined,
          forecast_cat:       editForm.forecast_cat      || undefined,   // DB column is forecast_cat
          opportunity_type:   editForm.opportunity_type  || undefined,
          site_contact_name:  editForm.site_contact_name  || undefined,
          site_contact_email: editForm.site_contact_email || undefined,
          site_contact_phone: editForm.site_contact_phone || undefined,
          property_address:   editForm.property_address   || undefined,
          property_city:      editForm.property_city      || undefined,
          property_state:     editForm.property_state     || undefined,
          property_zip:       editForm.property_zip       || undefined,
          units:              editForm.units !== ""       ? Number(editForm.units)  : undefined,
          source:             editForm.source             || undefined,
          est_mrr:            editForm.est_mrr !== ""     ? Number(editForm.est_mrr): undefined,
          related_org_id:     editForm.related_org_id    ?? null,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`Save failed: ${e.error ?? "Unknown error"}`);
        return;
      }
      await fetchOpp();
      setShowEdit(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteOpp = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/crm/opportunities/${id}`, { method: "DELETE" });
      router.push("/crm");
    } finally {
      setDeleting(false);
    }
  };

  // ── Loading & Error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <TopBar title="Opportunity" subtitle="Loading…" />
        <div className="px-6 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <TopBar title="Opportunity" />
        <div className="px-6 py-6">
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle size={16} />
            <span className="text-sm flex-1">{error ?? "Opportunity not found"}</span>
            <button onClick={fetchOpp} className="text-xs font-medium underline">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cfg = STAGE_CONFIG[opp.stage];
  const stageIdx = ORDERED_STAGES.indexOf(opp.stage);
  const canAdvance = opp.stage !== "won" && opp.stage !== "lost";
  const aiTip = AI_TIPS[opp.stage];

  // Sort activities newest first
  const sortedActivities = [...(opp.activities ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Stage history newest first
  const sortedHistory = [...(opp.stage_history ?? [])].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Bar */}
      <TopBar
        title={opp.name}
        subtitle="Opportunity Detail"
        actions={
          <div className="flex items-center gap-2">
            {followToast && (
              <span className="text-xs text-emerald-600 font-medium animate-in fade-in">
                {following ? "Following!" : "Unfollowed"}
              </span>
            )}
            <button
              onClick={handleFollow}
              className={cn(
                "px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors",
                following ? "border-[#6B7EFF] text-[#6B7EFF] bg-[#6B7EFF]/5" : "border-border"
              )}
            >
              {following ? "✓ Following" : "Follow"}
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors flex items-center gap-1"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        }
      />

      {/* Breadcrumb + Meta */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Link href="/crm/opportunities" className="hover:text-[#6B7EFF] transition-colors">
            Opportunities
          </Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium truncate">{opp.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {opp.opportunity_type && (
            <span className={cn(
              "text-[10px] font-semibold px-2.5 py-0.5 rounded-full",
              OPP_TYPE_BADGE[opp.opportunity_type]
            )}>
              {OPP_TYPE_LABELS[opp.opportunity_type]}
            </span>
          )}
          {opp.account_name && (
            <span className="text-sm text-[#6B7EFF] font-medium">{opp.account_name}</span>
          )}
          <span className="text-sm font-bold text-foreground">{fmt$(opp.amount)}</span>
          {opp.close_date && (
            <span className="text-sm text-muted-foreground">
              Close: {fmtDate(opp.close_date)}
            </span>
          )}
          {opp.owner_name && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <div className="w-5 h-5 rounded-full bg-[#6B7EFF]/20 border border-[#6B7EFF]/30 flex items-center justify-center text-[9px] font-bold text-[#6B7EFF]">
                {opp.owner_initials ?? opp.owner_name.slice(0, 2).toUpperCase()}
              </div>
              {opp.owner_name}
            </div>
          )}
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-stretch gap-0 mb-3 rounded-lg overflow-hidden border border-border">
          {ORDERED_STAGES.map((s, i) => {
            const sCfg = STAGE_CONFIG[s];
            const isPast = i < stageIdx;
            const isCurrent = i === stageIdx;
            const isFuture = i > stageIdx;
            return (
              <div
                key={s}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium border-r last:border-r-0 border-border transition-colors",
                  isPast && "bg-emerald-50 text-emerald-700",
                  isCurrent && "bg-[#6B7EFF] text-white",
                  isFuture && "bg-white text-muted-foreground"
                )}
              >
                {isPast && <Check size={11} />}
                <span className="truncate hidden sm:inline">{sCfg.label}</span>
                <span className="sm:hidden truncate">{sCfg.label.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs italic text-muted-foreground max-w-lg">
            {cfg.guidance}
          </p>
          {canAdvance && (
            <button
              onClick={advanceStage}
              disabled={stageSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors flex-shrink-0 ml-4"
            >
              {stageSaving ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <ChevronRight size={12} />
              )}
              {stageSaving ? "Saving…" : "Mark Stage as Complete →"}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-5 grid grid-cols-3 gap-6">
        {/* LEFT — col-span-2 */}
        <div className="col-span-2 space-y-5">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 border-b border-border">
            {(["details", "activity", "documents", "tasks"] as Tab[]).map((tab) => {
              const needsSig = tab === "documents" ? docSigs.filter(s => s.status === 'counterparty_signed').length : 0;
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); if (tab === 'documents') fetchDocSigs(); }}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize flex items-center gap-1.5",
                    activeTab === tab
                      ? "border-[#6B7EFF] text-[#6B7EFF]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "activity" ? "Activity" : tab === "documents" ? "Documents" : tab === "tasks" ? "Tasks" : "Details"}
                  {needsSig > 0 && (
                    <span className="bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{needsSig}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── DETAILS TAB ── */}
          {activeTab === "details" && (
            <div className="space-y-4">
              {/* About */}
              <DetailCard title="About">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <FieldRow label="Opportunity Name"     value={opp.name}               fieldKey="name"               onSave={saveField} />
                  <FieldRow label="Account Name"         value={opp.account_name}       fieldKey="account_name"       onSave={saveField} />
                  <FieldRow label="Close Date"           value={opp.close_date}         fieldKey="close_date"         type="date"     onSave={saveField} />
                  <FieldRow label="Amount"               value={opp.amount != null ? String(opp.amount) : undefined} fieldKey="amount" type="number" onSave={saveField} />
                  <FieldRow label="Description"          value={opp.description}        fieldKey="description"        type="textarea" onSave={saveField} className="col-span-2" />
                  <FieldRow label="Opportunity Owner"    value={opp.owner_name}         fieldKey="owner_name"         onSave={saveField} />
                  <FieldRow label="Street Address"        value={opp.property_address}   fieldKey="property_address"   onSave={saveField} className="col-span-2" />
                  <FieldRow label="City"                 value={opp.property_city}      fieldKey="property_city"      onSave={saveField} />
                  <FieldRow label="State"                value={opp.property_state}     fieldKey="property_state"     onSave={saveField} />
                  <FieldRow label="ZIP"                  value={opp.property_zip}       fieldKey="property_zip"       onSave={saveField} />
                  <FieldRow label="Site Point of Contact" value={opp.site_contact_name} fieldKey="site_contact_name"  onSave={saveField} />
                  <FieldRow label="Site Phone Number"    value={opp.site_contact_phone} fieldKey="site_contact_phone" type="tel"      onSave={saveField} />
                  <FieldRow label="Site Contact E-Mail"  value={opp.site_contact_email} fieldKey="site_contact_email" type="email"    onSave={saveField} />
                  <FieldRow label="Next Step"            value={opp.next_step}          fieldKey="next_step"          type="textarea" onSave={saveField} className="col-span-2" />
                  <FieldRow label="Probability %"        value={opp.probability != null ? String(opp.probability) : undefined} fieldKey="probability" type="number" onSave={saveField} />
                  <FieldRow label="Forecast Category"    value={opp.forecast_category}  fieldKey="forecast_category"  onSave={saveField} />
                  <FieldRow label="Stage"                value={cfg.label} />
                </div>
              </DetailCard>

              {/* Property Specs */}
              <DetailCard title="Property Specs">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <FieldRow label="Number of Units"  value={opp.units != null ? String(opp.units) : undefined}                     fieldKey="units"            type="number" onSave={saveField} />
                  <FieldRow label="Vehicle Gates"    value={opp.vehicle_gates != null ? String(opp.vehicle_gates) : undefined}     fieldKey="vehicle_gates"    type="number" onSave={saveField} />
                  <FieldRow label="Pedestrian Gates" value={opp.pedestrian_gates != null ? String(opp.pedestrian_gates) : undefined} fieldKey="pedestrian_gates" type="number" onSave={saveField} />
                  <FieldRow label="Amenity Doors"    value={opp.amenity_doors != null ? String(opp.amenity_doors) : undefined}     fieldKey="amenity_doors"    type="number" onSave={saveField} />
                  <FieldRow label="Existing Cameras" value={opp.existing_cameras != null ? String(opp.existing_cameras) : undefined} fieldKey="existing_cameras" type="number" onSave={saveField} />
                  <FieldRow label="New Cameras"      value={opp.new_cameras != null ? String(opp.new_cameras) : undefined}         fieldKey="new_cameras"      type="number" onSave={saveField} />
                </div>
              </DetailCard>

              {/* Financial Details */}
              <DetailCard title="Financial Details">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <FieldRow label="Est. Deposit"      value={opp.est_deposit != null ? String(opp.est_deposit) : undefined}           fieldKey="est_deposit"      type="number" onSave={saveField} />
                  <FieldRow label="Monthly Per Unit"  value={opp.monthly_per_unit != null ? String(opp.monthly_per_unit) : undefined} fieldKey="monthly_per_unit" type="number" onSave={saveField} />
                  <FieldRow label="Monthly Total"     value={opp.monthly_total != null ? String(opp.monthly_total) : undefined}       fieldKey="monthly_total"    type="number" onSave={saveField} />
                  <FieldRow label="Est. MRR"          value={opp.est_mrr != null ? String(opp.est_mrr) : undefined}                   fieldKey="est_mrr"          type="number" onSave={saveField} />
                  <FieldRow label="DirecTV Package"   value={opp.directv_package}   fieldKey="directv_package"   onSave={saveField} />
                  <FieldRow label="ISP Service"       value={opp.isp_service}       fieldKey="isp_service"       onSave={saveField} />
                  <FieldRow label="MDU Contract Expiry" value={opp.mdu_contract_expiry} fieldKey="mdu_contract_expiry" type="date" onSave={saveField} />
                </div>
              </DetailCard>
            </div>
          )}

          {/* ── ACTIVITY TAB ── */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              {/* Log Activity — unified button + inline form */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activity</span>
                  <button
                    onClick={() => setShowLogActivity(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] transition-colors"
                  >
                    <Plus size={12} />
                    Log Activity
                  </button>
                </div>

                {showLogActivity && (
                  <div className="bg-slate-50 border border-border rounded-xl p-4 space-y-3 mb-4">
                    {/* Type pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(["call", "email", "meeting", "note", "task"] as ActivityType[]).map(t => (
                        <button
                          key={t}
                          onClick={() => setLogActType(t)}
                          className={cn(
                            "px-2.5 py-1 text-[11px] font-medium rounded-lg border capitalize transition-colors",
                            logActType === t
                              ? "bg-[#6B7EFF] text-white border-[#6B7EFF]"
                              : "bg-white border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {/* Subject */}
                    <input
                      type="text"
                      placeholder={
                        logActType === "call" ? "Call summary…"
                        : logActType === "email" ? "Email subject…"
                        : logActType === "task" ? "What needs to happen?"
                        : logActType === "meeting" ? "Meeting summary…"
                        : "Add a note…"
                      }
                      value={logActSubject}
                      onChange={e => setLogActSubject(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-white"
                    />

                    {/* Body */}
                    <textarea
                      placeholder="Additional details (optional)…"
                      value={logActBody}
                      onChange={e => setLogActBody(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-white resize-none"
                    />

                    {/* Due date — only for task */}
                    {logActType === "task" && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">Due date:</label>
                        <input
                          type="date"
                          value={logActDueAt}
                          onChange={e => setLogActDueAt(e.target.value)}
                          className="px-2 py-1 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                        />
                      </div>
                    )}

                    {/* Outcome — only for call/meeting */}
                    {(logActType === "call" || logActType === "meeting") && (
                      <input
                        type="text"
                        placeholder="What was the outcome?"
                        value={logActOutcome}
                        onChange={e => setLogActOutcome(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-white"
                      />
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => { setShowLogActivity(false); setLogActSubject(""); setLogActBody(""); setLogActDueAt(""); setLogActOutcome(""); }}
                        className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitLogActivity}
                        disabled={!logActSubject.trim() || logActSaving}
                        className="px-4 py-1.5 text-xs font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-40 transition-colors"
                      >
                        {logActSaving ? "Saving…" : "Log It"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <ActivityToggleBtn
                  icon={<Phone size={13} />}
                  label="Log a Call"
                  active={showLogCall}
                  onClick={() => { setShowLogCall(!showLogCall); setShowNewTask(false); setShowNewEvent(false); setShowEmail(false); }}
                />
                <ActivityToggleBtn
                  icon={<Mail size={13} />}
                  label="Email"
                  active={showEmail}
                  onClick={() => { setShowEmail(!showEmail); setShowLogCall(false); setShowNewTask(false); setShowNewEvent(false); }}
                />
                <ActivityToggleBtn
                  icon={<CalendarClock size={13} />}
                  label="New Event"
                  active={showNewEvent}
                  onClick={() => { setShowNewEvent(!showNewEvent); setShowLogCall(false); setShowNewTask(false); setShowEmail(false); }}
                />
                <ActivityToggleBtn
                  icon={<ClipboardList size={13} />}
                  label="New Task"
                  active={showNewTask}
                  onClick={() => { setShowNewTask(!showNewTask); setShowLogCall(false); setShowNewEvent(false); setShowEmail(false); }}
                />
              </div>

              {/* Log a Call form */}
              {showLogCall && (
                <ActivityFormCard title="Log a Call" onClose={() => setShowLogCall(false)}>
                  <Field label="Subject">
                    <input type="text" value={callForm.subject} onChange={e => setCallForm({...callForm, subject: e.target.value})} className={inputCls} placeholder="e.g. Intro call with Maria" />
                  </Field>
                  <Field label="Outcome">
                    <select value={callForm.outcome} onChange={e => setCallForm({...callForm, outcome: e.target.value})} className={inputCls}>
                      <option>Connected</option>
                      <option>Voicemail</option>
                      <option>No Answer</option>
                    </select>
                  </Field>
                  <Field label="Duration (mins)">
                    <input type="number" value={callForm.duration} onChange={e => setCallForm({...callForm, duration: e.target.value})} className={inputCls} placeholder="e.g. 15" />
                  </Field>
                  <Field label="Notes">
                    <textarea value={callForm.notes} onChange={e => setCallForm({...callForm, notes: e.target.value})} rows={3} className={cn(inputCls, "resize-none")} placeholder="What was discussed…" />
                  </Field>
                  <button
                    onClick={() => submitActivity("call", { subject: callForm.subject, outcome: callForm.outcome, duration_mins: callForm.duration ? parseInt(callForm.duration) : undefined, body: callForm.notes })}
                    disabled={activitySaving || !callForm.subject.trim()}
                    className="w-full py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                  >
                    {activitySaving ? "Saving…" : "Save Call"}
                  </button>
                </ActivityFormCard>
              )}

              {/* New Task form */}
              {showNewTask && (
                <ActivityFormCard title="New Task" onClose={() => setShowNewTask(false)}>
                  <Field label="Subject">
                    <input type="text" value={taskForm.subject} onChange={e => setTaskForm({...taskForm, subject: e.target.value})} className={inputCls} placeholder="e.g. Send proposal deck" />
                  </Field>
                  <Field label="Due Date">
                    <input type="date" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} className={inputCls} />
                  </Field>
                  <Field label="Notes">
                    <textarea value={taskForm.notes} onChange={e => setTaskForm({...taskForm, notes: e.target.value})} rows={2} className={cn(inputCls, "resize-none")} placeholder="Additional context…" />
                  </Field>
                  <button
                    onClick={() => submitActivity("task", { subject: taskForm.subject, due_at: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : undefined, body: taskForm.notes })}
                    disabled={activitySaving || !taskForm.subject.trim()}
                    className="w-full py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                  >
                    {activitySaving ? "Saving…" : "Create Task"}
                  </button>
                </ActivityFormCard>
              )}

              {/* New Event form */}
              {showNewEvent && (
                <ActivityFormCard title="New Event" onClose={() => setShowNewEvent(false)}>
                  <Field label="Subject">
                    <input type="text" value={eventForm.subject} onChange={e => setEventForm({...eventForm, subject: e.target.value})} className={inputCls} placeholder="e.g. Site walkthrough" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date">
                      <input type="date" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} className={inputCls} />
                    </Field>
                    <Field label="Time">
                      <input type="time" value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <textarea value={eventForm.notes} onChange={e => setEventForm({...eventForm, notes: e.target.value})} rows={2} className={cn(inputCls, "resize-none")} placeholder="Agenda or prep notes…" />
                  </Field>
                  <button
                    onClick={() => {
                      const due = eventForm.date ? new Date(`${eventForm.date}T${eventForm.time || "09:00"}`).toISOString() : undefined;
                      submitActivity("meeting", { subject: eventForm.subject, due_at: due, body: eventForm.notes });
                    }}
                    disabled={activitySaving || !eventForm.subject.trim()}
                    className="w-full py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
                  >
                    {activitySaving ? "Saving…" : "Create Event"}
                  </button>
                </ActivityFormCard>
              )}

              {/* Email form — real send via Resend */}
              {showEmail && (
                <ActivityFormCard title="Send Email" onClose={() => { setShowEmail(false); setEmailSendError(null); }}>
                  {emailSendError && (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      {emailSendError}
                    </div>
                  )}
                  <Field label="To (email address)">
                    <input
                      type="email"
                      value={emailForm.to}
                      onChange={e => setEmailForm({...emailForm, to: e.target.value})}
                      className={inputCls}
                      placeholder={opp?.site_contact_email ?? "contact@property.com"}
                    />
                  </Field>
                  <Field label="Subject">
                    <input type="text" value={emailForm.subject} onChange={e => setEmailForm({...emailForm, subject: e.target.value})} className={inputCls} placeholder="e.g. GateGuard proposal for Ashford Glen" />
                  </Field>
                  <Field label="Body">
                    <textarea value={emailForm.body} onChange={e => setEmailForm({...emailForm, body: e.target.value})} rows={6} className={cn(inputCls, "resize-none")} placeholder="Write your email here…" />
                  </Field>
                  <p className="text-[10px] text-muted-foreground">
                    Sent from <span className="font-mono">crm@mail.gateguard.co</span> · Open tracking enabled
                  </p>
                  <button
                    onClick={sendEmail}
                    disabled={emailSending || !emailForm.to.trim() || !emailForm.subject.trim() || !emailForm.body.trim()}
                    className="w-full py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Mail size={13} />
                    {emailSending ? "Sending…" : "Send Email"}
                  </button>
                </ActivityFormCard>
              )}

              {/* Activity Feed */}
              <div className="space-y-2">
                {sortedActivities.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    No activity yet. Log a call to get started.
                  </div>
                ) : (
                  sortedActivities.map((act) => (
                    <div
                      key={act.id}
                      className={cn(
                        "bg-white rounded-xl border transition-colors",
                        act.type === "email" && act.email_status === "received"
                          ? "border-emerald-200 bg-emerald-50/30"
                          : act.completed_at
                          ? "border-border opacity-60"
                          : "border-border"
                      )}
                    >
                      {/* Main row */}
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                            activityTypeColor(act.type)
                          )}
                        >
                          <ActivityIcon type={act.type} size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={cn("text-sm font-semibold text-foreground", act.completed_at && "line-through text-muted-foreground")}>
                              {act.subject}
                            </p>
                            {act.completed_at && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                ✓ DONE
                              </span>
                            )}
                            {/* Email status badges */}
                            {act.type === "email" && act.email_status === "received" && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                ↙ INBOUND
                              </span>
                            )}
                            {act.type === "email" && act.sent_via_resend && act.email_status === "sent" && !act.opened_at && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                ✓ SENT
                              </span>
                            )}
                            {act.type === "email" && act.opened_at && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                👁 OPENED {act.open_count && act.open_count > 1 ? `×${act.open_count}` : ""}
                              </span>
                            )}
                            {act.type === "email" && act.email_status === "failed" && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                                ✗ FAILED
                              </span>
                            )}
                          </div>
                          {act.type === "email" && act.to_email && act.email_status !== "received" && (
                            <p className="text-[10px] text-muted-foreground">To: {act.to_email}</p>
                          )}
                          {act.type === "email" && act.from_email && act.email_status === "received" && (
                            <p className="text-[10px] text-muted-foreground">From: {act.from_email}</p>
                          )}
                          {act.type === "email" && act.opened_at && (
                            <p className="text-[10px] text-violet-600 font-medium">
                              Opened {timeAgo(act.opened_at)}
                            </p>
                          )}
                          {act.body && editingActivityId !== act.id && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{act.body}</p>
                          )}
                          {act.outcome && editingActivityId !== act.id && (
                            <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              {act.outcome}
                            </span>
                          )}
                          {act.due_at && editingActivityId !== act.id && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Due: {new Date(act.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                          {act.created_by_name && (
                            <p className="text-[10px] text-muted-foreground mt-1">{act.created_by_name}</p>
                          )}
                        </div>
                        {/* Action buttons + timestamp */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap font-mono mr-1">
                            {timeAgo(act.created_at)}
                          </span>
                          {/* Complete/reopen toggle */}
                          <button
                            onClick={() => toggleActivityComplete(act)}
                            title={act.completed_at ? "Reopen" : "Mark complete"}
                            className={cn(
                              "p-1 rounded hover:bg-slate-100 transition-colors",
                              act.completed_at ? "text-emerald-600" : "text-muted-foreground"
                            )}
                          >
                            {act.completed_at
                              ? <CheckSquare size={14} />
                              : <Square size={14} />
                            }
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => editingActivityId === act.id ? setEditingActivityId(null) : startEditActivity(act)}
                            title="Edit"
                            className="p-1 rounded hover:bg-slate-100 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 size={13} />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => deleteActivity(act.id)}
                            title="Delete"
                            className="p-1 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Inline edit panel */}
                      {editingActivityId === act.id && (
                        <div className="border-t border-border px-4 py-3 space-y-3 bg-slate-50/60 rounded-b-xl">
                          <div className="flex gap-2">
                            <select
                              value={editActForm.type}
                              onChange={e => setEditActForm(f => ({ ...f, type: e.target.value as ActivityType }))}
                              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white text-foreground"
                            >
                              {(["call", "email", "meeting", "task", "note"] as ActivityType[]).map(t => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                              ))}
                            </select>
                            <input
                              className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
                              value={editActForm.subject}
                              onChange={e => setEditActForm(f => ({ ...f, subject: e.target.value }))}
                              placeholder="Subject"
                            />
                          </div>
                          <textarea
                            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                            rows={3}
                            value={editActForm.body}
                            onChange={e => setEditActForm(f => ({ ...f, body: e.target.value }))}
                            placeholder="Notes / body"
                          />
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide block mb-1">Due / Scheduled</label>
                              <input
                                type="datetime-local"
                                className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                                value={editActForm.due_at}
                                onChange={e => setEditActForm(f => ({ ...f, due_at: e.target.value }))}
                              />
                            </div>
                            {(editActForm.type === "call" || editActForm.type === "meeting") && (
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide block mb-1">Outcome</label>
                                <input
                                  className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                                  value={editActForm.outcome}
                                  onChange={e => setEditActForm(f => ({ ...f, outcome: e.target.value }))}
                                  placeholder="e.g. Connected, No answer…"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingActivityId(null)}
                              className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-slate-100 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveActivityEdit}
                              disabled={editActSaving || !editActForm.subject.trim()}
                              className="px-3 py-1.5 text-xs rounded-lg bg-brand text-white font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
                            >
                              {editActSaving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — col-span-1 */}
        <div className="space-y-4">
          {/* Contact Roles */}
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Contact Roles</h3>
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="text-xs text-[#6B7EFF] hover:underline"
              >
                {showAddContact ? "Cancel" : "+ Add Contact"}
              </button>
            </div>

            {showAddContact && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-border space-y-2">
                <input type="text" placeholder="Full Name *" value={contactForm.name} onChange={e => { setContactForm({...contactForm, name: e.target.value}); setContactError(null); }} className={cn(inputCls, "text-xs py-1.5")} />
                <input type="text" placeholder="Title" value={contactForm.title} onChange={e => setContactForm({...contactForm, title: e.target.value})} className={cn(inputCls, "text-xs py-1.5")} />
                <input type="tel" placeholder="Phone" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} className={cn(inputCls, "text-xs py-1.5")} />
                <input type="email" placeholder="Email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className={cn(inputCls, "text-xs py-1.5")} />
                <select value={contactForm.role} onChange={e => setContactForm({...contactForm, role: e.target.value})} className={cn(inputCls, "text-xs py-1.5")}>
                  <option value="">Role…</option>
                  <option>Decision Maker</option>
                  <option>Property Manager</option>
                  <option>HOA President</option>
                  <option>Maintenance</option>
                  <option>Other</option>
                </select>
                {contactError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{contactError}</p>
                )}
                <button
                  onClick={saveContact}
                  disabled={savingContact || !contactForm.name.trim()}
                  className="w-full py-1.5 text-xs font-medium bg-[#6B7EFF] text-white rounded-lg disabled:opacity-50"
                >
                  {savingContact ? "Saving…" : "Add Contact"}
                </button>
              </div>
            )}

            {(opp.contacts ?? []).length === 0 && !showAddContact ? (
              <p className="text-xs text-muted-foreground">No contacts added yet</p>
            ) : (
              <div className="space-y-2">
                {(opp.contacts ?? []).map((c) => (
                  <div key={c.id} className="flex items-start gap-2 group">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-border flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                      {(c.name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
                      {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                      {c.phone && <p className="text-xs text-muted-foreground truncate">{c.phone}</p>}
                      {c.role && (
                        <span className="inline-block text-[10px] bg-[#6B7EFF]/10 text-[#6B7EFF] px-1.5 py-0.5 rounded-full mt-0.5">
                          {c.role}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteContact(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 p-1 flex-shrink-0"
                      title="Remove contact"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sales Cycle Checklist */}
          {opp.opportunity_type && STAGE_CHECKLIST[opp.opportunity_type] && (
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Sales Cycle</h3>
                {opp.opportunity_type && (
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    OPP_TYPE_BADGE[opp.opportunity_type]
                  )}>
                    {OPP_TYPE_LABELS[opp.opportunity_type]}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {(STAGE_CHECKLIST[opp.opportunity_type] ?? []).map((item) => {
                  const key = item.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
                  const checked = !!checklistStatus[key];
                  const saving = checklistSaving === key;
                  return (
                    <button
                      key={key}
                      onClick={() => toggleChecklistItem(key)}
                      disabled={saving}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors text-xs",
                        checked
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-white border-border text-foreground hover:bg-slate-50"
                      )}
                    >
                      <span className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                        checked ? "bg-emerald-500 border-emerald-500" : "border-border bg-white",
                        saving && "opacity-50"
                      )}>
                        {checked && <Check size={10} className="text-white" />}
                      </span>
                      <span className={cn("flex-1", checked && "line-through opacity-60")}>{item}</span>
                    </button>
                  );
                })}
              </div>
              {/* Progress bar */}
              {(() => {
                const items = STAGE_CHECKLIST[opp.opportunity_type!] ?? [];
                const done = items.filter(item => {
                  const key = item.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
                  return !!checklistStatus[key];
                }).length;
                const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
                return (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                      <span>{done} of {items.length} complete</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Send Document / E-Sign */}
          {opp.opportunity_type && OPP_DOCS[opp.opportunity_type] && (
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Documents</h3>
                <button
                  onClick={() => {
                    if (showSendDoc) { setShowSendDoc(false); return; }
                    const docs = OPP_DOCS[opp.opportunity_type!] ?? [];
                    const first = docs[0];
                    if (first) openSendDoc(first.value, first.advanceStage);
                    else { setShowSendDoc(true); }
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#6B7EFF] hover:text-[#5a6eee] bg-[#6B7EFF]/10 hover:bg-[#6B7EFF]/15 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FileText size={13} />
                  Send for Signature
                </button>
              </div>

              {sendDocSuccess && (
                <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {sendDocSuccess}
                </div>
              )}

              {showSendDoc && (
                <div className="border border-[#6B7EFF]/30 bg-[#6B7EFF]/5 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#6B7EFF] mb-2">Send Document for E-Signature</p>

                  {/* Document type */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Document</label>
                    <select
                      value={sendDocType}
                      onChange={e => {
                        setSendDocType(e.target.value);
                        const doc = (OPP_DOCS[opp.opportunity_type!] ?? []).find(d => d.value === e.target.value);
                        setSendDocAdvanceStage(doc?.advanceStage ?? '');
                      }}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    >
                      {(OPP_DOCS[opp.opportunity_type!] ?? []).map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    {/* Template version badge */}
                    {docTemplates[sendDocType] && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {docTemplates[sendDocType].is_active
                          ? <span className="text-emerald-600">✓ Template {docTemplates[sendDocType].version} ready</span>
                          : <span className="text-amber-600">⚠ No active template — PDF link will be omitted</span>
                        }
                      </p>
                    )}
                  </div>

                  {/* Signer name */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Signer Name *</label>
                    <input
                      type="text"
                      value={sendDocSignerName}
                      onChange={e => setSendDocSignerName(e.target.value)}
                      placeholder="Full legal name"
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>

                  {/* Signer email */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Signer Email *</label>
                    <input
                      type="email"
                      value={sendDocSignerEmail}
                      onChange={e => setSendDocSignerEmail(e.target.value)}
                      placeholder="signer@company.com"
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>

                  {/* Signer title */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Title / Role</label>
                    <input
                      type="text"
                      value={sendDocSignerTitle}
                      onChange={e => setSendDocSignerTitle(e.target.value)}
                      placeholder="e.g. CEO, Owner, Director"
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]"
                    />
                  </div>

                  {/* Advance stage hint */}
                  {sendDocAdvanceStage && (
                    <p className="text-[10px] text-muted-foreground bg-white rounded px-2 py-1 border border-border">
                      When signed, opportunity stage will advance to <strong>{sendDocAdvanceStage}</strong>
                    </p>
                  )}

                  {sendDocError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{sendDocError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSendDoc}
                      disabled={sendDocSending || !sendDocSignerName.trim() || !sendDocSignerEmail.trim()}
                      className="flex-1 bg-[#6B7EFF] text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#5a6eee] transition-colors"
                    >
                      {sendDocSending ? 'Sending…' : 'Send Signing Link →'}
                    </button>
                    <button
                      onClick={() => setShowSendDoc(false)}
                      className="px-4 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Document type quicklinks */}
              {!showSendDoc && (
                <div className="flex flex-wrap gap-2">
                  {(OPP_DOCS[opp.opportunity_type!] ?? []).map(d => (
                    <button
                      key={d.value}
                      onClick={() => openSendDoc(d.value, d.advanceStage)}
                      className="text-[10px] font-medium text-[#6B7EFF] bg-[#6B7EFF]/10 hover:bg-[#6B7EFF]/20 px-2.5 py-1 rounded-full transition-colors"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stage History */}
          <div className="bg-white rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Stage History</h3>
            {sortedHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No stage changes recorded</p>
            ) : (
              <div className="space-y-2">
                {sortedHistory.slice(0, 5).map((h) => {
                  const hCfg = STAGE_CONFIG[h.stage];
                  return (
                    <div key={h.id} className="flex items-start gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0",
                          hCfg.pill
                        )}
                      >
                        {hCfg.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        {h.amount != null && (
                          <span className="text-xs text-muted-foreground">{fmt$(h.amount)}</span>
                        )}
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {fmtDate(h.changed_at)}
                          {h.changed_by && ` · ${h.changed_by}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {sortedHistory.length > 5 && (
                  <button className="text-xs text-[#6B7EFF] hover:underline mt-1">
                    View all ({sortedHistory.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* AI Sales Assistant */}
          <div className="bg-[#6B7EFF]/5 rounded-xl border border-[#6B7EFF]/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-[#6B7EFF]" />
              <h3 className="text-sm font-semibold text-[#6B7EFF]">AI Sales Assistant</h3>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{aiTip.tip}</p>
            {aiTip.showAria && (
              <Link
                href="/aria"
                className="inline-flex items-center gap-1 mt-3 text-xs text-[#6B7EFF] hover:underline font-medium"
              >
                Run ARIA Research →
                <ExternalLink size={10} />
              </Link>
            )}
          </div>

          {/* Quotes Panel */}
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText size={14} className="text-[#6B7EFF]" />
                Quotes
                {oppQuotes.length > 0 && (
                  <span className="text-[11px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium ml-0.5">{oppQuotes.length}</span>
                )}
              </h3>
              <button
                onClick={handleCreateQuote}
                disabled={quoteCreating}
                className="text-[11px] font-medium text-[#6B7EFF] hover:text-indigo-700 disabled:opacity-50"
              >
                {quoteCreating ? 'Creating…' : '+ New'}
              </button>
            </div>

            {!quotesLoaded ? (
              <div className="text-xs text-muted-foreground italic py-2">Loading…</div>
            ) : oppQuotes.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground italic mb-2">No quotes yet</p>
                <button
                  onClick={handleCreateQuote}
                  disabled={quoteCreating}
                  className="text-xs font-medium text-[#6B7EFF] hover:underline disabled:opacity-50"
                >
                  {quoteCreating ? 'Creating…' : '+ Create first quote →'}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {oppQuotes.map(q => {
                  const statusColors: Record<string, string> = {
                    draft:    'bg-gray-100 text-gray-600',
                    sent:     'bg-blue-100 text-blue-700',
                    accepted: 'bg-emerald-100 text-emerald-700',
                    declined: 'bg-red-100 text-red-600',
                    expired:  'bg-amber-100 text-amber-700',
                  };
                  return (
                    <Link
                      key={q.id}
                      href={`/quotes/${q.id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors group border border-transparent hover:border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-semibold text-[#6B7EFF]">{q.quote_number}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${statusColors[q.status] ?? 'bg-gray-100 text-gray-600'}`}>{q.status}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          ${(q.total_one_time ?? 0).toLocaleString()} one-time
                          {(q.total_mrr ?? 0) > 0 && <span className="ml-1">· ${q.total_mrr}/mo</span>}
                        </p>
                      </div>
                      <ExternalLink size={11} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="border-t border-border mt-3 pt-2.5 space-y-1.5">

              <Link
                href={`/survey?opportunity_id=${id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                <Wrench size={14} className="text-[#6B7EFF]" />
                <span className="text-foreground">Site Survey</span>
                <ExternalLink size={11} className="text-muted-foreground ml-auto" />
              </Link>

              <Link
                href={`/quotes/new?opportunity_id=${id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                <FileText size={14} className="text-[#6B7EFF]" />
                <span className="text-foreground">New Quote</span>
                <ExternalLink size={11} className="text-muted-foreground ml-auto" />
              </Link>

              {opp.stage === "won" ? (
                <>
                  <Link
                    href="/maintenance"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
                  >
                    <ClipboardList size={14} className="text-[#6B7EFF]" />
                    <span className="text-foreground">Work Order</span>
                    <ExternalLink size={11} className="text-muted-foreground ml-auto" />
                  </Link>
                  {opp.site_id ? (
                    <Link
                      href={`/sites/${opp.site_id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
                    >
                      <MapPin size={14} className="text-emerald-600" />
                      <span className="text-foreground">View Property</span>
                      <ExternalLink size={11} className="text-muted-foreground ml-auto" />
                    </Link>
                  ) : (
                    <button
                      onClick={() => setShowCreateProperty(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-emerald-50 transition-colors text-sm w-full text-left"
                    >
                      <MapPin size={14} className="text-emerald-600" />
                      <span className="text-emerald-700 font-medium">Create Property</span>
                      <Plus size={11} className="text-emerald-500 ml-auto" />
                    </button>
                  )}
                </>
              ) : (
                <div
                  title="Available after Closed Won"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm opacity-50 cursor-not-allowed"
                >
                  <ClipboardList size={14} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Work Order</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">Won only</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── DOCUMENTS TAB — full-width below tabs ───────────────────────── */}
      {activeTab === "documents" && (
        <div className="px-6 py-4 space-y-4 max-w-4xl mx-auto">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Documents</h2>
              <p className="text-xs text-muted-foreground mt-0.5">All agreements sent, signed, and executed for this record.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setUploadError(null);
                  // Pre-fill signer from opportunity contact
                  const contact = opp?.site_contact_name ?? opp?.account_name ?? '';
                  const email   = opp?.site_contact_email ?? '';
                  setUploadForm(f => ({ ...f, signer_name: contact, signer_email: email }));
                  setShowUploadExec(true);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} />
                Upload Executed
              </button>
              {opp.opportunity_type && OPP_DOCS[opp.opportunity_type] && (
                <button
                  onClick={() => {
                    const docs = OPP_DOCS[opp.opportunity_type!] ?? [];
                    const first = docs[0];
                    if (first) openSendDoc(first.value, first.advanceStage);
                    setActiveTab('details');
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#6B7EFF] bg-[#6B7EFF]/10 hover:bg-[#6B7EFF]/15 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FileText size={13} />
                  Send New Document
                </button>
              )}
            </div>
          </div>

          {/* Document list */}
          {docSigsLoading ? (
            <div className="text-xs text-muted-foreground py-8 text-center">Loading documents…</div>
          ) : docSigs.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-8 text-center">
              <FileText size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No documents yet</p>
              <p className="text-xs text-muted-foreground">Send an NDA or agreement to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {docSigs.map(sig => {
                const isNeedingCountersig  = sig.status === 'counterparty_signed';
                const isFullyExecuted      = sig.status === 'fully_executed';
                const isPending            = sig.status === 'pending';
                const isCountersigning     = countersignId === sig.id;
                const docLabel = DOC_TYPE_LABELS[sig.document_type] ?? sig.document_type;

                return (
                  <div key={sig.id} className={cn(
                    "bg-white border rounded-xl p-4",
                    isNeedingCountersig ? "border-amber-300 ring-1 ring-amber-200" : "border-border"
                  )}>
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                        isFullyExecuted   ? "bg-emerald-50" :
                        isNeedingCountersig ? "bg-amber-50" : "bg-slate-50"
                      )}>
                        <FileText size={16} className={
                          isFullyExecuted   ? "text-emerald-600" :
                          isNeedingCountersig ? "text-amber-600" : "text-slate-400"
                        } />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{docLabel}</span>
                          {sig.document_version && (
                            <span className="text-[10px] text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">{sig.document_version}</span>
                          )}
                          {/* Status badge */}
                          {isFullyExecuted && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Fully Executed</span>
                          )}
                          {isNeedingCountersig && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">⚡ Needs Your Signature</span>
                          )}
                          {isPending && (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">Awaiting Counterparty</span>
                          )}
                          {sig.status === 'expired' && (
                            <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Expired</span>
                          )}
                        </div>
                        {/* Parties */}
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span><span className="text-slate-400">Sent to</span> <span className="text-foreground">{sig.signer_name ?? sig.signer_email}</span>{sig.signer_company ? ` · ${sig.signer_company}` : ''}</span>
                          </div>
                          {sig.signed_name && (
                            <div className="text-xs text-muted-foreground">
                              <span className="text-slate-400">Signed</span> <span className="text-foreground">{sig.signed_name}</span>
                              {sig.signed_at && <span className="text-slate-400 ml-1">· {new Date(sig.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                            </div>
                          )}
                          {sig.countersigned_name && (
                            <div className="text-xs text-muted-foreground">
                              <span className="text-slate-400">Countersigned</span> <span className="text-foreground">{sig.countersigned_name} · GateGuard</span>
                              {sig.countersigned_at && <span className="text-slate-400 ml-1">· {new Date(sig.countersigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {sig.document_url && (
                          <a href={sig.document_url} target="_blank" rel="noopener noreferrer"
                             className="text-xs text-[#6B7EFF] hover:underline flex items-center gap-1">
                            <ExternalLink size={11} />View
                          </a>
                        )}
                        {isNeedingCountersig && (
                          <button
                            onClick={() => setCountersignId(isCountersigning ? null : sig.id)}
                            className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            ✍️ Sign Now
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Countersign inline form */}
                    {isCountersigning && (
                      <div className="mt-4 pt-4 border-t border-amber-200 space-y-3">
                        <p className="text-xs font-semibold text-amber-700">Your countersignature — GateGuard</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Your Full Name *</label>
                            <input
                              type="text"
                              value={countersignName}
                              onChange={e => setCountersignName(e.target.value)}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Your Title</label>
                            <input
                              type="text"
                              value={countersignTitle}
                              onChange={e => setCountersignTitle(e.target.value)}
                              className={inputCls}
                            />
                          </div>
                        </div>
                        {/* Signature preview */}
                        {countersignName.trim() && (
                          <div className="bg-slate-50 border border-border rounded-lg px-4 py-3">
                            <p className="text-xs text-slate-400 mb-1">Your signature:</p>
                            <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 22 }} className="text-foreground">{countersignName}</p>
                            <p className="text-xs text-slate-400 mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Electronic Signature · GateGuard</p>
                          </div>
                        )}
                        <label className="flex gap-2 items-start cursor-pointer">
                          <input type="checkbox" id={`agree-${sig.id}`} className="mt-0.5 accent-[#6B7EFF]" />
                          <span className="text-xs text-muted-foreground leading-relaxed">
                            By signing, I confirm GateGuard&apos;s agreement to the terms of the <strong className="text-foreground">{docLabel}</strong>. This constitutes a legally binding electronic signature under the ESIGN Act &amp; UETA.
                          </span>
                        </label>
                        {countersignError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{countersignError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={handleCountersign}
                            disabled={countersigning || !countersignName.trim()}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {countersigning ? 'Signing…' : `✍️ Countersign & Fully Execute →`}
                          </button>
                          <button
                            onClick={() => { setCountersignId(null); setCountersignError(null); }}
                            className="px-3 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TASKS TAB ──────────────────────────────────────────────────── */}
      {activeTab === "tasks" && id && (
        <div className="px-6 py-4">
          <TrackerBoard entityType="opportunity" entityId={id} />
        </div>
      )}

      {/* ── Create Property Slide-Over ───────────────────────────────────── */}
      {showCreateProperty && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowCreateProperty(false)} />
          <div className="fixed inset-y-0 right-0 w-[440px] bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Create Property</h2>
                <p className="text-xs text-slate-400 mt-0.5">Pre-filled from this opportunity. Adjust as needed.</p>
              </div>
              <button onClick={() => setShowCreateProperty(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X size={14} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {[
                { label: "Property Name *", key: "name", placeholder: "e.g. Stonegate Townhomes" },
                { label: "Street Address",  key: "address", placeholder: "123 Main St" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                  <input
                    value={(createPropForm as Record<string, string>)[key]}
                    onChange={e => setCreatePropForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "City",  key: "city",  placeholder: "Atlanta" },
                  { label: "State", key: "state", placeholder: "GA" },
                  { label: "ZIP",   key: "zip",   placeholder: "30301" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                    <input
                      value={(createPropForm as Record<string, string>)[key]}
                      onChange={e => setCreatePropForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Property Type</label>
                  <select
                    value={createPropForm.property_type}
                    onChange={e => setCreatePropForm(f => ({ ...f, property_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none"
                  >
                    {["Multifamily", "HOA", "Mixed-Use", "Commercial", "Single-Family"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Units</label>
                  <input
                    type="number"
                    value={createPropForm.units}
                    onChange={e => setCreatePropForm(f => ({ ...f, units: e.target.value }))}
                    placeholder="e.g. 120"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">Property Manager</p>
              {[
                { label: "PM Name",  key: "pm_name",  placeholder: "Jane Smith" },
                { label: "PM Email", key: "pm_email", placeholder: "jane@property.com" },
                { label: "PM Phone", key: "pm_phone", placeholder: "(555) 000-0000" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                  <input
                    value={(createPropForm as Record<string, string>)[key]}
                    onChange={e => setCreatePropForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Access Notes</label>
                <textarea
                  value={createPropForm.access_notes}
                  onChange={e => setCreatePropForm(f => ({ ...f, access_notes: e.target.value }))}
                  rows={3}
                  placeholder="Gate codes, parking, key pickup…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                />
              </div>
              {createPropError && (
                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">
                  <AlertCircle size={13} /> {createPropError}
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 p-4 flex gap-3">
              <button type="button" onClick={() => setShowCreateProperty(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateProperty} disabled={createPropSaving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {createPropSaving ? "Creating…" : "Create Property →"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Upload Executed Document Modal ─────────────────────────────── */}
      {showUploadExec && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowUploadExec(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-h-[90vh] bg-white border border-border rounded-2xl shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-foreground">Upload Executed Document</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Record a document signed outside the portal — their NDA, DocuSign, wet signature, etc.</p>
              </div>
              <button onClick={() => setShowUploadExec(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={14} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {/* Source toggle */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">What was signed?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'uploaded', label: 'Our Document',   desc: 'Signed outside portal (DocuSign, email, wet sig)' },
                    { value: 'their_nda', label: 'Their Document', desc: "They sent their own NDA or agreement" },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setUploadForm(f => ({ ...f, source: opt.value }))}
                      className={cn(
                        "text-left p-3 rounded-xl border transition-all",
                        uploadForm.source === opt.value
                          ? "border-[#6B7EFF] bg-[#6B7EFF]/8 ring-1 ring-[#6B7EFF]/30"
                          : "border-border hover:bg-accent/40"
                      )}>
                      <p className={cn("text-xs font-semibold mb-0.5", uploadForm.source === opt.value ? "text-[#6B7EFF]" : "text-foreground")}>{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Document type */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Document Type</label>
                <select value={uploadForm.document_type}
                  onChange={e => setUploadForm(f => ({ ...f, document_type: e.target.value }))}
                  className={inputCls}>
                  {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                  <option value="other">Other / Custom</option>
                </select>
              </div>

              {/* PDF file */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Executed PDF <span className="font-normal normal-case">(optional — attach for your records)</span></label>
                <input ref={uploadFileRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
                <button onClick={() => uploadFileRef.current?.click()}
                  className={cn(
                    "w-full border-2 border-dashed rounded-xl p-4 text-sm text-center transition-colors",
                    uploadFile ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-border hover:border-[#6B7EFF]/40 text-muted-foreground"
                  )}>
                  {uploadFile ? (
                    <span className="flex items-center justify-center gap-2"><Check size={14} /> {uploadFile.name}</span>
                  ) : (
                    <span>Click to select PDF</span>
                  )}
                </button>
                {uploadFile && (
                  <button onClick={() => setUploadFile(null)} className="mt-1 text-[10px] text-red-500 hover:underline">Remove file</button>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Counterparty (their side)</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Full Name *</label>
                      <input type="text" placeholder="Jane Smith" value={uploadForm.signer_name}
                        onChange={e => setUploadForm(f => ({ ...f, signer_name: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Email *</label>
                      <input type="email" placeholder="jane@company.com" value={uploadForm.signer_email}
                        onChange={e => setUploadForm(f => ({ ...f, signer_email: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Title</label>
                      <input type="text" placeholder="CEO" value={uploadForm.signer_title}
                        onChange={e => setUploadForm(f => ({ ...f, signer_title: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Company</label>
                      <input type="text" placeholder="ACME Corp" value={uploadForm.signer_company}
                        onChange={e => setUploadForm(f => ({ ...f, signer_company: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Date Signed</label>
                    <input type="date" value={uploadForm.signed_at}
                      onChange={e => setUploadForm(f => ({ ...f, signed_at: e.target.value }))} className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">GateGuard (our side)</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Your Name</label>
                      <input type="text" value={uploadForm.countersigned_name}
                        onChange={e => setUploadForm(f => ({ ...f, countersigned_name: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Your Title</label>
                      <input type="text" value={uploadForm.countersigned_title}
                        onChange={e => setUploadForm(f => ({ ...f, countersigned_title: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Date Signed by GateGuard</label>
                    <input type="date" value={uploadForm.countersigned_at}
                      onChange={e => setUploadForm(f => ({ ...f, countersigned_at: e.target.value }))} className={inputCls} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Internal Notes (optional)</label>
                <textarea rows={2} placeholder="e.g. Partner insisted on their own NDA, reviewed by Russel 5/18/26"
                  value={uploadForm.notes} onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
                  className={cn(inputCls, "resize-none")} />
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-4 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowUploadExec(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button
                onClick={handleUploadExec}
                disabled={uploading || !uploadForm.signer_name.trim() || !uploadForm.signer_email.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <Check size={14} />
                {uploading ? 'Saving…' : 'Save as Fully Executed'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Slide-Over ────────────────────────────────────────────── */}
      {showEdit && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowEdit(false)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-border shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">Edit Opportunity</h2>
              <button
                onClick={() => setShowEdit(false)}
                className="p-1 hover:bg-accent rounded text-muted-foreground"
              >
                <X size={16} />
              </button>
            </div>
            {/* Fields */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="pb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opportunity</p>
              </div>
              <Field label="Opportunity Name">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Ashford Glen — Phase 2"
                />
              </Field>
              <Field label="Account Name">
                <input
                  type="text"
                  value={editForm.account_name}
                  onChange={e => setEditForm({ ...editForm, account_name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Ashford Glen"
                />
              </Field>
              {/* Linked Customer Org */}
              <Field label="Linked Customer">
                <OrgSearch
                  value={editForm.related_org_id}
                  displayName={editForm.related_org_name || (opp?.related_org_id ? opp.account_name : "")}
                  onChange={(id, name) => setEditForm(f => ({ ...f, related_org_id: id, related_org_name: name }))}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Links quotes from this opportunity to the customer record</p>
              </Field>

              {/* Contact & Property */}
              <div className="pt-2 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contact & Property</p>
              </div>
              <Field label="Site Contact Name">
                <input type="text" value={editForm.site_contact_name} onChange={e => setEditForm({...editForm, site_contact_name: e.target.value})} className={inputCls} placeholder="e.g. Jane Smith" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact Email">
                  <input type="text" inputMode="email" autoComplete="email" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={editForm.site_contact_email} onChange={e => setEditForm({...editForm, site_contact_email: e.target.value})} className={inputCls} placeholder="jane@example.com" />
                </Field>
                <Field label="Contact Phone">
                  <input type="tel" value={editForm.site_contact_phone} onChange={e => setEditForm({...editForm, site_contact_phone: e.target.value})} className={inputCls} placeholder="(404) 555-1234" />
                </Field>
              </div>
              <Field label="Street Address">
                <input type="text" value={editForm.property_address} onChange={e => setEditForm({...editForm, property_address: e.target.value})} className={inputCls} placeholder="123 Main St" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City">
                  <input type="text" value={editForm.property_city} onChange={e => setEditForm({...editForm, property_city: e.target.value})} className={inputCls} placeholder="Atlanta" />
                </Field>
                <Field label="State">
                  <input type="text" value={editForm.property_state} onChange={e => setEditForm({...editForm, property_state: e.target.value})} className={inputCls} placeholder="GA" maxLength={2} />
                </Field>
                <Field label="ZIP">
                  <input type="text" value={editForm.property_zip ?? ''} onChange={e => setEditForm({...editForm, property_zip: e.target.value})} className={inputCls} placeholder="30301" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Units">
                  <input type="number" value={editForm.units} onChange={e => setEditForm({...editForm, units: e.target.value})} className={inputCls} placeholder="0" min={0} />
                </Field>
                <Field label="Source">
                  <input type="text" value={editForm.source} onChange={e => setEditForm({...editForm, source: e.target.value})} className={inputCls} placeholder="e.g. referral" />
                </Field>
              </div>
              <Field label="Est. MRR ($/mo)">
                <input type="number" value={editForm.est_mrr} onChange={e => setEditForm({...editForm, est_mrr: e.target.value})} className={inputCls} placeholder="0" min={0} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount ($)">
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                    className={inputCls}
                    placeholder="0"
                    min={0}
                  />
                </Field>
                <Field label="Probability (%)">
                  <input
                    type="number"
                    value={editForm.probability}
                    onChange={e => setEditForm({ ...editForm, probability: e.target.value })}
                    className={inputCls}
                    placeholder="0–100"
                    min={0}
                    max={100}
                  />
                </Field>
              </div>
              <Field label="Close Date">
                <input
                  type="date"
                  value={editForm.close_date}
                  onChange={e => setEditForm({ ...editForm, close_date: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Stage">
                <select
                  value={editForm.stage}
                  onChange={e => setEditForm({ ...editForm, stage: e.target.value as Stage })}
                  className={inputCls}
                >
                  <option value="">Select stage…</option>
                  {(Object.keys(STAGE_CONFIG) as Stage[]).map(s => (
                    <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Opportunity Type">
                <select
                  value={editForm.opportunity_type}
                  onChange={e => setEditForm({ ...editForm, opportunity_type: e.target.value as OppType | "" })}
                  className={inputCls}
                >
                  <option value="">Select type…</option>
                  {(Object.keys(OPP_TYPE_LABELS) as OppType[]).map(t => (
                    <option key={t} value={t}>{OPP_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Forecast Category">
                <input
                  type="text"
                  value={editForm.forecast_cat}
                  onChange={e => setEditForm({ ...editForm, forecast_cat: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Commit, Best Case, Pipeline"
                />
              </Field>
              <Field label="Next Step">
                <input
                  type="text"
                  value={editForm.next_step}
                  onChange={e => setEditForm({ ...editForm, next_step: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Send proposal deck by Friday"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  className={cn(inputCls, "resize-none")}
                  placeholder="Additional context about this opportunity…"
                />
              </Field>
            </div>
            {/* Footer */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-border flex-shrink-0">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving || !editForm.name.trim()}
                className="flex-1 py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {editSaving && <RefreshCw size={13} className="animate-spin" />}
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-border shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Delete this opportunity?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  This cannot be undone. All associated contacts, activities, and stage history will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteOpp}
                disabled={deleting}
                className="flex-1 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleting && <RefreshCw size={13} className="animate-spin" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  value,
  className,
  fieldKey,
  type = "text",
  onSave,
}: {
  label: string;
  value?: string | null;
  className?: string;
  fieldKey?: string;
  type?: "text" | "number" | "email" | "tel" | "date" | "textarea";
  onSave?: (key: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value ?? ""); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    if (!fieldKey || !onSave) return;
    setSaving(true);
    try { await onSave(fieldKey, draft); } finally { setSaving(false); setEditing(false); }
  };

  const cancel = () => { setDraft(value ?? ""); setEditing(false); };

  const canEdit = !!fieldKey && !!onSave;

  return (
    <div className={cn("group", className)}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 font-medium">
        {label}
      </p>
      {editing ? (
        <div className="flex items-center gap-1">
          {type === "textarea" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") cancel(); }}
              rows={2}
              className="flex-1 px-2 py-1 text-sm bg-background border border-brand-400 rounded focus:outline-none resize-none"
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type === "email" ? "text" : type}
              inputMode={type === "email" ? "email" : undefined}
              autoComplete={type === "email" ? "email" : undefined}
              autoCorrect={type === "email" ? "off" : undefined}
              autoCapitalize={type === "email" ? "none" : undefined}
              spellCheck={type === "email" ? false : undefined}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
              className="flex-1 px-2 py-1 text-sm bg-background border border-brand-400 rounded focus:outline-none"
            />
          )}
          <button onClick={commit} disabled={saving}
            className="p-1 text-emerald-500 hover:text-emerald-600 disabled:opacity-50">
            <Check size={13} />
          </button>
          <button onClick={cancel} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <p
            className={cn("text-sm text-foreground", canEdit && "cursor-pointer hover:text-[#6B7EFF] transition-colors")}
            onClick={canEdit ? () => setEditing(true) : undefined}
            title={canEdit ? "Click to edit" : undefined}
          >
            {value ?? "—"}
          </p>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="opacity-30 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-brand-400"
              title="Click to edit"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityToggleBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors",
        active
          ? "bg-[#6B7EFF] text-white border-[#6B7EFF]"
          : "border-border text-foreground hover:bg-accent"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ActivityFormCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#6B7EFF]/30 p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <button onClick={onClose} className="p-0.5 hover:bg-accent rounded text-muted-foreground">
          <X size={14} />
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Org live-search for linking an opportunity to a customer ─────────────────

function OrgSearch({ value, displayName, onChange }: {
  value:       string | null;
  displayName: string;
  onChange:    (id: string | null, name: string) => void;
}) {
  const [query, setQuery]     = useState(displayName || "");
  const [results, setResults] = useState<{ id: string; name: string; org_tier: string }[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(displayName || ""); }, [displayName]);

  function search(q: string) {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/customers?q=${encodeURIComponent(q)}&limit=8`);
        const j = await r.json();
        setResults((j.orgs ?? j.customers ?? []).map((o: { id: string; name: string; org_tier?: string }) => ({
          id: o.id, name: o.name, org_tier: o.org_tier ?? "",
        })));
        setOpen(true);
      } finally { setLoading(false); }
    }, 300);
  }

  const inputCls2 = "w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-white";

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <input
          className={inputCls2}
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="Search customers…"
        />
        {value && (
          <button type="button" onClick={() => { onChange(null, ""); setQuery(""); setResults([]); }}
            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg border border-border transition-colors">
            ✕
          </button>
        )}
      </div>
      {value && !open && (
        <p className="text-[11px] text-emerald-600 mt-1">✓ Linked to customer record</p>
      )}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
          {results.map(r => (
            <button key={r.id} type="button"
              onMouseDown={() => { onChange(r.id, r.name); setQuery(r.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
            >
              <span className="font-medium text-foreground">{r.name}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{r.org_tier?.replace("_", " ")}</span>
            </button>
          ))}
        </div>
      )}
      {loading && <p className="text-[11px] text-muted-foreground mt-1">Searching…</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-white";

// Suppress unused import warnings
void ChevronLeft;
