
import { UserProfile } from '../types';

const DB_NAME = 'AI_Cinema_DB';
const DB_VERSION = 8; // Upgrade for Users table and ownerId index
const STORE_USERS = 'users';
const STORE_UNIVERSES = 'universes';
const STORE_EGGS = 'eggs';
const STORE_CHARACTERS = 'characters';
const STORE_STORYBOARDS = 'storyboards';
const STORE_SCENES = 'scenes';

// Open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
        console.error("IndexedDB Open Error:", request.error);
        reject(request.error);
    };

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 1. Create Users Store
      if (!db.objectStoreNames.contains(STORE_USERS)) {
          const userStore = db.createObjectStore(STORE_USERS, { keyPath: 'id' });
          userStore.createIndex('username', 'username', { unique: true });
      }

      // 2. Helper to create stores with ownerId index
      const createOrUpdateStore = (name: string) => {
          let store;
          if (!db.objectStoreNames.contains(name)) {
             store = db.createObjectStore(name, { keyPath: 'id' });
          } else {
             store = (event.target as IDBOpenDBRequest).transaction!.objectStore(name);
          }

          // Create index for data isolation if not exists
          if (!store.indexNames.contains('ownerId')) {
              store.createIndex('ownerId', 'ownerId', { unique: false });
          }
      };

      createOrUpdateStore(STORE_UNIVERSES);
      createOrUpdateStore(STORE_EGGS);
      createOrUpdateStore(STORE_CHARACTERS);
      createOrUpdateStore(STORE_STORYBOARDS);
      createOrUpdateStore(STORE_SCENES);
    };
  });
};

// Generic Get All (Filtered by User)
const getAllByOwner = async <T>(storeName: string, ownerId: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index('ownerId');
        // Retrieve only items matching the ownerId
        const request = index.getAll(ownerId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    } catch (e) {
        reject(e);
    }
  });
};

// Generic Put (Insert/Update)
const put = async (storeName: string, item: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    } catch (e) {
        reject(e);
    }
  });
};

// Generic Delete
const deleteItem = async (storeName: string, id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    } catch (e) {
        reject(e);
    }
  });
};

// Generic Count
const count = async (storeName: string, ownerId?: string): Promise<number> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            let request;
            if (ownerId) {
                const index = store.index('ownerId');
                request = index.count(ownerId);
            } else {
                request = store.count();
            }
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        return 0;
    }
};

// --- AUTH SERVICES ---

const registerUser = async (user: UserProfile): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_USERS, 'readwrite');
        const store = tx.objectStore(STORE_USERS);
        
        // Check username existence manually or rely on unique index
        const request = store.add(user);
        
        request.onsuccess = () => resolve();
        request.onerror = (e: any) => {
            if (e.target.error.name === 'ConstraintError') {
                reject(new Error("用户名已存在"));
            } else {
                reject(e.target.error);
            }
        };
    });
};

const loginUser = async (username: string, password: string): Promise<UserProfile | null> => {
     const db = await openDB();
     return new Promise((resolve, reject) => {
         const tx = db.transaction(STORE_USERS, 'readonly');
         const store = tx.objectStore(STORE_USERS);
         const index = store.index('username');
         const request = index.get(username);
         
         request.onsuccess = () => {
             const user = request.result as UserProfile;
             if (user && user.password === password) {
                 resolve(user);
             } else {
                 resolve(null);
             }
         };
         request.onerror = () => reject(request.error);
     });
};

// Data Migration Helper: Assign legacy data (no ownerId) to the first user
const migrateLegacyData = async (newOwnerId: string) => {
    const db = await openDB();
    const stores = [STORE_UNIVERSES, STORE_EGGS, STORE_CHARACTERS, STORE_STORYBOARDS, STORE_SCENES];
    
    for (const storeName of stores) {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        
        req.onsuccess = () => {
            const items = req.result;
            items.forEach((item: any) => {
                if (!item.ownerId) {
                    item.ownerId = newOwnerId;
                    store.put(item);
                }
            });
        };
    }
};

export const dbService = {
  // Auth
  registerUser,
  loginUser,
  migrateLegacyData,

  // Data Ops (Now require ownerId)
  getUniverses: (ownerId: string) => getAllByOwner<any>(STORE_UNIVERSES, ownerId),
  saveUniverse: (u: any) => put(STORE_UNIVERSES, u),
  
  getStoryEggs: (ownerId: string) => getAllByOwner<any>(STORE_EGGS, ownerId),
  saveStoryEgg: (e: any) => put(STORE_EGGS, e),

  getCharacters: (ownerId: string) => getAllByOwner<any>(STORE_CHARACTERS, ownerId),
  saveCharacter: (c: any) => put(STORE_CHARACTERS, c),
  deleteCharacter: (id: string) => deleteItem(STORE_CHARACTERS, id),

  getStoryboards: (ownerId: string) => getAllByOwner<any>(STORE_STORYBOARDS, ownerId),
  saveStoryboard: (s: any) => put(STORE_STORYBOARDS, s),

  getScenes: (ownerId: string) => getAllByOwner<any>(STORE_SCENES, ownerId),
  saveScene: (s: any) => put(STORE_SCENES, s),

  // Backup & Restore (Needs update to support filtering by owner, or full admin dump)
  // For now, let's keep it simple: export EVERYTHING for this user
  exportUserData: async (ownerId: string) => {
    const [universes, eggs, characters, storyboards, scenes] = await Promise.all([
        getAllByOwner(STORE_UNIVERSES, ownerId),
        getAllByOwner(STORE_EGGS, ownerId),
        getAllByOwner(STORE_CHARACTERS, ownerId),
        getAllByOwner(STORE_STORYBOARDS, ownerId),
        getAllByOwner(STORE_SCENES, ownerId)
    ]);

    const backupData = {
        timestamp: new Date().toISOString(),
        version: 3,
        ownerId,
        data: { universes, eggs, characters, storyboards, scenes }
    };
    
    return JSON.stringify(backupData);
  },

  // Import Data (Injects current ownerId)
  importData: async (data: any, currentOwnerId: string) => {
      if (!data || !data.data) throw new Error("无效备份");
      
      const db = await openDB();
      // Logic similar to previous but ensures ownerId is overwritten to currentOwnerId
      // to prevent stealing/messing up IDs.
      
      const { universes, eggs, characters, storyboards, scenes } = data.data;
      
      const tx = db.transaction(
          [STORE_UNIVERSES, STORE_EGGS, STORE_CHARACTERS, STORE_STORYBOARDS, STORE_SCENES],
          'readwrite'
      );

      const importItems = (storeName: string, items: any[]) => {
          if (!items) return;
          const store = tx.objectStore(storeName);
          items.forEach(item => {
              item.ownerId = currentOwnerId; // Force ownership transfer
              store.put(item);
          });
      };

      importItems(STORE_UNIVERSES, universes);
      importItems(STORE_EGGS, eggs);
      importItems(STORE_CHARACTERS, characters);
      importItems(STORE_STORYBOARDS, storyboards);
      importItems(STORE_SCENES, scenes);
      
      return new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
  },

  getStats: async (ownerId: string) => {
      return {
          universes: await count(STORE_UNIVERSES, ownerId),
          eggs: await count(STORE_EGGS, ownerId),
          characters: await count(STORE_CHARACTERS, ownerId),
          storyboards: await count(STORE_STORYBOARDS, ownerId),
          scenes: await count(STORE_SCENES, ownerId),
      }
  }
};
