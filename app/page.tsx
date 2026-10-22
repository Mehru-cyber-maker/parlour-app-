import Link from "next/link";
import { ArrowDownRight, ArrowRight, CalendarDays, Check, Clock3, Flower2, Heart, Leaf, Paintbrush, Scissors, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { services as getServices } from "@/lib/db";

export const dynamic = "force-dynamic";

const categories = [
  { name: "Hair", description: "A fresh start, from the roots.", icon: Scissors, color: "lilac" },
  { name: "Nails", description: "The little details you love.", icon: Paintbrush, color: "peach" },
  { name: "Skincare", description: "A little glow goes a long way.", icon: Sparkles, color: "sage" },
  { name: "Makeup", description: "You, with a little extra magic.", icon: Flower2, color: "pink" },
];

const featuredMetadata: Record<string, { category: string; description: string; imageAlt: string }> = {
  "hair-cut": { category: "HAIR CARE", description: "A cut that feels effortlessly you.", imageAlt: "Beautifully styled, healthy hair" },
  nails: { category: "NAIL STUDIO", description: "A fresh finish, down to your fingertips.", imageAlt: "A carefully finished manicure" },
  facial: { category: "SKIN RITUALS", description: "Slow down. Let your skin shine.", imageAlt: "A relaxing facial skincare treatment" },
};

export default function HomePage() {
  const catalog = getServices();
  const services = ["hair-cut", "nails", "facial"].flatMap(id => {
    const service = catalog.find(item => item.id === id);
    return service ? [{ ...service, ...featuredMetadata[id], duration: `${service.duration} min`, price: new Intl.NumberFormat("en-PK").format(service.price), slug: service.id }] : [];
  });
  const availableCategories = categories.filter(category => catalog.some(service => service.category === category.name));
  return (
    <div className="home">
      <section className="home-hero section-wrap">
        <div className="home-hero-copy">
          <span className="home-kicker"><span /> BEAUTY STARTS WITH YOU</span>
          <h1>A little self-care.<br />A whole new <em>you.</em><svg className="home-title-spark" width="43" height="51" viewBox="0 0 43 51" fill="none" aria-hidden="true"><path d="M23 2V15M4 13L14 23M41 17L30 25M7 39L18 32M28 48L25 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg></h1>
          <p>Good hair, glowing skin, and a moment just for you. Find your favorite treatment and leave the rest to us.</p>
          <div className="home-hero-actions"><Link href="/book" className="button button-primary">Book an appointment <ArrowRight size={18} /></Link><Link href="/services" className="home-text-link">Explore services <ArrowDownRight size={18} /></Link></div>
          <div className="home-hero-note"><span className="home-note-icon"><Check size={14} /></span><span>Book in minutes</span><span className="home-note-dot">·</span><span>Pay at the salon</span><span className="home-note-dot">·</span><span>Your time, your choice</span></div>
        </div>
        <div className="home-hero-visual">
          <div className="home-hero-orbit" />
          <div className="home-hero-image"><img src="/images/salon.jpg" alt="A warm, sunlit salon with beautiful styling stations and a welcoming atmosphere" fetchPriority="high" /><div className="home-image-shade" /><div className="home-image-caption"><span>YOUR LITTLE ESCAPE</span><strong>Come as you are.<br />Leave feeling wonderful.</strong></div></div>
          <div className="home-floating-flower"><Flower2 size={49} strokeWidth={1.1} /></div>
          <Link href="/book" className="home-appointment-tag"><span className="home-appointment-icon"><CalendarDays size={23} strokeWidth={1.5} /></span><div><strong>A little time for yourself</strong><span>Your next good day starts here.</span></div><ArrowRight size={18} /></Link>
          <div className="home-small-stamp"><Sun size={19} /><span>LOOK GOOD<br /><b>FEEL EVEN BETTER</b></span></div>
        </div>
      </section>

      <section className="home-categories section-wrap" aria-label="Explore treatment categories">
        {availableCategories.map(({ name, description, icon: Icon, color }) => <Link href={`/services?category=${name}`} className="home-category" key={name}><span className={`home-category-icon ${color}`}><Icon size={26} strokeWidth={1.5} /></span><span><strong>{name}</strong><small>{description}</small></span><ArrowDownRight size={19} /></Link>)}
      </section>

      <section className="home-services section-wrap">
        <div className="section-heading"><div><p className="eyebrow">THE FEEL-GOOD FAVORITES</p><h2 className="section-title">A little something <em>for you.</em></h2></div><Link href="/services" className="home-text-link">View all services <ArrowRight size={18} /></Link></div>
        <div className="home-service-grid">
          {services.map((service, index) => <article className="home-service-card" key={service.name}><Link href={`/services/${service.slug}`} className="home-service-image"><img src={service.image} alt={service.imageAlt} loading="lazy" /><span className="home-service-category">{service.category}</span>{index === 0 && <span className="home-popular-label"><Sparkles size={12} /> Studio favorite</span>}</Link><div className="home-service-info"><div className="home-service-title"><h3><Link href={`/services/${service.slug}`}>{service.name}</Link></h3><span><Clock3 size={13} /> {service.duration}</span></div><p>{service.description}</p><div className="home-service-bottom"><span>From <strong>Rs. {service.price}</strong></span><Link href={`/book?service=${service.slug}`} aria-label={`Book ${service.name}`} className="home-book-arrow"><ArrowRight size={20} /></Link></div></div></article>)}
        </div>
      </section>

      <section className="home-how"><div className="section-wrap"><div className="home-centered-heading"><p className="eyebrow">LESS PLANNING. MORE PAMPERING.</p><h2 className="section-title">Your next good day, <em>in three steps.</em></h2><p>A beautiful experience starts with a simple booking.</p></div><div className="home-steps">{[{number:"01", icon:Flower2, title:"Find your feel-good", text:"Browse our treatments and choose a little something for yourself."},{number:"02",icon:CalendarDays,title:"Make it your time",text:"Pick your favorite specialist and a time that fits your day."},{number:"03",icon:Heart,title:"Show up. Slow down.",text:"We’ll take care of the rest. Relax, enjoy, and pay at the salon."}].map(({number,icon:Icon,title,text})=><div className="home-step" key={number}><div className="home-step-top"><span>{number}</span><Icon size={29} strokeWidth={1.3}/></div><h3>{title}</h3><p>{text}</p></div>)}</div></div></section>

      <section className="home-about section-wrap"><div className="home-about-visual"><img src="/images/hair.jpg" alt="Thoughtful professional styling for beautiful, healthy hair" loading="lazy"/><div className="home-about-note"><Flower2 size={31} strokeWidth={1.4}/><span>A good day begins<br />with a little <em>you time.</em></span></div></div><div className="home-about-copy"><p className="eyebrow">MORE THAN A BEAUTY APPOINTMENT</p><h2 className="section-title">A space to unwind.<br />A reason to <em>feel good.</em></h2><p>We believe looking after yourself should feel as good as the result. A warm welcome, thoughtful treatments, and people who listen. That’s the BookWise way.</p><div className="home-values"><div><span><Heart size={19}/></span><div><h3>Care that feels personal</h3><p>Your style, your preferences, your kind of beautiful.</p></div></div><div><span><Leaf size={19}/></span><div><h3>A moment of calm</h3><p>A comfortable space to switch off and recharge.</p></div></div><div><span><ShieldCheck size={19}/></span><div><h3>No little surprises</h3><p>Clear prices, real availability, and easy booking.</p></div></div></div><Link href="/about" className="home-text-link">Get to know us <ArrowRight size={18}/></Link></div></section>

      <section className="home-cta section-wrap"><div className="home-cta-inner"><div className="home-cta-decoration" aria-hidden="true"><Flower2 size={160} strokeWidth={.5}/></div><div><p className="eyebrow">YOUR CALENDAR COULD USE A LITTLE SELF-CARE</p><h2>Make time for <em>you.</em></h2><p>A fresh look. A quiet moment. A little lift to your day.</p></div><Link href="/book" className="button button-lime">Find your appointment <ArrowRight size={19}/></Link></div></section>
    </div>
  );
}
