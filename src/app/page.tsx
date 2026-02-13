import type { Metadata } from 'next';
import LandingContent from '@/components/landing/LandingContent';

export const metadata: Metadata = {
  title: 'Mind Sensei',
  description: 'Train focus, memory, reaction speed, and logical reasoning with science-backed exercises. Privacy-first, fully offline, adaptive difficulty.',
  openGraph: {
    title: 'Mind Sensei',
    description: 'Train your brain with adaptive cognitive exercises. No accounts, no tracking, fully offline.',
    type: 'website',
  },
};

export default function HomePage() {
  return <LandingContent />;
}
