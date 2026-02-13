'use client';
import React from 'react';
import Link from 'next/link';
import { ENGINE_INFO } from '@/lib/constants';
import { IconBrain, IconFocus, IconMemory, IconReaction, IconLogic, IconChevronDown, Icon } from '@/components/icons';

const ENGINES = ['focus', 'memory', 'reaction', 'logic'] as const;
const ENGINE_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  focus: IconFocus,
  memory: IconMemory,
  reaction: IconReaction,
  logic: IconLogic,
};

const STATS = [
  { value: '4', label: 'Cognitive Engines', icon: 'brain' },
  { value: '100%', label: 'Offline & Private', icon: 'shield' },
  { value: 'Adaptive', label: 'Difficulty System', icon: 'trendUp' },
  { value: '∞', label: 'Free Forever', icon: 'zap' },
];

const FAQ = [
  { q: 'How does MindSenSei improve cognitive performance?', a: 'MindSenSei uses scientifically-grounded exercises targeting four core cognitive domains - sustained attention, working memory, reaction speed, and pattern reasoning. The adaptive difficulty engine ensures you are always training at the edge of your capability.' },
  { q: 'Is my data private?', a: 'Absolutely. Everything runs locally on your device using IndexedDB and LocalStorage. There are no servers, no accounts, and no data ever leaves your browser.' },
  { q: 'How does adaptive difficulty work?', a: 'After each training session, the system evaluates your performance with fatigue-awareness and adjusts the difficulty for your next session. If you are performing well, challenges increase. If you are struggling or fatigued, it eases up to keep training productive.' },
  { q: 'Can I export my training data?', a: 'Yes. You can export all your data as a JSON file from the Settings page and import it on another device or keep it as a backup.' },
  { q: 'What engines are available?', a: 'Focus (sustained attention), Memory (sequence recall), Reaction (go/no-go response speed), and Logic (pattern completion reasoning). Each has unique mechanics and scoring.' },
];

export default function LandingContent() {
  return (
    <div className="landing">
      {/* ---- Hero ---- */}
      <header className="hero">
        <div className="hero-bg-orb hero-orb-1" />
        <div className="hero-bg-orb hero-orb-2" />
        <div className="hero-bg-orb hero-orb-3" />

        <nav className="hero-nav container">
          <div className="hero-logo">
            <IconBrain size={28} color="var(--clr-accent)" />
            <span>MindSenSei</span>
          </div>
          <Link href="/dashboard" className="btn btn-primary btn-sm">Open App</Link>
        </nav>

        <div className="hero-content container">
          <h1 className="hero-title">
            Train Your Mind.<br />
            <span className="hero-accent">Sharpen Every Edge.</span>
          </h1>
          <p className="hero-subtitle">
            Science-backed cognitive training across focus, memory, reaction speed, and logic. Adaptive. Private. Powerful.
          </p>
          <div className="hero-actions">
            <Link href="/dashboard" className="btn btn-primary btn-lg hero-cta">Start Training</Link>
            <a href="#engines" className="btn btn-ghost btn-lg">Learn More</a>
          </div>
        </div>
      </header>

      {/* ---- Stats Strip ---- */}
      <section className="stats-strip">
        <div className="container stats-grid">
          {STATS.map(stat => (
            <div key={stat.label} className="stat-item">
              <div className="stat-icon"><Icon name={stat.icon} size={22} color="var(--clr-accent)" /></div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Engines ---- */}
      <section id="engines" className="section">
        <div className="container">
          <h2 className="section-title">Four Engines of Cognitive Growth</h2>
          <p className="section-subtitle">Each engine targets a distinct cognitive domain with specialized exercises and scoring algorithms.</p>
          <div className="engines-grid">
            {ENGINES.map(key => {
              const info = ENGINE_INFO[key];
              const EngineIcon = ENGINE_ICONS[key];
              return (
                <div key={key} className="engine-card">
                  <div className="engine-icon-wrap" style={{ background: `${info.color}15` }}>
                    <EngineIcon size={28} color={info.color} />
                  </div>
                  <h3 className="engine-name" style={{ color: info.color }}>{info.label}</h3>
                  <p className="engine-desc">{info.description}</p>
                  <Link href={`/train/${key}`} className="engine-link" style={{ color: info.color }}>
                    Train Now →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- How It Works ---- */}
      <section className="section section-alt">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-grid">
            {[
              { step: '01', title: 'Choose an Engine', desc: 'Select from Focus, Memory, Reaction, or Logic training.' },
              { step: '02', title: 'Complete a Session', desc: 'Each session adapts to your current difficulty level in real time.' },
              { step: '03', title: 'Review Your Growth', desc: 'Track CGI score, streaks, XP, and detailed performance analytics.' },
              { step: '04', title: 'Level Up', desc: 'Earn achievements, climb ranks, and watch your cognitive edge sharpen.' },
            ].map(item => (
              <div key={item.step} className="step-card">
                <div className="step-number">{item.step}</div>
                <h3 className="step-title">{item.title}</h3>
                <p className="step-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Science ---- */}
      <section className="section">
        <div className="container science-section">
          <div className="science-content">
            <h2 className="section-title" style={{ textAlign: 'left' }}>Built on Cognitive Science</h2>
            <p className="science-text">
              MindSenSei&apos;s training protocols are grounded in research on neuroplasticity, working memory capacity, and attentional control. Each engine uses validated paradigms - sustained attention tasks, n-back variants, go/no-go response inhibition, and pattern reasoning challenges.
            </p>
            <p className="science-text">
              The adaptive difficulty algorithm uses dampened learning rates with fatigue detection to keep you training in your zone of proximal development - challenging enough to grow, but not so hard you plateau from frustration.
            </p>
          </div>
          <div className="science-features">
            {[
              { icon: 'trendUp', text: 'Adaptive difficulty scaling' },
              { icon: 'shield', text: 'Fatigue-aware dampening' },
              { icon: 'barChart', text: 'CGI composite scoring' },
              { icon: 'award', text: 'Growth velocity tracking' },
            ].map(f => (
              <div key={f.text} className="science-feat">
                <Icon name={f.icon} size={18} color="var(--clr-accent)" />
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="section section-alt">
        <div className="container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {FAQ.map((item, i) => (
              <details key={i} className="faq-item">
                <summary className="faq-question">
                  {item.q}
                  <IconChevronDown size={16} className="faq-chevron" />
                </summary>
                <p className="faq-answer">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="cta-section">
        <div className="container" style={{ textAlign: 'center' }}>
          <IconBrain size={40} color="var(--clr-accent)" />
          <h2 className="cta-title">Ready to Train Your Mind?</h2>
          <p className="cta-desc">No sign-up. No tracking. Just pure cognitive training.</p>
          <Link href="/dashboard" className="btn btn-primary btn-lg">Launch MindSenSei</Link>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="footer">
        <div className="container footer-inner">
          <span>MindSensei - a part of Shortcut Sensei</span>
          <span>v1.0</span>
        </div>
      </footer>
    </div>
  );
}
