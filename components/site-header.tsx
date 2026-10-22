"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, Sparkles, UserRound, X } from "lucide-react";

type User = { name: string; role: string };
const links = [{ href: "/", label: "Home" }, { href: "/services", label: "Services" }, { href: "/about", label: "About us" }, { href: "/contact", label: "Contact" }];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => fetch("/api/auth/me", { cache: "no-store" }).then(r => r.json()).then(data => { if (alive) setUser(data.user ?? null); }).catch(() => {});
    refresh();
    window.addEventListener("bookwise-auth", refresh);
    return () => { alive = false; window.removeEventListener("bookwise-auth", refresh); };
  }, [pathname]);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const accountHref = user ? user.role === "customer" ? "/account" : "/dashboard" : "/login";
  const accountLabel = user ? user.role === "customer" ? "My bookings" : "Dashboard" : "Sign in";
  return <header className="site-header">
    <div className="page-shell header-inner">
      <Link className="nav-brand" href="/" aria-label="BookWise home"><span className="brand-mark"><Sparkles size={20} strokeWidth={1.8} /></span><span>bookwise<span className="brand-dot">.</span></span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">{links.map(link => <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}</nav>
      <div className="nav-actions"><Link className="nav-account" href={accountHref}><UserRound size={17} /><span>{accountLabel}</span></Link><Link className="button button-primary nav-book" href="/book">Book appointment <ArrowUpRight size={16} /></Link></div>
      <button className="menu-toggle" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X size={23} /> : <Menu size={23} />}</button>
    </div>
    {open && <nav className="mobile-nav" id="mobile-navigation" aria-label="Mobile navigation">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}<Link href={accountHref}>{accountLabel}</Link><Link className="button button-primary" href="/book">Book appointment <ArrowUpRight size={16} /></Link></nav>}
  </header>;
}
