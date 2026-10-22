"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, CreditCard, Download, Flower2, Heart, Loader2, MapPin, Scissors, ShieldCheck, Sparkles, UserRound } from "lucide-react";

type Service = { id: string; name: string; category: string; description: string; duration: number; price: number; image: string; staffIds: string[] };
type Staff = { id: string; name: string; role: string; specialties: string[] | string; image: string };
type Slot = { startAt: string; endAt: string; label: string; staffId: string; staffName: string };
type User = { id: string; name: string; email: string; role: string };
type Booking = { id: string; reference: string; serviceName: string; staffName: string; startAt: string; endAt: string; price: number; status: string };
type Catalog = { services: Service[]; staff: Staff[]; salon: { name: string; timezone: string; address: string; phone: string; email: string } };
type BookingDraft = { savedAt: number; serviceId: string; staffId: string; date: string; slot: Slot; note: string };

const draftKey = "bookwise-booking-draft";
function clearDraft() { try { sessionStorage.removeItem(draftKey); } catch { /* Booking remains usable when storage is unavailable. */ } }
function readDraft(): BookingDraft | null {
  try {
    const value = sessionStorage.getItem(draftKey);
    if (!value) return null;
    const draft = JSON.parse(value) as BookingDraft;
    if (typeof draft.savedAt !== "number" || draft.savedAt > Date.now() || Date.now() - draft.savedAt > 30 * 60 * 1000 || typeof draft.serviceId !== "string" || typeof draft.staffId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !draft.slot || typeof draft.slot.startAt !== "string" || typeof draft.slot.staffId !== "string" || typeof draft.note !== "string") { clearDraft(); return null; }
    return { ...draft, note: draft.note.slice(0, 1000) };
  } catch { clearDraft(); return null; }
}
const money = (value: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);
const steps = ["Your treatment", "Your stylist", "Date & time", "Make it yours"];
const tz = "Asia/Karachi";
function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)?.value).join("-");
}
function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function readableDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
}
function humanTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
}

