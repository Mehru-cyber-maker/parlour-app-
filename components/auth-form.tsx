"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, Eye, EyeOff, Flower2, ShieldCheck } from "lucide-react";

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(response => response.json()).then(data => setDemoMode(data.demoMode === true)).catch(() => {});
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn’t sign you in. Please try again.");
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : data.user?.role === "customer" ? "/account" : "/dashboard";
      window.location.assign(destination);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Something went wrong. Please try again."); setBusy(false);
    }
  }

  function demo(role: string) {
    setMode("login"); setEmail(`${role}@bookwise.local`); setPassword("BookwiseDemo2026!"); setError("");
  }

  return <div className="page-shell auth-page">
    <div className="auth-story">
      <span className="eyebrow"><Flower2 size={16} /> YOUR NEXT GOOD-HAIR DAY</span>
      <h1>A little time<br />just for <em>you.</em></h1>
      <p>Your favorite services, your perfect time, and a little more ease in your day. Welcome to your BookWise space.</p>
      <div className="auth-benefits"><span><Check size={17} /> Book a little self-care, anytime</span><span><Check size={17} /> Keep every appointment in one place</span><span><Check size={17} /> Reschedule when life happens</span></div>
      <div className="auth-image"><img src="/images/salon.jpg" alt="A welcoming salon space" /><div><CalendarDays size={20} /><span>Make room for feeling good.</span></div></div>
    </div>
    <section className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button></div>
      <span className="eyebrow">WELCOME TO BOOKWISE</span>
      <h2 id="auth-title">{mode === "login" ? "Lovely to see you again." : "Your self-care starts here."}</h2>
      <p className="account-muted">{mode === "login" ? "Sign in to book your next appointment." : "Create your account and find your next favorite ritual."}</p>
      <form onSubmit={submit} className="account-form">
        {mode === "register" && <label className="field">Full name<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" required minLength={2} maxLength={100} /></label>}
        <label className="field">Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
        <label className="field">Password<div className="password-input"><input type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 10 characters" : "Enter your password"} required minLength={mode === "register" ? 10 : 1} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        {error && <p className="account-alert error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy}>{busy ? "One moment…" : mode === "login" ? "Sign in" : "Create my account"}<ArrowRight size={18} /></button>
      </form>
      <p className="auth-privacy"><ShieldCheck size={16} /> Your details stay private. Your time stays yours.</p>
      {demoMode && <details className="demo-accounts"><summary>Explore the local demo</summary><p>Use a sample account to try each role. These accounts are for this local development app.</p><div>{["customer", "stylist", "admin"].map(role => <button key={role} type="button" onClick={() => demo(role)}>{role}</button>)}</div><small>Password: BookwiseDemo2026!</small></details>}
      <p className="auth-help">Just browsing? <Link href="/services">Explore our services <ArrowRight size={14} /></Link></p>
    </section>
  </div>;
}
