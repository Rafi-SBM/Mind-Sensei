/* ==========================================================================
   Time Formatting Utilities
   ========================================================================== */

/** Format milliseconds to human-readable duration */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

/** Format ms as precise latency */
export function formatLatency(ms: number): string {
    if (ms < 1) return '<1ms';
    return `${Math.round(ms)}ms`;
}

/** Get date string in YYYY-MM-DD */
export function toDateString(timestamp: number): string {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Get today's date string */
export function todayString(): string {
    return toDateString(Date.now());
}

/** Check if two dates are the same day */
export function isSameDay(a: string, b: string): boolean {
    return a === b;
}

/** Check if date is yesterday relative to another date */
export function isYesterday(dateStr: string, relativeTo: string): boolean {
    const date = new Date(dateStr);
    const ref = new Date(relativeTo);
    const diffMs = ref.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays === 1;
}

/** Get date N days ago */
export function daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toDateString(d.getTime());
}

/** Format date for display */
export function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

/** Format date with year */
export function formatFullDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}
