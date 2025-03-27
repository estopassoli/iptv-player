// IndexedDB wrapper para armazenar grandes dados IPTV
import { buscarPorRegex, calculateRelevanceScore, isRelevantMatch } from "@/lib/search-utils"

interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group: string
  epg?: string
  season?: number
  episode?: number
}

interface Series {
  id: string
  name: string
  seasons: Season[]
  poster?: string
}

interface Season {
  number: number
  episodes: Episode[]
}

interface Episode {
  id: string
  name: string
  url: string
  thumbnail?: string
  season: number
  episode: number
}

export interface IPTVData {
  channels: Channel[]
  series: Series[]
  categories: string[]
}

const DB_NAME = "iptvDB"
const DB_VERSION = 2 // Aumentado para adicionar índices
const STORE_NAME = "iptvContent"
const META_STORE = "iptvMeta"
const CATEGORY_STORE = "iptvCategories"
const SEARCH_CACHE_STORE = "searchCache"

// Cache em memória para buscas recentes
const searchCache = new Map<
  string,
  {
    timestamp: number
    results: Channel[]
  }
>()

// Inicializar o banco de dados
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = (event) => {
        console.error("Erro ao abrir IndexedDB:", event)
        reject("Erro ao abrir IndexedDB")
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = request.result

        // Criar object store para chunks de conteúdo IPTV
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" })
        }

        // Criar object store para metadados
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "id" })
        }

        // Criar object store para categorias
        if (!db.objectStoreNames.contains(CATEGORY_STORE)) {
          db.createObjectStore(CATEGORY_STORE, { keyPath: "name" })
        }

        // Criar object store para cache de busca
        if (!db.objectStoreNames.contains(SEARCH_CACHE_STORE)) {
          const searchStore = db.createObjectStore(SEARCH_CACHE_STORE, { keyPath: "query" })
          searchStore.createIndex("timestamp", "timestamp", { unique: false })
        }
      }
    } catch (error) {
      console.error("Erro ao inicializar DB:", error)
      reject("Erro ao inicializar banco de dados")
    }
  })
}

// Armazenar dados IPTV em chunks para evitar limitações de tamanho
export const storeIPTVData = async (data: IPTVData): Promise<void> => {
  console.time("storeIPTVData")
  try {
    const db = await initDB()

    // Armazenar metadados primeiro (transação separada)
    await new Promise<void>((resolve, reject) => {
      try {
        const metaTransaction = db.transaction([META_STORE], "readwrite")
        const metaStore = metaTransaction.objectStore(META_STORE)

        metaStore.put({
          id: "metadata",
          categories: data.categories,
          channelCount: data.channels.length,
          seriesCount: data.series.length,
          timestamp: Date.now(),
        })

        metaTransaction.oncomplete = () => {
          resolve()
        }

        metaTransaction.onerror = (event) => {
          console.error("Erro ao armazenar metadados:", event)
          reject("Erro ao armazenar metadados")
        }
      } catch (error) {
        console.error("Erro na transação de metadados:", error)
        reject(error)
      }
    })

    // Armazenar categorias (transação separada)
    await new Promise<void>((resolve, reject) => {
      try {
        const categoryTransaction = db.transaction([CATEGORY_STORE], "readwrite")
        const categoryStore = categoryTransaction.objectStore(CATEGORY_STORE)

        // Limpar categorias anteriores
        categoryStore.clear()

        // Armazenar cada categoria
        for (const category of data.categories) {
          categoryStore.put({ name: category })
        }

        categoryTransaction.oncomplete = () => {
          resolve()
        }

        categoryTransaction.onerror = (event) => {
          console.error("Erro ao armazenar categorias:", event)
          reject("Erro ao armazenar categorias")
        }
      } catch (error) {
        console.error("Erro na transação de categorias:", error)
        reject(error)
      }
    })

    // Limpar o cache de busca ao carregar novos dados
    await clearSearchCache()

    // Limpar o cache em memória
    searchCache.clear()

    // Armazenar canais em chunks (transação separada)
    const CHUNK_SIZE = 100 // Aumentado para melhor performance
    const totalChunks = Math.ceil(data.channels.length / CHUNK_SIZE)

    // Processar chunks em sequência para evitar sobrecarga
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const startIndex = chunkIndex * CHUNK_SIZE
      const endIndex = Math.min(startIndex + CHUNK_SIZE, data.channels.length)
      const chunk = data.channels.slice(startIndex, endIndex)

      await new Promise<void>((resolve, reject) => {
        try {
          const contentTransaction = db.transaction([STORE_NAME], "readwrite")
          const contentStore = contentTransaction.objectStore(STORE_NAME)

          // Limpar conteúdo anterior apenas no primeiro chunk
          if (chunkIndex === 0) {
            contentStore.clear()
          }

          contentStore.put({
            id: `channels_${startIndex}`,
            data: chunk,
            type: "channels",
            index: chunkIndex,
          })

          contentTransaction.oncomplete = () => {
            // Progresso de armazenamento
            const progress = Math.round((endIndex / data.channels.length) * 100)
            console.log(`Armazenamento: ${progress}% (${endIndex}/${data.channels.length} canais)`)
            resolve()
          }

          contentTransaction.onerror = (event) => {
            console.error(`Erro ao armazenar chunk ${chunkIndex}:`, event)
            reject(`Erro ao armazenar chunk ${chunkIndex}`)
          }
        } catch (error) {
          console.error(`Erro na transação do chunk ${chunkIndex}:`, error)
          reject(error)
        }
      })
    }

    console.timeEnd("storeIPTVData")
    console.log(`Armazenados ${data.channels.length} canais em ${totalChunks} chunks`)
  } catch (error) {
    console.error("Erro em storeIPTVData:", error)
    throw error
  }
}

