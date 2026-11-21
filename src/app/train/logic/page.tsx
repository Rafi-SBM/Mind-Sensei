import type { Metadata } from 'next';
import TrainingSession from '@/components/training/TrainingSession';
export const metadata: Metadata = { title: 'Logic Training' };
export default function Page() { return <TrainingSession engine="logic" />; }
