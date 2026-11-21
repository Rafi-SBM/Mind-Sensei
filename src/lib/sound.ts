'use client';
import { getSnapshot } from '@/infrastructure/state/store';
let context: AudioContext | null = null;
export function playCue(kind: 'start' | 'correct' | 'wrong' | 'complete') {
    if (!getSnapshot().preferences.soundEnabled) return;
    try {
        context ??= new AudioContext();
        void context.resume();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime({ start: 440, correct: 660, wrong: 180, complete: 880 }[kind], context.currentTime);
        gain.gain.setValueAtTime(0.06, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.16);
    } catch { /* Audio is optional when unavailable. */ }
}