// Limpar cache de busca
export const clearSearchCache = async (): Promise<void> => {
  try {
    const db = await initDB()
    const transaction = db.transaction([SEARCH_CACHE_STORE], "readwrite")
    const store = transaction.objectStore(SEARCH_CACHE_STORE)

    return new Promise((resolve, reject) => {
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = (event) => {
        console.error("Erro ao limpar cache de busca:", event)
        reject("Erro ao limpar cache de busca")
      }
    })
  } catch (error) {
    console.error("Erro em clearSearchCache:", error)
  }
}

// Obter metadados
export const getIPTVMetadata = async (): Promise<{
  categories: string[]
  channelCount: number
  seriesCount: number
  timestamp: number
} | null> => {
  try {
    const db = await initDB()
    const transaction = db.transaction([META_STORE], "readonly")
    const store = transaction.objectStore(META_STORE)

    return new Promise((resolve, reject) => {
      const request = store.get("metadata")

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = (event) => {
        console.error("Erro ao obter metadados:", event)
        reject("Erro ao obter metadados")
      }
    })
  } catch (error) {
    console.error("Erro em getIPTVMetadata:", error)
    return null
  }
}

// Obter todas as categorias
export const getAllCategories = async (): Promise<string[]> => {
  try {
    const db = await initDB()
    const transaction = db.transaction([CATEGORY_STORE], "readonly")
    const store = transaction.objectStore(CATEGORY_STORE)

    return new Promise((resolve, reject) => {
      const request = store.getAll()

      request.onsuccess = () => {
        const categories = request.result.map((item) => item.name)
        resolve(categories)
      }

      request.onerror = (event) => {
        console.error("Erro ao obter categorias:", event)
        reject("Erro ao obter categorias")
      }
    })
  } catch (error) {
    console.error("Erro em getAllCategories:", error)
    return []
  }
}

