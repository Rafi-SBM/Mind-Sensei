/* ==========================================================================
   Typed IndexedDB Client
   ========================================================================== */

import { openDB } from './schema';

/** Generic typed operations for any object store */
export async function dbGetAll<T>(storeName: string): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(new Error(`dbGetAll failed: ${request.error?.message}`));
    });
}

/** Get a single record by key */
export async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => reject(new Error(`dbGet failed: ${request.error?.message}`));
    });
}

/** Get records by index */
export async function dbGetByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey | IDBKeyRange
): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(new Error(`dbGetByIndex failed: ${request.error?.message}`));
    });
}

/** Put (insert or update) a record */
export async function dbPut<T>(storeName: string, record: T): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(record);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(new Error(tx.error?.message ?? "Storage transaction aborted."));
        request.onerror = () => reject(new Error(`dbPut failed: ${request.error?.message}`));
    });
}

/** Put multiple records in a single transaction */
export async function dbPutBatch<T>(storeName: string, records: T[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const record of records) {
            store.put(record);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new Error(`dbPutBatch failed: ${tx.error?.message}`));
    });
}

/** Delete a record by key */
export async function dbDelete(storeName: string, key: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(new Error(tx.error?.message ?? "Storage transaction aborted."));
        request.onerror = () => reject(new Error(`dbDelete failed: ${request.error?.message}`));
    });
}

/** Clear all records in a store */
export async function dbClear(storeName: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(new Error(tx.error?.message ?? "Storage transaction aborted."));
        request.onerror = () => reject(new Error(`dbClear failed: ${request.error?.message}`));
    });
}

/** Count records in a store */
export async function dbCount(storeName: string): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error(`dbCount failed: ${request.error?.message}`));
    });
}

/** Get records within a time range using an index */
export async function dbGetByTimeRange<T>(
    storeName: string,
    indexName: string,
    startTime: number,
    endTime: number
): Promise<T[]> {
    const range = IDBKeyRange.bound(startTime, endTime);
    return dbGetByIndex<T>(storeName, indexName, range);
}
