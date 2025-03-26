// Serviço para comunicação com a API do TMDB (The Movie Database)

// Constantes da API
const TMDB_API_KEY = process.env.TMDB_API_KEY || "" // Acessível apenas no servidor
const TMDB_BASE_URL = "https://api.themoviedb.org/3"
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p"

// Tamanhos de imagem disponíveis
export const ImageSize = {
  poster: {
    small: "w185",
    medium: "w342",
    large: "w500",
    original: "original",
  },
  backdrop: {
    small: "w300",
    medium: "w780",
    large: "w1280",
    original: "original",
  },
  profile: {
    small: "w45",
    medium: "w185",
    large: "h632",
    original: "original",
  },
}

// Interfaces para os dados retornados pela API
export interface TMDBMovie {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  genres: { id: number; name: string }[]
  runtime: number
}

export interface TMDBTVShow {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  genres: { id: number; name: string }[]
  number_of_seasons: number
  number_of_episodes: number
}

export interface TMDBEpisode {
  id: number
  name: string
  overview: string
  still_path: string | null
  air_date: string
  episode_number: number
  season_number: number
  vote_average: number
}

export interface TMDBSeason {
  id: number
  name: string
  overview: string
  poster_path: string | null
  air_date: string
  season_number: number
  episodes: TMDBEpisode[]
}

// Função para construir URLs de imagem
export function getTMDBImageUrl(path: string | null, size: string): string {
  if (!path) return "/placeholder.svg?height=300&width=200"
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
}

// Função para limpar o título para busca
function cleanTitleForSearch(title: string): string {
  return title
    .replace(/\[L\]/g, "") // Remover tag de legendado
    .replace(/S\d+\s*E\d+/gi, "") // Remover S01E01
    .replace(/\d+x\d+/g, "") // Remover 1x01
    .replace(/Season\s*\d+\s*Episode\s*\d+/gi, "") // Remover Season 1 Episode 1
    .replace(/\s*-\s*Episodio\s*\d+/gi, "") // Remover - Episodio 1
    .replace(/\s*-\s*EP\s*\d+/gi, "") // Remover - EP 1
    .replace(/$$\d{4}$$/g, "") // Remover ano entre parênteses
    .replace(/\[\d{4}\]/g, "") // Remover ano entre colchetes
    .replace(/\s+/g, " ") // Remover espaços extras
    .trim()
}

// Função para extrair o ano do título, se disponível
function extractYearFromTitle(title: string): number | null {
  const yearMatch = title.match(/$$(\d{4})$$/) || title.match(/\[(\d{4})\]/)
  if (yearMatch && yearMatch[1]) {
    return Number.parseInt(yearMatch[1], 10)
  }
  return null
}

// Cache em memória para evitar requisições repetidas
const searchCache = new Map<string, any>()
const detailsCache = new Map<string, any>()

// IMPORTANTE: As funções abaixo só devem ser usadas no servidor
// Elas não devem ser importadas diretamente no cliente

// Função para buscar filmes por título
export async function searchMovie(title: string): Promise<TMDBMovie | null> {
  try {
    const cleanedTitle = cleanTitleForSearch(title)
    const cacheKey = `movie_search_${cleanedTitle}`

    // Verificar cache
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey)
    }

    // Extrair ano, se disponível
    const year = extractYearFromTitle(title)
    let yearParam = ""
    if (year) {
      yearParam = `&year=${year}`
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanedTitle)}${yearParam}&language=pt-BR`,
    )

    if (!response.ok) {
      throw new Error(`Erro na busca de filme: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.results && data.results.length > 0) {
      // Obter detalhes completos do primeiro resultado
      const movieDetails = await getMovieDetails(data.results[0].id)

      // Armazenar no cache
      searchCache.set(cacheKey, movieDetails)

      return movieDetails
    }

    // Armazenar resultado negativo no cache
    searchCache.set(cacheKey, null)
    return null
  } catch (error) {
    console.error("Erro ao buscar filme:", error)
    return null
  }
}

