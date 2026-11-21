import type { Metadata } from 'next';
import LandingContent from '@/components/landing/LandingContent';

export const metadata: Metadata = {
  title: 'Mind Sensei',
  description: 'Train focus, memory, reaction speed, and logical reasoning with focused exercises. Privacy-first, offline after initial setup, adaptive difficulty.',
  openGraph: {
    title: 'Mind Sensei',
    description: 'Practice focus, memory, reaction speed, and logic. No accounts, no tracking, offline after setup.',
    type: 'website',
  },
};

export default function HomePage() {
  return <LandingContent />;
}
