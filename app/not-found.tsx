import Link from 'next/link';
export default function NotFound(){return <div className="page-shell" style={{paddingBlock:'100px',textAlign:'center'}}><p className="eyebrow">A little detour</p><h1 className="section-title">This page isn’t here.</h1><p>Let’s get you back to a little self-care.</p><Link className="button button-primary" href="/">Back to home</Link></div>}
