/* ==========================================================================
   Math Utilities — Pure Functions
   ========================================================================== */

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Calculate arithmetic mean */
export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Calculate standard deviation */
export function standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const m = mean(values);
    const squaredDiffs = values.map(v => (v - m) ** 2);
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

/** Calculate variance */
export function variance(values: number[]): number {
    if (values.length < 2) return 0;
    const sd = standardDeviation(values);
    return sd ** 2;
}

/** Generate a deterministic pseudo-random number from a seed */
export function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * clamp(t, 0, 1);
}

/** Normalize a value from one range to another */
export function normalize(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number = 0,
    outMax: number = 1
): number {
    if (inMax === inMin) return outMin;
    const t = (value - inMin) / (inMax - inMin);
    return lerp(outMin, outMax, t);
}

/** Round to N decimal places */
export function roundTo(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/** Generate UUID v4 */
export function uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** Rolling window average from an array of values */
export function rollingAverage(values: number[], windowSize: number): number {
    if (values.length === 0) return 0;
    const window = values.slice(-windowSize);
    return mean(window);
}

/** Calculate exponentially weighted moving average */
export function ewma(values: number[], alpha: number = 0.3): number {
    if (values.length === 0) return 0;
    let result = values[0];
    for (let i = 1; i < values.length; i++) {
        result = alpha * values[i] + (1 - alpha) * result;
    }
    return result;
}