export default function BookingFlow() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(() => addDays(localDate(), 1));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [category, setCategory] = useState("All treatments");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [slotAttempt, setSlotAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setFetchError("");
    setLoaded(false);
    Promise.all([
      fetch("/api/catalog").then(async response => { if (!response.ok) throw new Error("We couldn’t load the salon menu. Please try again."); return response.json(); }),
      fetch("/api/auth/me").then(response => response.json()).catch(() => ({ user: null })),
    ]).then(async ([data, auth]) => {
      if (!active) return;
      setCatalog(data);
      setUser(auth.user);
      const requestedService = new URLSearchParams(window.location.search).get("service");
      if (requestedService && data.services.some((item: Service) => item.id === requestedService)) { setServiceId(requestedService); setStep(1); }
      const draft = readDraft();
      if (!auth.user || !draft || draft.serviceId !== requestedService) return;
      const draftService = data.services.find((item: Service) => item.id === draft.serviceId);
      if (!draftService || !draftService.staffIds.includes(draft.slot.staffId)) { clearDraft(); return; }
      setServiceId(draft.serviceId); setStaffId(draft.staffId); setDate(draft.date); setNote(draft.note);
      // A saved choice is only a draft: the server must still offer the exact
      // stylist and time before we return a signed-in customer to the review.
      try {
        const query = new URLSearchParams({ serviceId: draft.serviceId, staffId: draft.slot.staffId, date: draft.date });
        const response = await fetch(`/api/slots?${query}`, { cache: "no-store" });
        const availability = await response.json();
        if (!active) return;
        const freshSlot = response.ok ? availability.slots?.find((item: Slot) => item.startAt === draft.slot.startAt && item.staffId === draft.slot.staffId) : null;
        if (freshSlot) { setSlot(freshSlot); setStep(3); }
        else { setSlot(null); setStep(2); clearDraft(); setError("Welcome back. Your earlier time is no longer available. Please choose a new moment below."); }
      } catch {
        if (!active) return;
        setSlot(null); setStep(2); setError("We saved your treatment and note, but couldn’t recheck your earlier time. Please choose an available time below.");
      }
    }).catch(err => { if (active) setFetchError(err.message); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [catalogAttempt]);

  useEffect(() => {
    if (!serviceId || step < 2) return;
    const controller = new AbortController();
    setSlotsLoading(true);
    setSlotsError("");
    setSlots([]);
    const query = new URLSearchParams({ serviceId, staffId, date });
    fetch(`/api/slots?${query}`, { signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "We couldn’t check availability. Please try again.");
      return body;
    }).then(data => setSlots(data.slots)).catch(err => { if (err.name !== "AbortError") setSlotsError(err.message); }).finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [serviceId, staffId, date, step, slotAttempt]);

  const service = catalog?.services.find(item => item.id === serviceId);
  const stylist = catalog?.staff.find(item => item.id === staffId);
  const availableStaff = catalog?.staff.filter(item => !service?.staffIds?.length || service.staffIds.includes(item.id)) || [];
  const categories = ["All treatments", ...new Set(catalog?.services.map(item => item.category) || [])];
  const visibleServices = catalog?.services.filter(item => category === "All treatments" || item.category === category) || [];
  const today = localDate();
  const dateDays = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const valid = step === 0 ? !!service : step === 1 ? !!staffId : step === 2 ? !!slot : true;

  function selectService(value: string) { setServiceId(value); setStaffId("any"); setSlot(null); setError(""); }
  function selectStaff(value: string) { setStaffId(value); setSlot(null); setError(""); }
  function selectDate(value: string) { setDate(value); setSlot(null); setError(""); }
  function saveDraft() {
    if (!slot || !service) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), serviceId, staffId, date, slot, note } satisfies BookingDraft)); }
    catch { /* Signing in still works in browsers that block session storage. */ }
  }

  async function confirmBooking() {
    if (!service || !slot) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, staffId: slot.staffId, startAt: slot.startAt, note }) });
      const data = await response.json();
      if (response.status === 401) { setUser(null); throw new Error("Please sign in before confirming your appointment."); }
      if (!response.ok) {
        if (response.status === 409) { setSlot(null); setStep(2); setSlotAttempt(value => value + 1); }
        throw new Error(data.error || "Your appointment couldn’t be saved. Please try again.");
      }
      clearDraft();
      setBooking(data.booking);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { setSubmitting(false); }
  }

  if (booking) return (
    <div className="bw-booking-page">
      <div className="bw-confirmation">
        <div className="bw-success-icon"><Check size={32} /></div>
        <p className="eyebrow">A little something to look forward to</p>
        <h1>You’re on the calendar.</h1>
        <p className="bw-confirmation-intro">Your appointment is confirmed. We can’t wait to see you.</p>
        <div className="bw-receipt">
          <div className="bw-receipt-heading"><span>BOOKING REFERENCE</span><strong>{booking.reference}</strong><span className="bw-confirmed"><CheckCircle2 size={14} /> {booking.status}</span></div>
          <h2>{booking.serviceName || service?.name}</h2>
          <div className="bw-receipt-row"><CalendarDays size={18} /><div><strong>{readableDate(booking.startAt)}</strong><span>{humanTime(booking.startAt)} – {humanTime(booking.endAt)} · Pakistan time</span></div></div>
          <div className="bw-receipt-row"><UserRound size={18} /><div><strong>{booking.staffName || slot?.staffName}</strong><span>Your beauty expert</span></div></div>
          <div className="bw-receipt-row"><MapPin size={18} /><div><strong>{catalog?.salon.name || "BookWise Studio"}</strong><span>{catalog?.salon.address}</span></div></div>
          <div className="bw-receipt-total"><span>Pay at the salon</span><strong>{money(booking.price)}</strong></div>
        </div>
        <div className="bw-confirmation-actions"><Link href="/account" className="button button-primary">View my appointments <ArrowRight size={17} /></Link><a href={`/api/bookings/${booking.id}/calendar`} className="button button-secondary"><Download size={17} /> Add to calendar</a></div>
        <p className="bw-fine-print">Need to make a change? Manage your appointment in your account. Changes and cancellations require at least two hours’ notice.</p>
      </div>
    </div>
  );

  return (
    <div className="bw-booking-page">
      <div className="page-shell bw-booking-shell">
        <div className="bw-booking-intro"><p className="eyebrow"><Sparkles size={14} /> A moment, just for you</p><h1>Make time for <em>yourself.</em></h1><p>Your next feel-good moment is a few little steps away.</p></div>
        <ol className="bw-steps" aria-label="Booking progress">{steps.map((label, index) => <li key={label} className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} aria-current={index === step ? "step" : undefined}><button disabled={index > step} onClick={() => { setStep(index); setError(""); }}><span className="bw-step-number">{index < step ? <Check size={15} /> : index + 1}</span><span>{label}</span></button>{index < steps.length - 1 && <ChevronRight size={15} className="bw-step-chevron" />}</li>)}</ol>
        {!loaded ? <div className="bw-loading" role="status"><Loader2 className="bw-spin" size={25} /><p>Getting everything ready for you…</p></div> : fetchError ? <div className="bw-error-state"><p role="alert">{fetchError}</p><button className="button button-primary" onClick={() => setCatalogAttempt(value => value + 1)}>Try again</button></div> : (
          <div className="bw-booking-layout">
            <section className="bw-booking-content" aria-labelledby="bw-step-heading">
              <div className="bw-step-title"><span className="bw-kicker">STEP 0{step + 1}</span><h2 id="bw-step-heading">{["What feels good today?", "You’re in good hands.", "Find your perfect moment.", "Your little moment of me-time."][step]}</h2><p>{["Explore our menu and choose a little something for you.", "Choose your favourite expert, or let us find your perfect match.", "Live availability, made simple. All times are in Pakistan time (PKT).", "Take one last look. Good things are just around the corner."][step]}</p></div>

              {step === 0 && <><div className="bw-category-tabs" role="group" aria-label="Treatment categories">{categories.map(item => <button key={item} className={item === category ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="bw-treatment-list">{visibleServices.map(item => <button key={item.id} className={`bw-treatment-option ${serviceId === item.id ? "is-selected" : ""}`} onClick={() => selectService(item.id)} aria-pressed={serviceId === item.id}><span className="bw-treatment-icon">{item.category.toLowerCase().includes("hair") ? <Scissors size={21} /> : item.category.toLowerCase().includes("skin") ? <Flower2 size={21} /> : <Sparkles size={21} />}</span><span className="bw-treatment-info"><strong>{item.name}</strong><span>{item.description}</span><small><Clock3 size={12} /> {item.duration} min · {item.category}</small></span><span className="bw-treatment-price">{money(item.price)}<span className="bw-selection-circle">{serviceId === item.id && <Check size={13} />}</span></span></button>)}</div></>}

              {step === 1 && <div className="bw-staff-grid"><button className={`bw-staff-option bw-any-staff ${staffId === "any" ? "is-selected" : ""}`} onClick={() => selectStaff("any")} aria-pressed={staffId === "any"}><span className="bw-any-icon"><Heart size={28} /></span><h3>Any available expert</h3><p>A lovely experience with whoever’s available.</p><span className="bw-recommended">The earliest available time</span><span className="bw-selection-circle">{staffId === "any" && <Check size={13} />}</span></button>{availableStaff.map(item => <button key={item.id} className={`bw-staff-option ${staffId === item.id ? "is-selected" : ""}`} onClick={() => selectStaff(item.id)} aria-pressed={staffId === item.id}><img src={item.image || "/images/salon.jpg"} alt={item.name} width={96} height={96} /><h3>{item.name}</h3><p>{item.role}</p><small>{Array.isArray(item.specialties) ? item.specialties.join(" · ") : item.specialties}</small><span className="bw-selection-circle">{staffId === item.id && <Check size={13} />}</span></button>)}</div>}

              {step === 2 && <div className="bw-date-section"><div className="bw-date-heading"><h3>Choose a day</h3><label className="bw-custom-date"><CalendarDays size={15} /><input type="date" value={date} min={today} max={addDays(today, 60)} onChange={event => { if (event.target.value) selectDate(event.target.value); }} aria-label="Choose appointment date" /></label></div><div className="bw-date-strip">{dateDays.map(day => { const parsed = new Date(`${day}T12:00:00Z`); return <button key={day} onClick={() => selectDate(day)} className={date === day ? "is-selected" : ""} aria-pressed={date === day}><span>{parsed.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span><strong>{parsed.getUTCDate()}</strong><small>{day === today ? "Today" : parsed.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</small></button>; })}</div><div className="bw-time-heading"><h3>Available times</h3><span><span /> Live availability</span></div>{slotsLoading ? <div className="bw-slot-loading" role="status"><Loader2 size={20} className="bw-spin" /> Finding your next moment…</div> : slotsError ? <div className="bw-inline-error" role="alert">{slotsError}<button onClick={() => setSlotAttempt(value => value + 1)}>Try again</button></div> : slots.length === 0 ? <div className="bw-no-slots"><CalendarDays size={26} /><h4>A little too popular.</h4><p>There are no available appointments on this day. Try another date or choose any available expert.</p></div> : <div className="bw-time-grid">{slots.map(item => <button key={`${item.startAt}-${item.staffId}`} onClick={() => { setSlot(item); setError(""); }} className={slot?.startAt === item.startAt && slot?.staffId === item.staffId ? "is-selected" : ""} aria-pressed={slot?.startAt === item.startAt && slot?.staffId === item.staffId}>{item.label || humanTime(item.startAt)}{staffId === "any" && <small>{item.staffName}</small>}</button>)}</div>}<p className="bw-availability-note"><ShieldCheck size={15} /> We’ll check your time once more when you confirm.</p></div>}

              {step === 3 && <div className="bw-review"><div className="bw-review-treatment"><div className="bw-review-icon"><Sparkles size={24} /></div><div><span>YOUR CHOSEN TREATMENT</span><h3>{service?.name}</h3><p>{service?.duration} minutes of well-deserved you-time.</p></div></div><div className="bw-review-details"><div><CalendarDays size={20} /><span>Date & time<strong>{slot && readableDate(slot.startAt)}</strong><small>{slot && `${humanTime(slot.startAt)} – ${humanTime(slot.endAt)}`} · PKT</small></span><button onClick={() => setStep(2)}>Edit</button></div><div><UserRound size={20} /><span>Your beauty expert<strong>{slot?.staffName || stylist?.name}</strong></span><button onClick={() => setStep(1)}>Edit</button></div>{user && <div><Heart size={20} /><span>Booked for<strong>{user.name}</strong><small>{user.email}</small></span></div>}</div><label className="bw-note-label" htmlFor="appointment-note">Anything you’d like us to know? <span>(optional)</span></label><textarea id="appointment-note" placeholder="A style you’re dreaming of, sensitive skin, or anything that helps us care for you…" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={3} /><div className="bw-payment-note"><CreditCard size={21} /><div><strong>No payment needed now</strong><p>Pay at the salon after your treatment. Simple as that.</p></div></div>{!user && <div className="bw-login-notice"><h3>Let’s make it official.</h3><p>Sign in or create your free account to confirm and manage your appointment.</p><Link className="button button-primary" onClick={saveDraft} href={`/login?next=${encodeURIComponent(`/book?service=${serviceId}`)}`}>Sign in to book <ArrowRight size={16} /></Link></div>}<p className="bw-policy-note">By confirming, you agree to our <Link href="/policies">booking policy</Link>. Please allow two hours’ notice to cancel or reschedule.</p></div>}

              {error && <div className="bw-inline-error" role="alert">{error}</div>}
              <div className="bw-booking-navigation">{step > 0 ? <button className="bw-back-button" onClick={() => { setStep(value => value - 1); setError(""); }} disabled={submitting}><ArrowLeft size={16} /> Go back</button> : <Link href="/services" className="bw-back-button"><ArrowLeft size={16} /> View our menu</Link>}{step < 3 ? <button className="button button-primary" disabled={!valid} onClick={() => { setStep(value => value + 1); setError(""); }}>Continue <ArrowRight size={16} /></button> : <button className="button button-primary" disabled={submitting || !user || !slot} onClick={confirmBooking}>{submitting ? <><Loader2 size={17} className="bw-spin" /> Confirming…</> : <>Confirm appointment <Check size={17} /></>}</button>}</div>
            </section>

            <aside className="bw-booking-summary"><div className="bw-summary-card"><div className="bw-summary-top"><Flower2 size={23} /><span>Your feel-good plan</span></div><div className="bw-summary-photo"><img src="/images/salon.jpg" alt="A peaceful space at BookWise salon" width={400} height={220} /><span><MapPin size={13} /> {catalog?.salon.name || "BookWise Studio"}</span></div><div className="bw-summary-body">{service ? <><div className="bw-summary-service"><span>{service.category}</span><h3>{service.name}</h3><p><Clock3 size={14} /> {service.duration} minutes</p></div><div className="bw-summary-line"><UserRound size={17} /><span>{slot?.staffName || stylist?.name || "Any available expert"}</span></div>{slot ? <div className="bw-summary-line"><CalendarDays size={17} /><span>{readableDate(slot.startAt)}<small>{humanTime(slot.startAt)} · Pakistan time</small></span></div> : <div className="bw-summary-line bw-summary-placeholder"><CalendarDays size={17} /><span>Your perfect time is coming</span></div>}<div className="bw-summary-total"><span>Total<small>Pay at the salon</small></span><strong>{money(service.price)}</strong></div></> : <div className="bw-empty-summary"><Sparkles size={28} /><h3>A little self-care starts here.</h3><p>Choose a treatment and we’ll put your perfect visit together.</p></div>}<div className="bw-summary-assurance"><ShieldCheck size={15} /><span>Secure booking. A moment that’s yours.</span></div></div></div><div className="bw-help-note"><Heart size={17} /><p>Not sure what to choose?<br /><Link href="/contact">We’re happy to help.</Link></p></div></aside>
          </div>
        )}
      </div>
    </div>
  );
}
