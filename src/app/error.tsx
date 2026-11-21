'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <section className="card training-intro"><h1>A moment to regroup.</h1><p>We couldn’t load this screen. Your completed sessions are stored on your device.</p><div className="result-actions"><button className="btn btn-primary" onClick={reset}>Try again</button><Link href="/dashboard" className="btn btn-secondary">Dashboard</Link></div></section>; }
