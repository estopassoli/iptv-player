// Gerenciador de thumbnails usando IndexedDB

const DB_NAME = "iptvDB"
const DB_VERSION = 2
const THUMBNAIL_STORE = "thumbnails"

// Inicializar o banco de dados para thumbnails
const initThumbnailDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = (event) => {
        console.error("Erro ao abrir IndexedDB para thumbnails:", event)
        reject("Erro ao abrir IndexedDB")
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = request.result

        // Criar object store para thumbnails se não existir
        if (!db.objectStoreNames.contains(THUMBNAIL_STORE)) {
          db.createObjectStore(THUMBNAIL_STORE, { keyPath: "id" })
        }
      }
    } catch (error) {
      console.error("Erro ao inicializar DB de thumbnails:", error)
      reject("Erro ao inicializar banco de dados de thumbnails")
    }
  })
}

// Salvar thumbnail para um item específico
export const saveThumbnail = async (itemId: string, thumbnailData: string): Promise<void> => {
  try {
    const db = await initThumbnailDB()
    const transaction = db.transaction([THUMBNAIL_STORE], "readwrite")
    const store = transaction.objectStore(THUMBNAIL_STORE)

    return new Promise((resolve, reject) => {
      const request = store.put({
        id: itemId,
        data: thumbnailData,
        timestamp: Date.now(),
      })

      request.onsuccess = () => {
        console.log(`Thumbnail salva para o item ${itemId}`)
        resolve()
      }

      request.onerror = (event) => {
        console.error("Erro ao salvar thumbnail:", event)
        reject("Erro ao salvar thumbnail")
      }
    })
  } catch (error) {
    console.error("Erro em saveThumbnail:", error)
    throw error
  }
}

// Obter thumbnail para um item específico
export const getThumbnail = async (itemId: string): Promise<string | null> => {
  try {
    const db = await initThumbnailDB()

    // Verificar se o object store existe
    if (!db.objectStoreNames.contains(THUMBNAIL_STORE)) {
      console.warn("Object store 'thumbnails' não encontrado")
      return null
    }

    const transaction = db.transaction([THUMBNAIL_STORE], "readonly")
    const store = transaction.objectStore(THUMBNAIL_STORE)

    return new Promise((resolve, reject) => {
      const request = store.get(itemId)

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data)
        } else {
          resolve(null)
        }
      }

      request.onerror = (event) => {
        console.error("Erro ao obter thumbnail:", event)
        reject("Erro ao obter thumbnail")
      }
    })
  } catch (error) {
    console.error("Erro em getThumbnail:", error)
    return null
  }
}

// Verificar se um item tem thumbnail
export const hasThumbnail = async (itemId: string): Promise<boolean> => {
  try {
    const thumbnail = await getThumbnail(itemId)
    return !!thumbnail
  } catch (error) {
    console.error("Erro em hasThumbnail:", error)
    return false
  }
}

