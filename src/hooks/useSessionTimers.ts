'use client';
import { useEffect, useRef } from 'react';

type Task = { callback: () => void; remaining: number; due: number; timer?: ReturnType<typeof setTimeout> };
export function useSessionTimers() {
    const tasks = useRef(new Set<Task>());
    const isPaused = useRef(false);
    function run(task: Task) {
        task.due = performance.now() + task.remaining;
        task.timer = setTimeout(() => { tasks.current.delete(task); task.callback(); }, task.remaining);
    }
    function schedule(callback: () => void, delay: number) {
        const task: Task = { callback, remaining: delay, due: 0 };
        tasks.current.add(task);
        if (!isPaused.current) run(task);
        return () => { clearTimeout(task.timer); tasks.current.delete(task); };
    }
    function clear() { tasks.current.forEach(task => clearTimeout(task.timer)); tasks.current.clear(); isPaused.current = false; }
    function pause() {
        isPaused.current = true;
        tasks.current.forEach(task => { clearTimeout(task.timer); task.remaining = Math.max(0, task.due - performance.now()); });
    }
    function resume() { isPaused.current = false; tasks.current.forEach(run); }
    useEffect(() => { const pending = tasks.current; return () => { pending.forEach(task => clearTimeout(task.timer)); pending.clear(); }; }, []);
    return { schedule, clear, pause, resume };
}