// Função para buscar séries por título
export async function searchTVShow(title: string): Promise<TMDBTVShow | null> {
  try {
    const cleanedTitle = cleanTitleForSearch(title)
    const cacheKey = `tv_search_${cleanedTitle}`

    // Verificar cache
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey)
    }

    // Extrair ano, se disponível
    const year = extractYearFromTitle(title)
    let yearParam = ""
    if (year) {
      yearParam = `&first_air_date_year=${year}`
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanedTitle)}${yearParam}&language=pt-BR`,
    )

    if (!response.ok) {
      throw new Error(`Erro na busca de série: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.results && data.results.length > 0) {
      // Obter detalhes completos do primeiro resultado
      const tvDetails = await getTVShowDetails(data.results[0].id)

      // Armazenar no cache
      searchCache.set(cacheKey, tvDetails)

      return tvDetails
    }

    // Armazenar resultado negativo no cache
    searchCache.set(cacheKey, null)
    return null
  } catch (error) {
    console.error("Erro ao buscar série:", error)
    return null
  }
}

// Função para obter detalhes de um filme específico
export async function getMovieDetails(movieId: number): Promise<TMDBMovie | null> {
  try {
    const cacheKey = `movie_details_${movieId}`

    // Verificar cache
    if (detailsCache.has(cacheKey)) {
      return detailsCache.get(cacheKey)
    }

    const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=pt-BR`)

    if (!response.ok) {
      throw new Error(`Erro ao obter detalhes do filme: ${response.statusText}`)
    }

    const data = await response.json()

    // Armazenar no cache
    detailsCache.set(cacheKey, data)

    return data
  } catch (error) {
    console.error("Erro ao obter detalhes do filme:", error)
    return null
  }
}

// Função para obter detalhes de uma série específica
export async function getTVShowDetails(tvId: number): Promise<TMDBTVShow | null> {
  try {
    const cacheKey = `tv_details_${tvId}`

    // Verificar cache
    if (detailsCache.has(cacheKey)) {
      return detailsCache.get(cacheKey)
    }

    const response = await fetch(`${TMDB_BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}&language=pt-BR`)

    if (!response.ok) {
      throw new Error(`Erro ao obter detalhes da série: ${response.statusText}`)
    }

    const data = await response.json()

    // Armazenar no cache
    detailsCache.set(cacheKey, data)

    return data
  } catch (error) {
    console.error("Erro ao obter detalhes da série:", error)
    return null
  }
}

// Função para obter detalhes de uma temporada específica
export async function getSeasonDetails(tvId: number, seasonNumber: number): Promise<TMDBSeason | null> {
  try {
    const cacheKey = `season_details_${tvId}_${seasonNumber}`

    // Verificar cache
    if (detailsCache.has(cacheKey)) {
      return detailsCache.get(cacheKey)
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=pt-BR`,
    )

    if (!response.ok) {
      throw new Error(`Erro ao obter detalhes da temporada: ${response.statusText}`)
    }

    const data = await response.json()

    // Armazenar no cache
    detailsCache.set(cacheKey, data)

    return data
  } catch (error) {
    console.error("Erro ao obter detalhes da temporada:", error)
    return null
  }
}

// Função para obter detalhes de um episódio específico
export async function getEpisodeDetails(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<TMDBEpisode | null> {
  try {
    const cacheKey = `episode_details_${tvId}_${seasonNumber}_${episodeNumber}`

    // Verificar cache
    if (detailsCache.has(cacheKey)) {
      return detailsCache.get(cacheKey)
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}&language=pt-BR`,
    )

    if (!response.ok) {
      throw new Error(`Erro ao obter detalhes do episódio: ${response.statusText}`)
    }

    const data = await response.json()

    // Armazenar no cache
    detailsCache.set(cacheKey, data)

    return data
  } catch (error) {
    console.error("Erro ao obter detalhes do episódio:", error)
    return null
  }
}

