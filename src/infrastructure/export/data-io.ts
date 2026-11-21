import type { ExportData } from '@/types/storage';
import { exportSnapshot, replaceData } from '@/infrastructure/state/store';
import { toDateString } from '@/lib/time';
import { validateBackup } from './validation';

export const exportAllData = exportSnapshot;
export async function downloadExport() {
    const data = await exportSnapshot();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindsensei-backup-${toDateString(Date.now())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseBackup(json: string): ExportData { return validateBackup(JSON.parse(json)); }
export async function importData(json: string): Promise<{ success: boolean; error?: string }> {
    try { await replaceData(parseBackup(json)); return { success: true }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Import failed.' }; }
}
