
const DB_NAME = 'AI_Cinema_DB';
const DB_VERSION = 3; // Bumped version for storyboards
const STORE_UNIVERSES = 'universes';
const STORE_EGGS = 'eggs';
const STORE_CHARACTERS = 'characters';
const STORE_STORYBOARDS = 'storyboards';

// Open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_UNIVERSES)) {
        db.createObjectStore(STORE_UNIVERSES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_EGGS)) {
        db.createObjectStore(STORE_EGGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CHARACTERS)) {
        db.createObjectStore(STORE_CHARACTERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_STORYBOARDS)) {
        db.createObjectStore(STORE_STORYBOARDS, { keyPath: 'id' });
      }
    };
  });
};

// Generic Get All
const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Generic Put (Insert/Update)
const put = async (storeName: string, item: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const dbService = {
  getUniverses: () => getAll<any>(STORE_UNIVERSES),
  saveUniverse: (u: any) => put(STORE_UNIVERSES, u),
  
  getStoryEggs: () => getAll<any>(STORE_EGGS),
  saveStoryEgg: (e: any) => put(STORE_EGGS, e),

  getCharacters: () => getAll<any>(STORE_CHARACTERS),
  saveCharacter: (c: any) => put(STORE_CHARACTERS, c),

  getStoryboards: () => getAll<any>(STORE_STORYBOARDS),
  saveStoryboard: (s: any) => put(STORE_STORYBOARDS, s),
};