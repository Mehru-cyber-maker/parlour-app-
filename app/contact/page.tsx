import Link from "next/link";
import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from "lucide-react";
import "../info.css";

export const metadata = { title: "Visit the studio | BookWise" };
const faqs = [
  ["How do I book an appointment?", "Choose a service, pick your stylist and an available time, then sign in to confirm. You’ll see your booking reference and can manage your visit from My bookings."],
  ["Can I cancel or reschedule?", "Yes. Visit My bookings to cancel or choose a new time at least two hours before your appointment. New appointment times are checked again when you confirm."],
  ["How do I pay?", "Payment is due at the salon after your service. We don’t take online payments or collect card details."],
  ["Which timezone are the appointments in?", "All appointment times use the salon’s local timezone, Asia/Karachi (Pakistan Standard Time, UTC+5)."],
  ["Is this a real salon?", "BookWise Studio is a working demonstration website. The salon details, team, and service menu are samples; bookings do not reserve a real salon appointment."],
];

export default function ContactPage() {
  return <div className="info-page"><section className="page-shell info-intro"><span className="eyebrow">COME ON IN</span><h1>A warm welcome.<br /><em>Every single time.</em></h1><p>Have a question or planning your next little reset? Here’s where to find our studio.</p></section>
    <section className="page-shell info-contact-grid"><div className="info-contact-card"><MapPin size={25} /><h2>Find the studio</h2><p>BookWise Studio<br />24 Main Boulevard<br />Gulberg, Lahore, Pakistan</p><span className="info-small">Sample address for this demo.</span></div><div className="info-contact-card"><Phone size={25} /><h2>Let’s talk</h2><a href="tel:+923001234567">+92 300 123 4567 <ArrowUpRight size={15} /></a><a href="mailto:hello@bookwise.example">hello@bookwise.example <ArrowUpRight size={15} /></a><span className="info-small">Demo contact details; messages are not monitored.</span></div><div className="info-contact-card"><Clock3 size={25} /><h2>Make some time</h2><p>Monday – Saturday<br /><strong>9:00 am – 6:00 pm</strong></p><p>Sunday · Closed</p><span className="info-small">All hours in Asia/Karachi.</span></div></section>
    <section className="page-shell info-faq"><div><span className="eyebrow">A FEW HELPFUL ANSWERS</span><h2 className="section-title">Before your<br /><em>little escape.</em></h2><Link className="button button-primary" href="/book">Find your appointment <ArrowUpRight size={17} /></Link></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
  </div>;
}