// Obter canais com paginação
export const getChannelsPaginated = async (
  category = "all",
  page = 0,
  pageSize = 20,
): Promise<{
  channels: Channel[]
  totalCount: number
  hasMore: boolean
}> => {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)

    // Primeiro, obter todos os canais
    const allChannels = await new Promise<Channel[]>((resolve, reject) => {
      const channels: Channel[] = []
      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          if (cursor.value.type === "channels") {
            channels.push(...cursor.value.data)
          }
          cursor.continue()
        } else {
          resolve(channels)
        }
      }

      request.onerror = (event) => {
        console.error("Erro ao obter canais:", event)
        reject("Erro ao obter canais")
      }
    })

    // Filtrar por categoria se necessário
    const filteredChannels =
      category === "all" ? allChannels : allChannels.filter((channel) => channel.group === category)

    // Ordenar os canais
    const sortedChannels = sortChannels(filteredChannels)

    // Aplicar paginação
    const start = page * pageSize
    const end = start + pageSize
    const paginatedChannels = sortedChannels.slice(start, end)

    return {
      channels: paginatedChannels,
      totalCount: sortedChannels.length,
      hasMore: end < sortedChannels.length,
    }
  } catch (error) {
    console.error("Erro em getChannelsPaginated:", error)
    return { channels: [], totalCount: 0, hasMore: false }
  }
}

// Adicionar função para ordenar canais
function sortChannels(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    // Extrair informações de temporada e episódio do nome do canal
    const aHasSeason = typeof a.season === "number" && typeof a.episode === "number"
    const bHasSeason = typeof b.season === "number" && typeof b.episode === "number"

    // Se ambos têm informações de temporada/episódio
    if (aHasSeason && bHasSeason) {
      // Primeiro ordenar por temporada
      if (a.season !== b.season) {
        return a.season! - b.season!
      }
      // Depois ordenar por episódio
      return a.episode! - b.episode!
    }

    // Se apenas um tem informações de temporada/episódio
    if (aHasSeason) return -1
    if (bHasSeason) return 1

    // Ordenação alfabética como fallback
    return a.name.localeCompare(b.name)
  })
}

// Buscar canais com paginação - versão otimizada e com busca avançada
export const searchChannelsPaginated = async (
  term: string,
  category = "all",
  page = 0,
  pageSize = 20,
): Promise<{
  channels: Channel[]
  totalCount: number
  hasMore: boolean
}> => {
  try {
    // Criar uma chave de cache única para esta busca
    const cacheKey = `${term.toLowerCase()}_${category}_${page}_${pageSize}`

    // Verificar se temos resultados em cache na memória
    const cachedResult = searchCache.get(cacheKey)
    if (cachedResult && Date.now() - cachedResult.timestamp < 60000) {
      // Cache válido por 1 minuto
      console.log("Usando resultados em cache da memória")
      return {
        channels: cachedResult.results.slice(0, pageSize),
        totalCount: cachedResult.results.length,
        hasMore: cachedResult.results.length > pageSize,
      }
    }

    // Se o termo de busca for muito curto, usar a função normal de paginação
    if (term.length < 2) {
      return getChannelsPaginated(category, page, pageSize)
    }

    console.time("search")

    // Buscar todos os canais de uma vez (otimizado para busca)
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)

    const allChannels = await new Promise<Channel[]>((resolve, reject) => {
      const channels: Channel[] = []
      const request = store.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          if (cursor.value.type === "channels") {
            channels.push(...cursor.value.data)
          }
          cursor.continue()
        } else {
          resolve(channels)
        }
      }

      request.onerror = (event) => {
        console.error("Erro ao obter canais para busca:", event)
        reject("Erro ao obter canais para busca")
      }
    })

    // Filtrar por categoria
    const filteredByCategory =
      category === "all" ? allChannels : allChannels.filter((channel) => channel.group === category)

    // Usar o algoritmo de busca avançada para filtrar os resultados
    const filteredChannels = filteredByCategory.filter((channel) => {
      return isRelevantMatch(channel.name, term)
    })

    // Ordenar os resultados por relevância
    const sortedChannels = sortChannelsByRelevance(filteredChannels, term)

    // Armazenar no cache em memória
    searchCache.set(cacheKey, {
      timestamp: Date.now(),
      results: sortedChannels,
    })

    // Limitar o tamanho do cache em memória (manter apenas as 20 buscas mais recentes)
    if (searchCache.size > 20) {
      const oldestKey = [...searchCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
      searchCache.delete(oldestKey)
    }

    // Aplicar paginação
    const start = page * pageSize
    const end = start + pageSize
    const paginatedChannels = sortedChannels.slice(start, end)

    console.timeEnd("search")

    return {
      channels: paginatedChannels,
      totalCount: sortedChannels.length,
      hasMore: end < sortedChannels.length,
    }
  } catch (error) {
    console.error("Erro em searchChannelsPaginated:", error)
    return { channels: [], totalCount: 0, hasMore: false }
  }
}

