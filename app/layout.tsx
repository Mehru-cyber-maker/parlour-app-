import type { Metadata } from 'next';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import './globals.css';
import './info.css';
export const metadata: Metadata = { title: { default: 'BookWise — A little self-care. A whole new you.', template: '%s · BookWise' }, description: 'Make time for yourself. Discover hair, nails, skincare, and makeup at BookWise Studio, and book your next salon appointment in a few simple steps.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader/><main id="main-content">{children}</main><SiteFooter/></body></html>; }
