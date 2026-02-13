import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import '@/styles/components.css';
import '@/styles/animations.css';
import '@/styles/appshell.css';
import '@/styles/landing.css';
import '@/styles/training.css';
import '@/styles/dashboard.css';
import '@/styles/settings.css';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'Mind Sensei',
    template: '%s | Mind Sensei',
  },
  description: 'A privacy-first cognitive performance platform to sharpen focus, memory, reaction speed, and logical thinking. All data stays on your device.',
  keywords: [
    'brain training game online',
    'focus improvement exercises',
    'reaction time test online',
    'improve working memory',
    'cognitive performance app',
    'brain training',
    'mental fitness',
  ],
  authors: [{ name: 'MindSensei' }],
  icons: {
    icon: '/brain.svg',
    apple: '/brain.svg',
  },
  openGraph: {
    title: 'Mind Sensei - Sharpen Your Mind',
    description: 'Train focus, memory, reaction speed, and logic. Privacy-first. No tracking. Your data stays local.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Mind Sensei',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mind Sensei - Cognitive Performance Training',
    description: 'Train focus, memory, reaction speed, and logic. Privacy-first cognitive training.',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0a0e1a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
