import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

export default function SiteFooter() {
  return <footer className="site-footer"><div className="page-shell"><div className="footer-grid">
    <div className="footer-brand"><Link className="nav-brand" href="/"><span className="brand-mark"><Sparkles size={20} /></span><span>bookwise<span className="brand-dot">.</span></span></Link><p>A little time for yourself.<br />A beautiful feeling that stays.</p><span className="footer-location">Lahore, Pakistan · Asia/Karachi</span></div>
    <div><h3>Explore</h3><Link href="/services">Our services</Link><Link href="/about">Our story</Link><Link href="/book">Book an appointment <ArrowUpRight size={13} /></Link><Link href="/account">My bookings</Link></div>
    <div><h3>Say hello</h3><p>24 Main Boulevard,<br />Gulberg, Lahore</p><a href="tel:+923001234567">+92 300 123 4567</a><a href="mailto:hello@bookwise.example">hello@bookwise.example</a></div>
    <div><h3>Studio hours</h3><p>Monday – Saturday<br /><strong>9:00 am – 6:00 pm</strong></p><p>Sunday<br />A little rest, for us too.</p></div>
  </div><div className="footer-bottom"><span>© {new Date().getFullYear()} BookWise Studio. A little more you.</span><span>Demo salon · Appointments are for demonstration.</span><Link href="/policies">Privacy & policies</Link></div></div></footer>;
}
