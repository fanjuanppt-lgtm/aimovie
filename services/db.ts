
import { UserProfile } from '../types';
import JSZip from 'jszip';

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

// Helper: Convert Base64 to Blob
const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
};

// Helper: Convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
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

  // LIGHTWEIGHT BACKUP (Text Only)
  exportUserData: async (ownerId: string, includeImages: boolean = false) => {
    const [universes, eggs, characters, storyboards, scenes] = await Promise.all([
        getAllByOwner(STORE_UNIVERSES, ownerId),
        getAllByOwner(STORE_EGGS, ownerId),
        getAllByOwner(STORE_CHARACTERS, ownerId),
        getAllByOwner(STORE_STORYBOARDS, ownerId),
        getAllByOwner(STORE_SCENES, ownerId)
    ]);

    // If text only, strip images
    if (!includeImages) {
        const stripImg = (items: any[], type: 'char' | 'scene' | 'storyboard') => {
             return items.map(item => {
                 const clone = { ...item };
                 if (type === 'char') clone.images = [];
                 if (type === 'scene') clone.images = [];
                 if (type === 'storyboard') {
                     clone.frames = clone.frames.map((f: any) => ({ ...f, imageUrl: '', imageHistory: [] }));
                 }
                 return clone;
             });
        };
        
        const backupData = {
            timestamp: new Date().toISOString(),
            version: 3,
            ownerId,
            type: 'text-only',
            data: { 
                universes, 
                eggs, 
                characters: stripImg(characters, 'char'), 
                storyboards: stripImg(storyboards, 'storyboard'), 
                scenes: stripImg(scenes, 'scene') 
            }
        };
        return JSON.stringify(backupData);
    }
    
    // Legacy full JSON export (not recommended for images)
    const backupData = {
        timestamp: new Date().toISOString(),
        version: 3,
        ownerId,
        type: 'full-json',
        data: { universes, eggs, characters, storyboards, scenes }
    };
    return JSON.stringify(backupData);
  },

  // FULL ZIP BACKUP (Recommended)
  exportFullBackupZip: async (ownerId: string): Promise<Blob> => {
      const zip = new JSZip();
      const assets = zip.folder("assets");
      
      const [universes, eggs, characters, storyboards, scenes] = await Promise.all([
        getAllByOwner(STORE_UNIVERSES, ownerId),
        getAllByOwner(STORE_EGGS, ownerId),
        getAllByOwner(STORE_CHARACTERS, ownerId),
        getAllByOwner(STORE_STORYBOARDS, ownerId),
        getAllByOwner(STORE_SCENES, ownerId)
      ]);

      // Process Images Helper
      const processImages = (items: any[], type: 'char' | 'scene' | 'storyboard') => {
          return items.map(item => {
              const clone = { ...item };
              
              if (type === 'char' && clone.images) {
                  clone.images = clone.images.map((img: any) => {
                      if (img.url && img.url.startsWith('data:')) {
                          try {
                              const blob = base64ToBlob(img.url);
                              // Filename strategy: type_itemId_imgId
                              const filename = `char_${clone.id}_${img.id}.png`; 
                              assets?.file(filename, blob);
                              return { ...img, url: `assets/${filename}` }; // Replace with ref
                          } catch (e) { return img; }
                      }
                      return img;
                  });
              }

              if (type === 'scene' && clone.images) {
                  clone.images = clone.images.map((img: any) => {
                      if (img.url && img.url.startsWith('data:')) {
                           try {
                               const blob = base64ToBlob(img.url);
                               const filename = `scene_${clone.id}_${img.id}.png`;
                               assets?.file(filename, blob);
                               return { ...img, url: `assets/${filename}` };
                           } catch (e) { return img; }
                      }
                      return img;
                  });
              }

              if (type === 'storyboard' && clone.frames) {
                  clone.frames = clone.frames.map((frame: any) => {
                      const fClone = { ...frame };
                      if (fClone.imageUrl && fClone.imageUrl.startsWith('data:')) {
                           try {
                               const blob = base64ToBlob(fClone.imageUrl);
                               const filename = `sb_${clone.id}_frame_${fClone.id}.png`;
                               assets?.file(filename, blob);
                               fClone.imageUrl = `assets/${filename}`;
                           } catch(e) {}
                      }
                      // Handle history too if needed, but maybe skip history for backup to save space?
                      // Let's skip history in backup to keep it lighter, or implement if needed.
                      // For now, strip history images to save massive space
                      fClone.imageHistory = []; 
                      return fClone;
                  });
              }
              
              if (clone.coverImage && clone.coverImage.startsWith('data:')) {
                  try {
                       const blob = base64ToBlob(clone.coverImage);
                       const filename = `univ_${clone.id}_cover.png`;
                       assets?.file(filename, blob);
                       clone.coverImage = `assets/${filename}`;
                  } catch(e) {}
              }

              return clone;
          });
      };

      const cleanUniverses = processImages(universes, 'scene'); // scene type logic handles simple image fields roughly
      const cleanCharacters = processImages(characters, 'char');
      const cleanScenes = processImages(scenes, 'scene');
      const cleanStoryboards = processImages(storyboards, 'storyboard');
      
      const dbData = {
          timestamp: new Date().toISOString(),
          version: 3,
          ownerId,
          type: 'full-zip',
          data: { 
              universes: cleanUniverses, 
              eggs, 
              characters: cleanCharacters, 
              storyboards: cleanStoryboards, 
              scenes: cleanScenes 
          }
      };
      
      zip.file("database.json", JSON.stringify(dbData, null, 2));
      
      return await zip.generateAsync({ type: "blob" });
  },

  importFullBackupZip: async (zipFile: File, currentOwnerId: string) => {
      const zip = await JSZip.loadAsync(zipFile);
      
      const dbFile = zip.file("database.json");
      if (!dbFile) throw new Error("无效的备份文件：找不到 database.json");
      
      const dbText = await dbFile.async("string");
      const dbData = JSON.parse(dbText);
      
      const { universes, eggs, characters, storyboards, scenes } = dbData.data;

      // Helper: Rehydrate images
      const rehydrate = async (items: any[], type: 'char' | 'scene' | 'storyboard') => {
          return Promise.all(items.map(async (item) => {
              const clone = { ...item };
              clone.ownerId = currentOwnerId; // Take ownership
              
              // Helper to read file from zip
              const readFile = async (ref: string) => {
                  if (ref && ref.startsWith('assets/')) {
                      const filename = ref.split('/')[1];
                      const file = zip.file(`assets/${filename}`);
                      if (file) {
                          const blob = await file.async("blob");
                          return await blobToBase64(blob);
                      }
                  }
                  return ref;
              };

              if (clone.coverImage) clone.coverImage = await readFile(clone.coverImage);

              if (type === 'char' && clone.images) {
                  clone.images = await Promise.all(clone.images.map(async (img: any) => {
                      return { ...img, url: await readFile(img.url) };
                  }));
              }

              if (type === 'scene' && clone.images) {
                  clone.images = await Promise.all(clone.images.map(async (img: any) => {
                      return { ...img, url: await readFile(img.url) };
                  }));
              }
              
              if (type === 'storyboard' && clone.frames) {
                  clone.frames = await Promise.all(clone.frames.map(async (f: any) => {
                      return { ...f, imageUrl: await readFile(f.imageUrl) };
                  }));
              }
              
              return clone;
          }));
      };

      const finalUniverses = await rehydrate(universes, 'scene');
      const finalCharacters = await rehydrate(characters, 'char');
      const finalScenes = await rehydrate(scenes, 'scene');
      const finalStoryboards = await rehydrate(storyboards, 'storyboard');
      
      // Eggs are text only
      const finalEggs = eggs.map((e: any) => ({ ...e, ownerId: currentOwnerId }));
      
      const tx = (await openDB()).transaction(
          [STORE_UNIVERSES, STORE_EGGS, STORE_CHARACTERS, STORE_STORYBOARDS, STORE_SCENES],
          'readwrite'
      );

      const storePut = (name: string, items: any[]) => {
          const store = tx.objectStore(name);
          items.forEach(i => store.put(i));
      };

      storePut(STORE_UNIVERSES, finalUniverses);
      storePut(STORE_EGGS, finalEggs);
      storePut(STORE_CHARACTERS, finalCharacters);
      storePut(STORE_STORYBOARDS, finalStoryboards);
      storePut(STORE_SCENES, finalScenes);
      
      return new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
  },

  // Import Data (Injects current ownerId) - Legacy JSON
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
