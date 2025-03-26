import type { Channel } from "@/types/iptv"

export interface SeriesInfo {
  id: string
  name: string
  seasons: Record<number, SeriesSeason>
  thumbnail?: string
  group: string
}

export interface SeriesSeason {
  number: number
  episodes: Channel[]
}

export interface SeriesEpisode extends Channel {
  seasonNumber: number
  episodeNumber: number
}

// Função para extrair o nome base da série (removendo informações de temporada/episódio)
export function extractSeriesBaseName(name: string): string {
  // Remover padrões comuns de temporada/episódio
  return name
    .replace(/\s*\[L\]\s*/g, "") // Remover tag de legendado
    .replace(/\s*S\d+\s*E\d+\s*/gi, "") // Remover S01E01
    .replace(/\s*\d+x\d+\s*/g, "") // Remover 1x01
    .replace(/\s*Season\s*\d+\s*Episode\s*\d+\s*/gi, "") // Remover Season 1 Episode 1
    .replace(/\s*S\d+\s*EP\d+\s*/gi, "") // Remover S01EP01
    .replace(/\s*E\d+\s*/gi, "") // Remover E01
    .replace(/\s*-\s*Episodio\s*\d+\s*/gi, "") // Remover - Episodio 1
    .replace(/\s*-\s*EP\s*\d+\s*/gi, "") // Remover - EP 1
    .replace(/\s*-\s*E\s*\d+\s*/gi, "") // Remover - E 1
    .trim()
}

// Função para agrupar canais em séries
export function groupChannelsIntoSeries(channels: Channel[]): {
  series: SeriesInfo[]
  standaloneChannels: Channel[]
} {
  const seriesMap = new Map<string, SeriesInfo>()
  const standaloneChannels: Channel[] = []

  // Primeiro passo: identificar séries e agrupar episódios
  channels.forEach((channel) => {
    // Verificar se o canal tem informações de temporada e episódio
    if (typeof channel.season === "number" && typeof channel.episode === "number") {
      // Extrair o nome base da série
      const seriesName = extractSeriesBaseName(channel.name)
      const seriesKey = seriesName.toLowerCase()

      // Se a série ainda não existe no mapa, criar uma nova entrada
      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, {
          id: `series-${seriesKey.replace(/[^a-z0-9]/g, "-")}`,
          name: seriesName,
          seasons: {},
          thumbnail: channel.logo,
          group: channel.group,
        })
      }

      const seriesInfo = seriesMap.get(seriesKey)!

      // Se a temporada ainda não existe, criar uma nova entrada
      if (!seriesInfo.seasons[channel.season]) {
        seriesInfo.seasons[channel.season] = {
          number: channel.season,
          episodes: [],
        }
      }

      // Adicionar o episódio à temporada
      seriesInfo.seasons[channel.season].episodes.push(channel)
    } else {
      // Se não tem informações de temporada/episódio, considerar como canal independente
      standaloneChannels.push(channel)
    }
  })

  // Ordenar episódios dentro de cada temporada
  seriesMap.forEach((series) => {
    Object.values(series.seasons).forEach((season) => {
      season.episodes.sort((a, b) => {
        if (a.episode !== undefined && b.episode !== undefined) {
          return a.episode - b.episode
        }
        return 0
      })
    })
  })

  // Converter o mapa em array
  const seriesArray = Array.from(seriesMap.values())

  return {
    series: seriesArray,
    standaloneChannels,
  }
}

// Função para obter a primeira temporada e episódio de uma série
export function getFirstEpisode(series: SeriesInfo): Channel | null {
  const seasonNumbers = Object.keys(series.seasons)
    .map(Number)
    .sort((a, b) => a - b)

  if (seasonNumbers.length === 0) return null

  const firstSeason = series.seasons[seasonNumbers[0]]
  if (firstSeason.episodes.length === 0) return null

  return firstSeason.episodes[0]
}

// Função para obter todas as temporadas e episódios de uma série
export function getAllEpisodes(series: SeriesInfo): SeriesEpisode[] {
  const episodes: SeriesEpisode[] = []

  Object.values(series.seasons).forEach((season) => {
    season.episodes.forEach((episode) => {
      episodes.push({
        ...episode,
        seasonNumber: season.number,
        episodeNumber: episode.episode || 0,
      })
    })
  })

  return episodes
}

