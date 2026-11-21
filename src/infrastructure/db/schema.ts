/* ==========================================================================
   IndexedDB Schema & Initialization
   ========================================================================== */

import { DB_NAME, DB_VERSION, STORE_CONFIGS } from '@/types/storage';

let dbInstance: IDBDatabase | null = null;
let opening: Promise<IDBDatabase> | null = null;

/** Open the database, creating/upgrading stores as needed */
export function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (opening) return opening;

    opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            // v1 keyed aggregates by date alone; summaries can be regenerated.
            if (event.oldVersion === 1 && db.objectStoreNames.contains('dailyAggregates')) {
                db.deleteObjectStore('dailyAggregates');
            }

            for (const config of STORE_CONFIGS) {
                if (!db.objectStoreNames.contains(config.name)) {
                    const store = db.createObjectStore(config.name, { keyPath: config.keyPath });
                    for (const idx of config.indexes) {
                        store.createIndex(idx.name, idx.keyPath, { unique: idx.unique });
                    }
                }
            }
        };

        request.onsuccess = (event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;

            dbInstance.onclose = () => {
                dbInstance = null;
                opening = null;
            };
            dbInstance.onversionchange = () => closeDB();

            resolve(dbInstance);
        };

        request.onerror = () => {
            opening = null;
            reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
        };
        request.onblocked = () => {
            opening = null;
            reject(new Error('Close other Mind Sensei tabs, then try again.'));
        };
    });
    return opening;
}

/** Close the database connection */
export function closeDB(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
    opening = null;
}
