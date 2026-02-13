/* ==========================================================================
   IndexedDB Schema & Initialization
   ========================================================================== */

import { DB_NAME, DB_VERSION, STORE_CONFIGS } from '@/types/storage';

let dbInstance: IDBDatabase | null = null;

/** Open the database, creating/upgrading stores as needed */
export function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

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
            };

            resolve(dbInstance);
        };

        request.onerror = () => {
            reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
        };
    });
}

/** Close the database connection */
export function closeDB(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
