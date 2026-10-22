import BookingFlow from "../../components/booking-flow";
import "../booking.css";

export const metadata = {
  title: "Book an appointment | BookWise",
  description: "A moment for you. Choose your treatment, your stylist, and a time that fits your day.",
};

export default function BookPage() {
  return <BookingFlow />;
}
