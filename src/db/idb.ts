const DB_NAME = 'zf-site'
const STORE = 'kv'
const VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const database = req.result
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const database = await open()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => database.close()
  })
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const database = await open()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => {
      database.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDel(key: string): Promise<void> {
  const database = await open()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => {
      database.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}
