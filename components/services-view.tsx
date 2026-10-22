"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock3, Heart, Search, Sparkles } from "lucide-react";

type Service = { id: string; name: string; category: string; description: string; duration: number; price: number; image: string; staffIds: string[] };
type Staff = { id: string; name: string; role: string; specialties: string | string[]; image: string };
type Catalog = { services: Service[]; staff: Staff[]; salon: { name: string; timezone: string; address: string; phone: string; email: string } };
const money = (value: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);
const serviceImage = (service: Service) => service.image || (/nail|manicure|pedicure/i.test(service.category) ? "/images/nails.jpg" : /skin|facial/i.test(service.category) ? "/images/skin.jpg" : "/images/hair.jpg");

function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/catalog", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("We couldn't load our services. Please try again.");
      const data = await response.json();
      setCatalog(data);
    }).catch(error => { if (error.name !== "AbortError") setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  return { catalog, error, retry: () => setAttempt(value => value + 1) };
}

function LoadingServices() {
  return <div className="svc-loading" role="status"><Sparkles size={24} /><p>Finding your next feel-good moment…</p></div>;
}

function LoadError({ error, retry }: { error: string; retry: () => void }) {
  return <div className="svc-empty" role="alert"><p>{error}</p><button className="button button-primary" onClick={retry}>Try again</button></div>;
}

export function ServicesView() {
  const { catalog, error, retry } = useCatalog();
  const [category, setCategory] = useState("All services");
  const [search, setSearch] = useState("");
  const categories = useMemo(() => ["All services", ...new Set(catalog?.services.map(service => service.category) ?? [])], [catalog]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("category");
    if (requested && catalog) {
      const matching = catalog.services.find(service => service.category.toLowerCase() === requested.toLowerCase());
      if (matching) setCategory(matching.category);
    }
  }, [catalog]);
  const services = catalog?.services.filter(service => (category === "All services" || category === service.category) && `${service.name} ${service.description} ${service.category}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <div className="svc-page">
    <section className="svc-intro">
      <span className="eyebrow svc-eyebrow"><Sparkles size={15} /> A LITTLE TIME, JUST FOR YOU</span>
      <h1>Good things come<br />to those who <em>self-care.</em></h1>
      <p>Fresh cuts. Healthy skin. Beautiful little details.<br className="svc-desktop-break" /> Find the treatment that feels like you.</p>
    </section>
    <section className="svc-catalog page-shell" aria-label="Explore our services">
      <div className="svc-toolbar">
        <div className="svc-categories" aria-label="Filter services by category">{categories.map(item => <button className={item === category ? "is-active" : ""} key={item} onClick={() => setCategory(item)} aria-pressed={item === category}>{item}</button>)}</div>
        <label className="svc-search"><Search size={17} aria-hidden="true" /><span className="svc-sr-only">Search services</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find your treatment" /></label>
      </div>
      {error ? <LoadError error={error} retry={retry} /> : !catalog ? <LoadingServices /> : <>
        <p className="svc-count">{services.length} {services.length === 1 ? "way" : "ways"} to feel like your best self</p>
        {services.length ? <div className="svc-grid">{services.map(service => <article className="svc-card" key={service.id}>
          <Link className="svc-image-link" href={`/services/${encodeURIComponent(service.id)}`} aria-label={`Explore ${service.name}`}><img src={serviceImage(service)} alt={service.name} loading="lazy" /><span className="svc-category-label">{service.category}</span><span className="svc-image-arrow"><ArrowRight size={20} /></span></Link>
          <div className="svc-card-content"><div className="svc-card-heading"><h2><Link href={`/services/${encodeURIComponent(service.id)}`}>{service.name}</Link></h2><span>{money(service.price)}</span></div><p>{service.description}</p><div className="svc-card-footer"><span><Clock3 size={15} />{service.duration} minutes</span><Link href={`/book?service=${encodeURIComponent(service.id)}`}>Book treatment <ArrowRight size={16} /></Link></div></div>
        </article>)}</div> : <div className="svc-empty"><Search size={28} /><h2>No treatments found</h2><p>Try a different search or explore all our services.</p><button className="button button-secondary" onClick={() => { setSearch(""); setCategory("All services"); }}>Show all services</button></div>}
      </>}
      <div className="svc-note"><span className="svc-note-icon"><Heart size={21} /></span><div><h3>Beautifully simple, from start to finish.</h3><p>Transparent prices. A time that suits you. Pay at the salon after your appointment.</p></div><Link href="/book" className="svc-note-link">Make time for you <ArrowRight size={18} /></Link></div>
    </section>
  </div>;
}

export function ServiceDetail({ id }: { id: string }) {
  const { catalog, error, retry } = useCatalog();
  const service = catalog?.services.find(item => item.id === id);
  if (error) return <div className="page-shell svc-detail-page"><LoadError error={error} retry={retry} /></div>;
  if (!catalog) return <div className="page-shell svc-detail-page"><LoadingServices /></div>;
  if (!service) return <div className="page-shell svc-detail-page"><div className="svc-empty"><h1>Treatment not found</h1><p>This treatment may no longer be available. Discover something lovely in our current menu.</p><Link href="/services" className="button button-primary">Explore services</Link></div></div>;
  const staff = catalog.staff.filter(person => service.staffIds.includes(person.id));
  const related = catalog.services.filter(item => item.id !== service.id && item.category === service.category).slice(0, 2);
  return <div className="page-shell svc-detail-page">
    <Link href="/services" className="svc-back"><ArrowLeft size={16} /> All services</Link>
    <section className="svc-detail-hero">
      <div className="svc-detail-image"><img src={serviceImage(service)} alt={service.name} /><span className="svc-detail-image-badge"><Sparkles size={18} /> Your kind of self-care</span></div>
      <div className="svc-detail-content"><span className="eyebrow">{service.category}</span><h1>{service.name}</h1><p className="svc-detail-description">{service.description}</p><div className="svc-detail-meta"><span><Clock3 size={18} />{service.duration} minutes</span><strong>{money(service.price)}</strong></div><Link href={`/book?service=${encodeURIComponent(service.id)}`} className="button button-primary svc-book-button">Book this treatment <ArrowRight size={18} /></Link><p className="svc-payment"><Check size={15} /> No online payment needed · Pay at the salon</p><div className="svc-included"><h2>A moment made for you</h2><p>We start with a personal consultation to understand what you have in mind, then tailor your treatment to suit you.</p><ul><li><Check size={16} /> A consultation with your chosen specialist</li><li><Check size={16} /> Professional products and thoughtful care</li><li><Check size={16} /> Personal aftercare advice before you leave</li></ul></div></div>
    </section>
    <div className="svc-detail-lower"><section className="svc-specialists"><span className="eyebrow">YOU’RE IN GOOD HANDS</span><h2>Meet your specialists.</h2><div className="svc-staff-grid">{staff.length ? staff.map(person => <article key={person.id} className="svc-person"><div className="svc-person-avatar">{person.image ? <img src={person.image} alt={person.name} loading="lazy" /> : person.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</div><div><h3>{person.name}</h3><p>{person.role}</p></div></article>) : <p>Our team will match you with an available specialist.</p>}</div></section><aside className="svc-before"><h2>Before your visit</h2><p>Arrive 5–10 minutes before your appointment so you can settle in. Let your specialist know about any allergies or sensitivities.</p><p>Need to change plans? You can reschedule or cancel from My Bookings, subject to our cancellation policy.</p><Link href="/contact">Have a question? Get in touch <ArrowRight size={15} /></Link></aside></div>
    {related.length > 0 && <section className="svc-related"><span className="eyebrow">A LITTLE MORE YOU TIME</span><h2>You might also love.</h2><div>{related.map(item => <Link key={item.id} href={`/services/${encodeURIComponent(item.id)}`}><img src={serviceImage(item)} alt="" loading="lazy" /><span><strong>{item.name}</strong><small>{item.duration} min · {money(item.price)}</small></span><ArrowRight size={20} /></Link>)}</div></section>}
  </div>;
}
