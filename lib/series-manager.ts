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

// Melhorar a função extractSeriesBaseName para lidar melhor com diferentes formatos
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
    .replace(/\s*T\d+\s*/gi, "") // Remover T1 (temporada)
    .trim()
}

// Função melhorada para extrair informações de temporada e episódio
function extractSeasonEpisodeInfo(name: string): { season: number; episode: number } | null {
  // Padrões comuns para temporada/episódio
  const patterns = [
    // S01E01, S01 E01, S1E1
    { regex: /S(\d+)\s*E(\d+)/i, seasonGroup: 1, episodeGroup: 2 },

    // 1x01, 01x01
    { regex: /(\d+)x(\d+)/i, seasonGroup: 1, episodeGroup: 2 },

    // Season 1 Episode 1
    { regex: /Season\s*(\d+)\s*Episode\s*(\d+)/i, seasonGroup: 1, episodeGroup: 2 },

    // S01EP01, S1EP1
    { regex: /S(\d+)\s*EP(\d+)/i, seasonGroup: 1, episodeGroup: 2 },

    // T01E01, T1E1 (formato português/espanhol)
    { regex: /T(\d+)\s*E(\d+)/i, seasonGroup: 1, episodeGroup: 2 },

    // Temporada 1 Episodio 1
    { regex: /Temporada\s*(\d+).*?Episodio\s*(\d+)/i, seasonGroup: 1, episodeGroup: 2 },

    // Episodio 1 (com temporada implícita 1)
    { regex: /Episodio\s*(\d+)/i, seasonGroup: null, episodeGroup: 1 },

    // EP01, EP1
    { regex: /EP\s*(\d+)/i, seasonGroup: null, episodeGroup: 1 },

    // E01, E1 (sozinho)
    { regex: /\bE(\d+)\b/i, seasonGroup: null, episodeGroup: 1 },

    // Formato com hífen: - E01, - EP01
    { regex: /-\s*E(\d+)/i, seasonGroup: null, episodeGroup: 1 },
    { regex: /-\s*EP(\d+)/i, seasonGroup: null, episodeGroup: 1 },

    // Formato específico para Solo Leveling: S02E01, S01E01
    { regex: /S0?(\d+)E0?(\d+)/i, seasonGroup: 1, episodeGroup: 2 },
  ]

  for (const pattern of patterns) {
    const match = name.match(pattern.regex)
    if (match) {
      const season = pattern.seasonGroup ? Number.parseInt(match[pattern.seasonGroup], 10) : 1
      const episode = Number.parseInt(match[pattern.episodeGroup], 10)

      // Validar que os números são razoáveis (evitar falsos positivos)
      if (season > 0 && season < 100 && episode > 0 && episode < 1000) {
        return { season, episode }
      }
    }
  }

  return null
}

// Corrigir a função groupChannelsIntoSeries para garantir que todas as temporadas sejam incluídas
export function groupChannelsIntoSeries(channels: Channel[]): {
  series: SeriesInfo[]
  standaloneChannels: Channel[]
} {
  const seriesMap = new Map<string, SeriesInfo>()
  const standaloneChannels: Channel[] = []
  const processedIds = new Set<string>() // Para evitar duplicatas

  // Primeiro passo: identificar séries e agrupar episódios
  channels.forEach((channel) => {
    // Evitar processar o mesmo canal duas vezes
    if (processedIds.has(channel.id)) {
      return
    }

    // Verificar se o canal já tem informações de temporada e episódio
    let seasonInfo = null

    if (typeof channel.season === "number" && typeof channel.episode === "number") {
      seasonInfo = { season: channel.season, episode: channel.episode }
    } else {
      // Tentar extrair informações de temporada/episódio do nome
      seasonInfo = extractSeasonEpisodeInfo(channel.name)
    }

    if (seasonInfo) {
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
      if (!seriesInfo.seasons[seasonInfo.season]) {
        seriesInfo.seasons[seasonInfo.season] = {
          number: seasonInfo.season,
          episodes: [],
        }
      }

      // Criar uma cópia do canal com as informações de temporada/episódio
      const channelWithSeasonInfo = {
        ...channel,
        season: seasonInfo.season,
        episode: seasonInfo.episode,
      }

      // Adicionar o episódio à temporada
      seriesInfo.seasons[seasonInfo.season].episodes.push(channelWithSeasonInfo)

      // Marcar como processado
      processedIds.add(channel.id)
    } else {
      // Se não tem informações de temporada/episódio, considerar como canal independente
      standaloneChannels.push(channel)
      processedIds.add(channel.id)
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

