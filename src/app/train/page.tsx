'use client';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { useAppState } from '@/hooks/useStorage';
import { ENGINE_INFO } from '@/lib/constants';
import { computeRollingAverages } from '@/domain/analytics/metrics';
import { computeSkillImbalance, suggestTraining } from '@/domain/analytics/suggestions';
const tasks = { focus: 'Circles, squares, and a little self-control.', memory: 'Watch. Remember. Recall in order.', reaction: 'Move fast. Know when to hold back.', logic: 'One sequence. A hidden rule. Your move.' };
export default function TrainingHub() {
    const { sessions, difficulty } = useAppState();
    const suggestion = suggestTraining(sessions, computeSkillImbalance(computeRollingAverages(sessions)));
    return <div className="training-hub animate-fade-in"><header className="studio-heading"><p className="eyebrow">THE TRAINING STUDIO</p><h1>A little practice.<br /><span>A sharper you.</span></h1><p>Four ways to challenge your mind. Pick your practice for today.</p></header><div className="studio-grid">{(['focus','memory','reaction','logic'] as const).map((engine, i) => <Link key={engine} href={`/train/${engine}`} className="studio-card" style={{ '--engine-color': ENGINE_INFO[engine].color } as React.CSSProperties}><div className="studio-card-top"><span className="engine-number">0{i + 1}</span><Icon name={engine} size={36} /></div><h2>{ENGINE_INFO[engine].label}</h2><p>{tasks[engine]}</p><div className="studio-card-bottom"><span>Level {Math.round(difficulty[engine])} · 1–5 min</span><span className="studio-arrow" aria-hidden="true">↗</span></div></Link>)}</div><aside className="card studio-suggestion"><Icon name="brain" size={24} /><div><h2>Your next good move</h2><p>{suggestion.reason}</p></div><Link href={`/train/${suggestion.engineType}`} className="btn btn-primary">Train {ENGINE_INFO[suggestion.engineType].label} →</Link></aside><p className="studio-note"><Icon name="shield" size={14} /> No account needed. Sessions and progress stay on this device.</p></div>;
}
