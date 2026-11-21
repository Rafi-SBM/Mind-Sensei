import Link from 'next/link';
export default function NotFound() { return <section className="card training-intro"><p className="eyebrow">404 · A SMALL DETOUR</p><h1>Let’s get back to practice.</h1><p>This page doesn’t exist. Your next session is one click away.</p><Link href="/train" className="btn btn-primary">Open training studio →</Link></section>; }
