"use client";

import { useState, useEffect } from "react";

// Public booking page (no auth). Relocated from gateguard.co into the portal so all
// scheduling lives in Nexus and writes to the portal calendar + Google Calendar.
// Step 1: books the corporate sales calendar. Step 2 (later): route to nearest dealer.

type Meeting = { id: string; title: string; description: string; duration: string };

const MEETING_TYPES: Meeting[] = [
  { id: "intro", title: "Discovery Call", description: "A 30-minute introductory overview of the GateGuard system.", duration: "30 min" },
  { id: "lunch", title: "Lunch & Learn", description: "We evaluate your site, discuss solutions, and bring lunch for your team.", duration: "1 hr" },
  { id: "onsite", title: "On-Site Assessment", description: "A 2-hour on-site evaluation of your infrastructure and upgrade options.", duration: "2 hrs" },
];

// Next ~24 calendar days, weekdays only (the API enforces per-type day rules too).
function upcomingDates(count = 24) {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1); // start tomorrow
  for (let i = 0; i < count; i++) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const iso = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
const pretty = (d: Date) => d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

export default function SchedulePage() {
  const [step, setStep] = useState(1);
  const [meetingType, setMeetingType] = useState<Meeting | null>(null);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", zip: "" });
  const [times, setTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedHost, setBookedHost] = useState<{ name: string | null; routed: boolean } | null>(null);

  const dates = upcomingDates();
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York";

  useEffect(() => {
    if (!selectedISO || !meetingType || form.zip.length < 5) return;
    setLoadingTimes(true); setSelectedTime(null); setTimes([]);
    fetch("/api/schedule/availability", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedISO, meetingType, timezone: tz, zip: form.zip }),
    })
      .then(r => r.json())
      .then(d => setTimes(d.success ? (d.availableSlots ?? []) : []))
      .catch(() => setTimes([]))
      .finally(() => setLoadingTimes(false));
  }, [selectedISO, meetingType, form.zip]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/schedule/book", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingType, selectedDate: selectedISO, selectedTime, formData: form, timezone: tz }),
      });
      const d = await r.json();
      if (d.success) { setBookedHost({ name: d.host ?? null, routed: !!d.routedToDealer }); setStep(4); }
      else setError(d.error || "Booking failed.");
    } catch { setError("Couldn't reach the booking server."); }
    finally { setSubmitting(false); }
  }

  const card = "w-full text-left p-5 rounded-2xl border border-slate-700 bg-slate-800/40 hover:bg-slate-800 hover:border-cyan-500 transition-all";
  const selectedDateObj = dates.find(d => iso(d) === selectedISO) || null;

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-200 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-4xl w-full bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col md:flex-row">
        {/* Receipt */}
        <div className="bg-slate-950/50 p-8 md:p-10 md:w-2/5 border-b md:border-b-0 md:border-r border-slate-800">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-black">G</div>
            <h2 className="text-lg font-bold tracking-widest uppercase text-slate-400">GateGuard</h2>
          </div>
          <h1 className="text-3xl font-extralight text-white mb-8 leading-tight">
            {step === 1 && "How can we help?"}
            {step === 2 && "Choose a time."}
            {step === 3 && "Final details."}
            {step === 4 && "You're booked."}
          </h1>
          <div className="space-y-5 text-sm text-slate-400">
            {meetingType && (
              <div className="flex items-start gap-3">
                <span className="text-cyan-500 mt-0.5">●</span>
                <div><p className="font-semibold text-slate-200">{meetingType.title}</p><p>{meetingType.duration}</p></div>
              </div>
            )}
            {selectedTime && selectedDateObj && (
              <div className="flex items-start gap-3">
                <span className="text-cyan-500 mt-0.5">●</span>
                <div><p className="font-semibold text-slate-200">{pretty(selectedDateObj)}, {selectedDateObj.getFullYear()}</p><p>{selectedTime}</p></div>
              </div>
            )}
          </div>
        </div>

        {/* Engine */}
        <div className="p-8 md:p-10 md:w-3/5 min-h-[460px]">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-6">Select a meeting type</h3>
              {MEETING_TYPES.map(t => (
                <button key={t.id} className={card} onClick={() => { setMeetingType(t); setStep(2); }}>
                  <div className="flex justify-between items-start mb-1 gap-3">
                    <span className="font-semibold text-white text-lg">{t.title}</span>
                    <span className="text-[11px] font-mono bg-slate-700 text-slate-300 py-1 px-3 rounded-full whitespace-nowrap">{t.duration}</span>
                  </div>
                  <p className="text-sm text-slate-400">{t.description}</p>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-cyan-400 mb-5">‹ Back</button>
              <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-2">Your ZIP code</h3>
              <p className="text-xs text-slate-500 mb-3">So we can match you with your local GateGuard dealer.</p>
              <input
                inputMode="numeric" maxLength={5} placeholder="e.g. 30305" value={form.zip}
                onChange={e => setForm({ ...form, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                className="w-40 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 mb-6"
              />
              {form.zip.length < 5 ? (
                <p className="text-xs text-slate-600">Enter your ZIP to see available days.</p>
              ) : (<>
              <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-4">Pick a day</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
                {dates.map(d => {
                  const v = iso(d);
                  return (
                    <button key={v} onClick={() => setSelectedISO(v)}
                      className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-all ${selectedISO === v ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-800/40 border-slate-700 text-slate-300 hover:border-cyan-500"}`}>
                      {pretty(d)}
                    </button>
                  );
                })}
              </div>
              {selectedISO && (
                <>
                  <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500 mb-3">Available times</h3>
                  {loadingTimes ? <p className="text-sm text-slate-500">Loading times…</p>
                    : times.length === 0 ? <p className="text-sm text-slate-500">No open times that day — try another.</p>
                    : <div className="grid grid-cols-3 gap-2">
                        {times.map(t => (
                          <button key={t} onClick={() => { setSelectedTime(t); setStep(3); }}
                            className="px-2 py-2 rounded-lg text-sm font-semibold border border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-cyan-600 hover:border-cyan-500 hover:text-white transition-all">
                            {t}
                          </button>
                        ))}
                      </div>}
                </>
              )}
              </>)}
            </div>
          )}

          {step === 3 && (
            <form onSubmit={submit} className="space-y-4">
              <button type="button" onClick={() => setStep(2)} className="text-xs text-slate-500 hover:text-cyan-400 mb-2">‹ Back</button>
              <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500">Your details</h3>
              {["name", "company"].map(f => (
                <input key={f} required={f === "name"} placeholder={f === "name" ? "Full name" : "Company"} value={(form as never)[f]}
                  onChange={e => setForm({ ...form, [f]: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
              ))}
              <input required type="email" placeholder="Email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
              {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" disabled={submitting}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-widest py-3 rounded-xl transition-all disabled:opacity-50">
                {submitting ? "Booking…" : "Confirm booking"}
              </button>
            </form>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center text-center h-full py-10">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl mb-5">✓</div>
              <h3 className="text-2xl font-bold text-white mb-2">You're booked!</h3>
              <p className="text-slate-400 text-sm max-w-xs">A calendar invite is on its way to {form.email}. We'll see you {selectedDateObj ? pretty(selectedDateObj) : ""} at {selectedTime}.</p>
              {bookedHost?.routed && bookedHost.name && (
                <p className="text-cyan-400 text-sm mt-3 font-semibold">Your local dealer, {bookedHost.name}, will be in touch.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
