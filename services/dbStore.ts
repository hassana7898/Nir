type StoreValue = any;
type SyncItem = { id: string; action: 'create' | 'update' | 'delete'; entityType: string; data: any; timestamp: number };

type StoreName = 'store' | 'syncQueue';

type LocalDB = {
  get: (store: StoreName, key: IDBValidKey) => Promise<StoreValue | undefined>;
  put: (store: StoreName, value: StoreValue, key?: IDBValidKey) => Promise<IDBValidKey>;
  delete: (store: StoreName, key: IDBValidKey) => Promise<void>;
  getAll: (store: StoreName) => Promise<StoreValue[]>;
  getAllKeys: (store: StoreName) => Promise<IDBValidKey[]>;
  count: (store: StoreName) => Promise<number>;
};

let dbPromise: Promise<LocalDB> | null = null;

const openLocalDB = (): Promise<LocalDB> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('poultryAppDB', 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('store')) db.createObjectStore('store');
      if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const nativeDb = request.result;
      nativeDb.onversionchange = () => nativeDb.close();

      const run = <T>(storeName: StoreName, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
        new Promise((res, rej) => {
          const tx = nativeDb.transaction(storeName, mode);
          const req = action(tx.objectStore(storeName));
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error || new Error('IndexedDB operation failed'));
        });

      resolve({
        get: (store, key) => run(store, 'readonly', objectStore => objectStore.get(key)),
        put: (store, value, key) => run(store, 'readwrite', objectStore => key === undefined ? objectStore.put(value) : objectStore.put(value, key)),
        delete: async (store, key) => { await run(store, 'readwrite', objectStore => objectStore.delete(key)); },
        getAll: (store) => run(store, 'readonly', objectStore => objectStore.getAll()),
        getAllKeys: (store) => run(store, 'readonly', objectStore => objectStore.getAllKeys()),
        count: (store) => run(store, 'readonly', objectStore => objectStore.count()),
      });
    };
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
  });
  return dbPromise;
};

export const getDB = openLocalDB;
export const memoryCache: Record<string, any> = {};

const emitSyncStatus = (detail: Record<string, any> = {}) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nir_sync_status', { detail }));
};

export const initDataStore = async () => {
  const db = await getDB();
  const keys = await db.getAllKeys('store');
  const values = await db.getAll('store');
  if (keys.length === 0) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith('poultryApp')) continue;
      const raw = window.localStorage.getItem(key);
      try { memoryCache[key] = JSON.parse(raw || 'null'); } catch { memoryCache[key] = raw; }
      await db.put('store', memoryCache[key], key);
    }
  } else {
    keys.forEach((key, i) => { memoryCache[String(key)] = values[i]; });
  }
  emitSyncStatus({ pending: await getSyncQueueCount(), initialized: true });
};

const normalizeTimestamp = (value: any) => {
  if (typeof value === 'number') return value;
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? Date.now() : t;
};

export const getSyncQueue = async (): Promise<SyncItem[]> => (await getDB()).getAll('syncQueue') as SyncItem[];
export const getSyncQueueCount = async () => (await getDB()).count('syncQueue');
export const clearSyncItem = async (id: string) => {
  await (await getDB()).delete('syncQueue', id);
  emitSyncStatus({ pending: await getSyncQueueCount() });
};

export const hydrateFromServer = async (): Promise<boolean> => {
  if (!navigator.onLine) return false;
  if ((await getSyncQueueCount()) > 0) return false;
  try {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('nir_token') : null;
    const response = await fetch('/api/sync/state', {
      credentials: 'include',
      headers: {
        cache: 'no-store',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) return false;
    const state = await response.json();
    const db = await getDB();

    const put = async (key: string, value: any) => {
      if (value === undefined || value === null) return;
      memoryCache[key] = value;
      await db.put('store', value, key);
    };

    await put('poultryAppSettings', state.settings);
    await put('poultryAppFarmers', Array.isArray(state.farmers) ? state.farmers.filter((x: any) => !x.deletedAt).map((x: any) => ({ ...x, createdAt: normalizeTimestamp(x.createdAt), updatedAt: normalizeTimestamp(x.updatedAt) })) : []);
    await put('poultryAppDrivers', Array.isArray(state.drivers) ? state.drivers.filter((x: any) => !x.deletedAt).map((x: any) => x.name) : []);
    await put('poultryAppOrigins', Array.isArray(state.origins) ? state.origins.filter((x: any) => !x.deletedAt).map((x: any) => x.name) : []);
    await put('poultryAppInvoices', Array.isArray(state.invoices) ? state.invoices.map((x: any) => ({ ...x, createdAt: normalizeTimestamp(x.createdAt), updatedAt: normalizeTimestamp(x.updatedAt) })).filter((x: any) => !x.deletedAt) : []);
    await put('poultryAppFormulas', Array.isArray(state.formulas) ? state.formulas.map((x: any) => ({ ...x, createdAt: normalizeTimestamp(x.createdAt), updatedAt: normalizeTimestamp(x.updatedAt) })).filter((x: any) => !x.deletedAt) : []);
    await put('poultryAppProduction', Array.isArray(state.production) ? state.production.map((x: any) => ({ ...x, createdAt: normalizeTimestamp(x.createdAt), updatedAt: normalizeTimestamp(x.updatedAt) })).filter((x: any) => !x.deletedAt) : []);
    await put('poultryAppAdjustments', Array.isArray(state.adjustments) ? state.adjustments.map((x: any) => ({ ...x, createdAt: normalizeTimestamp(x.createdAt), updatedAt: normalizeTimestamp(x.updatedAt) })).filter((x: any) => !x.deletedAt) : []);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nir_store_hydrated'));
    emitSyncStatus({ pending: 0, syncedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
};

export const setStoreItem = async (key: string, value: any, entityType?: string, action?: 'create' | 'update' | 'delete', syncData?: any) => {
  memoryCache[key] = value;
  const db = await getDB();
  await db.put('store', value, key);
  if (entityType && action && syncData !== undefined) {
    await enqueueSync({ id: crypto.randomUUID(), action, entityType, data: syncData, timestamp: Date.now() });
  }
};

export const getStoreItem = (key: string) => memoryCache[key];
export const enqueueSync = async (item: SyncItem) => {
  await (await getDB()).put('syncQueue', item);
  emitSyncStatus({ pending: await getSyncQueueCount() });
  void triggerSync();
};

let isSyncing = false;
export const triggerSync = async () => {
  if (isSyncing || !navigator.onLine) return false;
  isSyncing = true;
  let anySynced = false;
  emitSyncStatus({ syncing: true, pending: await getSyncQueueCount() });
  try {
    const queue = await getSyncQueue();
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('nir_token') : null;
    for (const item of queue) {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          credentials: 'include',
          body: JSON.stringify(item),
        });
        if (response.ok) {
          await clearSyncItem(item.id);
          anySynced = true;
          continue;
        }
        if (response.status === 401 || response.status === 403) break;
      } catch {
        break;
      }
    }
    const pending = await getSyncQueueCount();
    if (anySynced && pending === 0) await hydrateFromServer();
    emitSyncStatus({ syncing: false, pending, lastAttempt: Date.now(), synced: anySynced && pending === 0 });
    return anySynced && pending === 0;
  } finally {
    isSyncing = false;
    emitSyncStatus({ syncing: false, pending: await getSyncQueueCount() });
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void triggerSync().then(() => hydrateFromServer());
  });
  setInterval(() => void triggerSync(), 30000);
}