// Modificar a função sortChannelsByRelevance para dar prioridade à correspondência por regex
function sortChannelsByRelevance(channels: Channel[], searchTerm: string): Channel[] {
  // Extrair palavras-chave do termo de busca
  const keywords = searchTerm
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 1)

  // Calcular pontuação de relevância para cada canal
  const scoredChannels = channels.map((channel) => {
    const normalizedName = channel.name.toLowerCase()

    // Verificar correspondência por regex primeiro (maior pontuação)
    if (buscarPorRegex(channel.name, searchTerm)) {
      return { channel, score: 200 } // Pontuação mais alta para correspondências de regex
    }

    // Calcular pontuação básica
    let score = 0

    // Verificar correspondências exatas (maior pontuação)
    if (normalizedName.includes(searchTerm.toLowerCase())) {
      score += 100
    }

    // Verificar correspondências de palavras-chave individuais
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        score += 10
      }
    }

    // Usar o algoritmo avançado para calcular pontuação adicional
    const relevanceScore = calculateRelevanceScore(channel.name, keywords)
    score += relevanceScore * 50

    // Bônus para séries com temporada/episódio
    if (channel.season !== undefined && channel.episode !== undefined) {
      score += 5
    }

    return { channel, score }
  })

  // Ordenar por pontuação (maior primeiro)
  return scoredChannels.sort((a, b) => b.score - a.score).map((item) => item.channel)
}

// Adicionar a função calculateRelevanceScore se não estiver importando do search-utils
// function calculateRelevanceScore(text: string, keywords: string[]): number {
//   if (!keywords.length) return 0

//   const normalizedText = text.toLowerCase()
//   let matchCount = 0
//   let totalScore = 0

//   for (const keyword of keywords) {
//     // Verificar correspondência exata da palavra
//     if (normalizedText.includes(keyword)) {
//       matchCount++
//       totalScore += 1.0 // Pontuação máxima para correspondência exata
//     } else {
//       // Verificar correspondência parcial (pelo menos 3 caracteres)
//       if (keyword.length >= 3) {
//         // Verificar se pelo menos 3 caracteres consecutivos do keyword estão no texto
//         for (let i = 0; i <= keyword.length - 3; i++) {
//           const subKeyword = keyword.substring(i, i + 3)
//           if (normalizedText.includes(subKeyword)) {
//             matchCount++
//             // Pontuação parcial baseada no tamanho da correspondência
//             totalScore += 0.5 * (subKeyword.length / keyword.length)
//             break
//           }
//         }
//       }
//     }
//   }

//   // Calcular pontuação final
//   // Fator 1: Proporção de palavras-chave encontradas
//   const keywordCoverageScore = matchCount / keywords.length

//   // Fator 2: Pontuação média das correspondências
//   const matchQualityScore = matchCount > 0 ? totalScore / matchCount : 0

//   // Fator 3: Bônus para correspondências de múltiplas palavras
//   const multiWordBonus = matchCount > 1 ? 0.2 : 0

//   // Combinar os fatores (com pesos)
//   return Math.min(1, keywordCoverageScore * 0.5 + matchQualityScore * 0.3 + multiWordBonus)
// }

// Verificar se existem dados IPTV
export const hasIPTVData = async (): Promise<boolean> => {
  try {
    const metadata = await getIPTVMetadata()
    return !!metadata && metadata.channelCount > 0
  } catch (error) {
    console.error("Erro em hasIPTVData:", error)
    return false
  }
}

// function buscarPorRegex(text: string, searchTerm: string): boolean {
//     try {
//         // Criar a regex com a flag 'i' para case-insensitive
//         const regex = new RegExp(searchTerm, 'i');
//         return regex.test(text);
//     } catch (error) {
//         // Em caso de erro na regex (ex: caracteres inválidos), retornar falso
//         console.error("Erro na regex:", error);
//         return false;
//     }
// }

