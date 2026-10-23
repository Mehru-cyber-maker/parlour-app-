import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "../info.css";

export const metadata = { title: "Privacy & appointment policies | BookWise" };

export default function PoliciesPage() {
  return <div className="info-page"><section className="page-shell info-intro"><span className="eyebrow">THE LITTLE DETAILS</span><h1>Clear plans.<br /><em>Peace of mind.</em></h1><p>A few simple policies to keep appointments running smoothly.</p></section><div className="page-shell info-policies">
    <article><span>01</span><div><h2>Appointments & time</h2><p>All appointment times are shown in Asia/Karachi (UTC+5). The studio is open Monday through Saturday, 9:00 am to 6:00 pm. Availability depends on the selected service, stylist, existing bookings, and any blocked time.</p><p>Time slots are checked again when you confirm. A slot becomes reserved only when you see a successful booking confirmation and reference.</p></div></article>
    <article><span>02</span><div><h2>Cancellations & rescheduling</h2><p>You may cancel or reschedule at least two hours before the appointment begins. Sign in and visit My bookings to make a change. Rescheduled appointments must meet the same availability rules as new bookings.</p><p>If your appointment is less than two hours away, please contact the salon. In this demonstration, the contact details are examples and are not monitored.</p></div></article>
    <article><span>03</span><div><h2>Prices & payment</h2><p>All listed prices are in Pakistani rupees (PKR). The price shown when you book is saved with your appointment. Payment is due at the salon; this website does not collect payment or card information.</p></div></article>
    <article><span>04</span><div><h2>Your information</h2><p>This demonstration stores your account details and appointments in its application database. Passwords are hashed, and account sessions use HTTP-only cookies. Customers can view their own bookings; staff can view appointments permitted by their role.</p><p>Do not enter real personal information or sensitive details in this demo. Appointment notes are visible to authorised salon staff. This demonstration has no transactional email or payment provider connected.</p></div></article>
    <article><span>05</span><div><h2>A note about this studio</h2><p>BookWise Studio, its team, contact details, and service menu are sample content. Creating an appointment here does not reserve a visit at a real salon. This app is intended to demonstrate the BookWise booking experience.</p></div></article>
    <div className="info-policy-end"><p>A little clarity makes room for a little more care.</p><Link href="/services" className="button button-primary">Explore the services <ArrowUpRight size={16} /></Link></div>
  </div></div>;
}
