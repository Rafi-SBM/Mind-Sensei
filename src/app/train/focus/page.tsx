import type { Metadata } from 'next';
import TrainingSession from '@/components/training/TrainingSession';
export const metadata: Metadata = { title: 'Focus Training' };
export default function Page() { return <TrainingSession engine="focus" />; }
