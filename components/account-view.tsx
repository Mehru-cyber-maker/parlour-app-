"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, Download, LogOut, MapPin, Plus, RefreshCw, X } from "lucide-react";
import { useDialog } from "./use-dialog";

type User = { id: string; name: string; email: string; role: string };
type Booking = { id: string; reference: string; serviceId: string; serviceName: string; staffId: string; staffName: string; startAt: string; endAt: string; price: number; status: string; note?: string };
type Slot = { startAt: string; endAt: string; label: string; staffId: string; staffName: string };
const price = (amount: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);
const day = (date: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
const time = (date: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(date));
const tomorrow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000));

export default function AccountView() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<Booking | null>(null);
  const [date, setDate] = useState(tomorrow);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slotLoading, setSlotLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  useDialog(reschedule !== null, () => setReschedule(null), busy);

  async function load() {
    try {
      const response = await fetch("/api/bookings"); const data = await response.json();
      if (response.status === 401) { setUser(null); return; }
      if (!response.ok) throw new Error(data.error || "Couldn’t load your appointments.");
      setUser(data.user); setBookings(data.bookings || []);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Couldn’t load your appointments."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!reschedule || !date) return;
    const controller = new AbortController();
    setSlotLoading(true); setSlot(null); setSlots([]); setError("");
    const params = new URLSearchParams({ serviceId: reschedule.serviceId, staffId: reschedule.staffId, date, excludeBookingId: reschedule.id });
    fetch(`/api/slots?${params}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Couldn’t load times."); setSlots(data.slots || []);
    }).catch(issue => { if (issue.name !== "AbortError") setError(issue.message); }).finally(() => { if (!controller.signal.aborted) setSlotLoading(false); });
    return () => controller.abort();
  }, [reschedule, date]);

  async function mutate(id: string, action: "cancel" | "reschedule") {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/bookings/${id}${action === "cancel" ? "/cancel" : ""}`, { method: action === "cancel" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "cancel" ? {} : { staffId: slot?.staffId, startAt: slot?.startAt }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Couldn’t update this appointment.");
      setCancelId(null); setReschedule(null); setMessage(action === "cancel" ? "Your appointment has been cancelled." : "Your new appointment time is confirmed."); await load();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Couldn’t update this appointment."); }
    finally { setBusy(false); }
  }

  const active = (booking: Booking) => ["confirmed", "pending"].includes(booking.status) && new Date(booking.startAt).getTime() > Date.now();
  const filtered = bookings.filter(booking => tab === "upcoming" ? active(booking) : tab === "cancelled" ? booking.status === "cancelled" : !active(booking) && booking.status !== "cancelled");
  if (loading) return <div className="page-shell account-page"><div className="account-loading"><RefreshCw size={24} className="account-spin" /><p>Getting your appointments ready…</p></div></div>;
  if (!user) return <div className="page-shell account-page"><section className="account-empty"><CalendarDays size={40} /><h1>Your self-care, all in one place.</h1><p>Sign in to see and manage your appointments.</p>{error && <p role="alert" className="account-alert error">{error}</p>}<Link href="/login?next=/account" className="button button-primary">Sign in <ArrowRight size={17} /></Link></section></div>;

  return <div className="page-shell account-page">
    <div className="account-heading"><div><span className="eyebrow">YOUR BOOKWISE SPACE</span><h1>Hello, {user.name.split(" ")[0]}. <span className="account-wave">✦</span></h1><p className="account-muted">A little planning. A lot to look forward to.</p></div><div className="account-heading-actions">{user.role !== "customer" && <Link className="button button-secondary" href="/dashboard">Staff dashboard</Link>}<Link className="button button-primary" href="/book"><Plus size={17} /> Book an appointment</Link></div></div>
    {message && <p className="account-alert success" role="status"><Check size={17} />{message}</p>}
    {error && !reschedule && <p className="account-alert error" role="alert">{error}</p>}
    <div className="account-layout"><section className="appointments-main"><div className="account-section-top"><h2>My appointments</h2><span className="account-timezone">All times in Asia/Karachi</span></div><div className="account-tabs" role="tablist" aria-label="Appointment status">{["upcoming", "history", "cancelled"].map(value => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)} role="tab" aria-selected={tab === value}>{value === "upcoming" ? "Upcoming" : value === "history" ? "Past visits" : "Cancelled"}{value === "upcoming" && <span>{bookings.filter(active).length}</span>}</button>)}</div>
    {filtered.length === 0 ? <div className="account-empty account-empty-small"><CalendarDays size={34} /><h3>{tab === "upcoming" ? "Your next moment awaits." : tab === "history" ? "A fresh start to your story." : "No cancelled appointments."}</h3><p>{tab === "upcoming" ? "Make a little room for yourself. Find a service you’ll love." : "Your appointments will appear here."}</p>{tab === "upcoming" && <Link href="/services" className="button button-secondary">Explore services <ArrowRight size={16} /></Link>}</div> : <div className="appointment-list">{filtered.map(booking => <article className="appointment-card" key={booking.id}><div className="appointment-date"><span>{new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", month: "short" }).format(new Date(booking.startAt))}</span><strong>{new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", day: "2-digit" }).format(new Date(booking.startAt))}</strong><span>{new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", weekday: "short" }).format(new Date(booking.startAt))}</span></div><div className="appointment-content"><div className="appointment-title"><h3>{booking.serviceName}</h3><span className={`status-badge status-${booking.status}`}>{booking.status}</span></div><p>with {booking.staffName}</p><div className="appointment-meta"><span><Clock3 size={14} />{time(booking.startAt)} – {time(booking.endAt)}</span><span>{price(booking.price)} · Pay at salon</span></div><small className="booking-reference">{booking.reference}</small>{active(booking) && <div className="appointment-actions"><button onClick={() => { setReschedule(booking); setDate(tomorrow()); setError(""); }}><RefreshCw size={14} />Reschedule</button><a href={`/api/bookings/${booking.id}/calendar`}><Download size={14} /> Calendar</a><button className="account-danger" onClick={() => { setCancelId(booking.id); setError(""); }}>Cancel</button></div>}{cancelId === booking.id && <div className="cancel-confirm"><p>Cancel this appointment? Changes need at least 2 hours’ notice.</p><div><button className="button button-secondary" disabled={busy} onClick={() => setCancelId(null)}>Keep it</button><button className="button account-danger-button" disabled={busy} onClick={() => void mutate(booking.id, "cancel")}>{busy ? "Cancelling…" : "Yes, cancel"}</button></div></div>}</div></article>)}</div>}</section>
    <aside className="account-aside"><div className="account-profile"><div className="account-avatar">{user.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</div><h3>{user.name}</h3><p>{user.email}</p><span className="status-badge status-confirmed">{user.role} account</span><button className="account-signout" onClick={async () => { await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); window.location.assign("/"); }}><LogOut size={15} />Sign out</button></div><div className="account-help-card"><MapPin size={23} /><h3>See you at the salon.</h3><p>Arrive 5–10 minutes before your appointment. Payment is made at the salon.</p><Link href="/contact">Salon details <ArrowRight size={14} /></Link></div><p className="account-policy">Plans change. You can cancel or reschedule up to 2 hours before your appointment.</p></aside></div>
    {reschedule && <div className="account-modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) setReschedule(null); }}><section role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="reschedule-title" className="account-modal"><button className="modal-close" aria-label="Close reschedule" onClick={() => setReschedule(null)} disabled={busy}><X size={20} /></button><span className="eyebrow">A LITTLE CHANGE OF PLANS</span><h2 id="reschedule-title">Find a new time.</h2><p className="account-muted">{reschedule.serviceName} with {reschedule.staffName}</p><p className="reschedule-current">Currently: {day(reschedule.startAt)}, {time(reschedule.startAt)}</p><label className="field">New date<input type="date" value={date} min={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date())} onChange={event => setDate(event.target.value)} required /></label><p className="slot-label">Available times · Asia/Karachi</p>{slotLoading ? <p className="account-muted">Finding available times…</p> : slots.length ? <div className="reschedule-slots">{slots.map(item => <button key={`${item.staffId}-${item.startAt}`} type="button" className={slot?.startAt === item.startAt ? "selected" : ""} onClick={() => setSlot(item)}>{item.label}</button>)}</div> : <p className="account-alert">No times available on this day. Try another date.</p>}{error && <p role="alert" className="account-alert error">{error}</p>}<button className="button button-primary auth-submit" disabled={!slot || busy} onClick={() => void mutate(reschedule.id, "reschedule")}>{busy ? "Updating…" : "Confirm new time"}<ArrowRight size={17} /></button></section></div>}
  </div>;
}
