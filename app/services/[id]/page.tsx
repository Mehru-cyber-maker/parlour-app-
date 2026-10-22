import { ServiceDetail } from "../../../components/services-view";
import "../../services.css";

export const metadata = { title: "Your next treatment · BookWise" };

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceDetail id={id} />;
}
