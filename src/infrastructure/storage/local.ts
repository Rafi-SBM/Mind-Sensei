/* ==========================================================================
   Typed LocalStorage Wrapper
   ========================================================================== */

/** Get a typed value from localStorage */
export function lsGet<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

/** Set a typed value in localStorage */
export function lsSet<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`LocalStorage set failed for key "${key}":`, e);
    }
}

/** Remove a key from localStorage */
export function lsRemove(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
}

/** Check if a key exists */
export function lsHas(key: string): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(key) !== null;
}

/** Get with default value */
export function lsGetOrDefault<T>(key: string, defaultValue: T): T {
    const value = lsGet<T>(key);
    if (value === null) {
        lsSet(key, defaultValue);
        return defaultValue;
    }
    return value;
}
