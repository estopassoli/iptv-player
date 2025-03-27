import parser from "iptv-playlist-parser"

interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group: string
  epg?: string
  // Adicionar campos para temporada e episódio
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

// Função para extrair informações de temporada e episódio do nome
function extractSeasonEpisode(name: string): { season: number; episode: number } | null {
  const regex = /S(\d{1,2})E(\d{1,2})/i
  const match = name.match(regex)

  if (match) {
    const season = parseInt(match[1], 10)
    const episode = parseInt(match[2], 10)
    return { season, episode }
  }

  return null
}

// Função para limpar URLs e remover aspas
const cleanUrl = (url: string): string => {
  return url.replace(/"/g, "").trim()
}

export function parseM3U(content: string): IPTVData {
  console.time("parseM3U")

  try {
    // Usar a biblioteca iptv-playlist-parser para fazer o parsing
    const result = parser.parse(content)

    // Extrair canais do resultado
    const channels: Channel[] = []
    const categories = new Set<string>()

    // Processar cada item da playlist
    result.items.forEach((item, index) => {
      // Verificar se a URL é válida
      if (!item.url) {
        console.warn(`Item sem URL válida ignorado: ${item.name}`)
        return
      }

      // Limpar a URL (remover aspas e espaços)
      const cleanedUrl = cleanUrl(item.url)

      // Extrair grupo/categoria
      const group = item.group?.title || "Sem Categoria"
      categories.add(group)

      // Extrair informações de temporada e episódio do nome
      const seasonEpisodeInfo = extractSeasonEpisode(item.name)

      // Criar objeto de canal
      const channel: Channel = {
        id: `channel-${index}`,
        name: item.name || `Canal ${index + 1}`,
        url: cleanedUrl,
        logo: item.tvg?.logo || undefined,
        group: group,
        epg: item.tvg?.id || undefined,
      }

      // Adicionar informações de temporada e episódio se disponíveis
      if (seasonEpisodeInfo) {
        channel.season = seasonEpisodeInfo.season
        channel.episode = seasonEpisodeInfo.episode
      }



      channels.push(channel)
    })

    // Ordenar canais por temporada e episódio
    const sortedChannels = channels.sort((a, b) => {
      // Se ambos têm informações de temporada/episódio
      if (a.season && a.episode && b.season && b.episode) {
        // Primeiro ordenar por temporada
        if (a.season !== b.season) {
          return a.season - b.season
        }
        // Depois ordenar por episódio
        return a.episode - b.episode
      }

      // Se apenas um tem informações de temporada/episódio
      if (a.season && a.episode) return -1
      if (b.season && b.episode) return 1

      // Ordenação alfabética como fallback
      return a.name.localeCompare(b.name)
    })

    console.timeEnd("parseM3U")
    console.log(`Processados ${sortedChannels.length} canais em ${categories.size} categorias`)


    return {
      channels: sortedChannels,
      series: [], // Não implementado nesta versão
      categories: Array.from(categories),
    }
  } catch (error) {
    console.error("Erro ao processar M3U:", error)
    throw new Error("Falha ao processar arquivo M3U. Formato inválido ou não suportado.")
  }
}

