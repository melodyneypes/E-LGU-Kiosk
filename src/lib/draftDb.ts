"use client";

/**
 * E-LGU Draft Files Storage (IndexedDB)
 * 
 * Why IndexedDB?
 * - localStorage has a strict 5MB limit and only stores strings (Base64 bloat is ~33%).
 * - Storing files (images, PDFs) in localStorage will easily crash the browser with QuotaExceededError.
 * - IndexedDB stores raw File/Blob objects asynchronously and supports massive storage sizes safely.
 * 
 * This file is client-only. We check for `window` to prevent Next.js SSR build errors.
 */

const DB_NAME = "ELguDraftsDb";
const STORE_NAME = "draft_files";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("IndexedDB is only available in the browser"));
    }

    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Key path will be a composite of draftKey and fieldName
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onerror = () => {
            reject(request.error || new Error("Failed to open IndexedDB"));
        };
    });
}

/**
 * Saves a single File/Blob associated with a draft key and a field name.
 * If file is null, it removes the entry.
 */
export async function saveDraftFile(draftKey: string, fieldName: string, file: File | null): Promise<void> {
    if (typeof window === "undefined") return;

    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const compositeKey = `${draftKey}_${fieldName}`;

        if (!file) {
            store.delete(compositeKey);
        } else {
            // Store the raw File object directly
            store.put({
                id: compositeKey,
                draftKey,
                fieldName,
                file,
                updatedAt: Date.now()
            });
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error(`Failed to save file for ${draftKey}:${fieldName} in IndexedDB`, error);
    }
}

/**
 * Retrieves a single File by draftKey and fieldName.
 */
export async function getDraftFile(draftKey: string, fieldName: string): Promise<File | null> {
    if (typeof window === "undefined") return null;

    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const compositeKey = `${draftKey}_${fieldName}`;
        const request = store.get(compositeKey);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? (result.file as File) : null);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Failed to get file for ${draftKey}:${fieldName} from IndexedDB`, error);
        return null;
    }
}

/**
 * Retrieves all files associated with a specific draftKey as a Record.
 */
export async function getDraftFiles(draftKey: string): Promise<Record<string, File>> {
    if (typeof window === "undefined") return {};

    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const filesMap: Record<string, File> = {};

        return new Promise((resolve, reject) => {
            // Open cursor to scan keys
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (cursor) {
                    const data = cursor.value;
                    if (data.draftKey === draftKey && data.file) {
                        filesMap[data.fieldName] = data.file;
                    }
                    cursor.continue();
                } else {
                    resolve(filesMap);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Failed to get draft files for key ${draftKey} from IndexedDB`, error);
        return {};
    }
}

/**
 * Clears all files associated with a specific draftKey.
 */
export async function clearDraftFiles(draftKey: string): Promise<void> {
    if (typeof window === "undefined") return;

    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (cursor) {
                    const data = cursor.value;
                    if (data.draftKey === draftKey) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Failed to clear draft files for key ${draftKey} from IndexedDB`, error);
    }
}
