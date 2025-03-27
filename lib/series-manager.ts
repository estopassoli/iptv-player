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

// Improved function to extract the base name of a series
export function extractSeriesBaseName(name: string): string {
  // Remove common season/episode patterns and tags
  return name
    .replace(/\s*\[L\]\s*/g, "") // Remove subtitled tag
    .replace(/\s*\[D\]\s*/g, "") // Remove dubbed tag (if exists)
    .replace(/\s*S\d+\s*E\d+\s*/gi, "") // Remove S01E01
    .replace(/\s*\d+x\d+\s*/g, "") // Remove 1x01
    .replace(/\s*Season\s*\d+\s*Episode\s*\d+\s*/gi, "") // Remove Season 1 Episode 1
    .replace(/\s*S\d+\s*EP\d+\s*/gi, "") // Remove S01EP01
    .replace(/\s*E\d+\s*/gi, "") // Remove E01
    .replace(/\s*-\s*Episodio\s*\d+\s*/gi, "") // Remove - Episodio 1
    .replace(/\s*-\s*EP\s*\d+\s*/gi, "") // Remove - EP 1
    .replace(/\s*-\s*E\s*\d+\s*/gi, "") // Remove - E 1
    .replace(/\s*T\d+\s*/gi, "") // Remove T1 (temporada)
    .replace(/\s*S\d+\s*/gi, "") // Remove S1, S01 (season)
    .trim()
}

// Improved function to extract season and episode information
function extractSeasonEpisodeInfo(name: string): { season: number; episode: number } | null {
  // Common patterns for season/episode
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

    // Solo Leveling specific format: S01E01, S02E01
    { regex: /S0?(\d+)E0?(\d+)/i, seasonGroup: 1, episodeGroup: 2 },

    // Solo Leveling specific format: S01E01, S02E01 without the E
    { regex: /S0?(\d+)0?(\d+)/i, seasonGroup: 1, episodeGroup: 2 },
  ]

  for (const pattern of patterns) {
    const match = name.match(pattern.regex)
    if (match) {
      const season = pattern.seasonGroup ? Number.parseInt(match[pattern.seasonGroup], 10) : 1
      const episode = Number.parseInt(match[pattern.episodeGroup], 10)

      // Validate that the numbers are reasonable (avoid false positives)
      if (season > 0 && season < 100 && episode > 0 && episode < 1000) {
        return { season, episode }
      }
    }
  }

  // Check for specific patterns like "Solo Leveling S01E01" or "Solo Leveling S01"
  if (name.includes("S01") || name.includes("S02")) {
    // Try to extract episode number from the end of the name
    const episodeMatch = name.match(/(\d+)$/)
    if (episodeMatch) {
      const episode = Number.parseInt(episodeMatch[1], 10)
      const season = name.includes("S02") ? 2 : 1
      return { season, episode }
    }
  }

  return null
}

// Improved function to group channels into series
export function groupChannelsIntoSeries(channels: Channel[]): {
  series: SeriesInfo[]
  standaloneChannels: Channel[]
} {
  const seriesMap = new Map<string, SeriesInfo>()
  const standaloneChannels: Channel[] = []
  const processedIds = new Set<string>() // To avoid duplicates

  // First pass: identify series and group episodes
  channels.forEach((channel) => {
    // Avoid processing the same channel twice
    if (processedIds.has(channel.id)) {
      return
    }

    // Check if the channel already has season and episode information
    let seasonInfo = null

    if (typeof channel.season === "number" && typeof channel.episode === "number") {
      seasonInfo = { season: channel.season, episode: channel.episode }
    } else {
      // Try to extract season/episode information from the name
      seasonInfo = extractSeasonEpisodeInfo(channel.name)
    }

    if (seasonInfo) {
      // Extract the base series name
      const seriesName = extractSeriesBaseName(channel.name)
      const seriesKey = seriesName.toLowerCase()

      // If the series doesn't exist in the map yet, create a new entry
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

      // If the season doesn't exist yet, create a new entry
      if (!seriesInfo.seasons[seasonInfo.season]) {
        seriesInfo.seasons[seasonInfo.season] = {
          number: seasonInfo.season,
          episodes: [],
        }
      }

      // Create a copy of the channel with season/episode information
      const channelWithSeasonInfo = {
        ...channel,
        season: seasonInfo.season,
        episode: seasonInfo.episode,
      }

      // Add the episode to the season
      seriesInfo.seasons[seasonInfo.season].episodes.push(channelWithSeasonInfo)

      // Mark as processed
      processedIds.add(channel.id)
    } else {
      // If it doesn't have season/episode information, consider it a standalone channel
      standaloneChannels.push(channel)
      processedIds.add(channel.id)
    }
  })

  // Sort episodes within each season
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

  // Convert the map to an array
  const seriesArray = Array.from(seriesMap.values())

  // Debug log
  console.log(
    "Grouped series:",
    seriesArray.map((s) => ({
      name: s.name,
      seasons: Object.entries(s.seasons).map(([seasonNum, season]) => ({
        season: seasonNum,
        episodeCount: season.episodes.length,
        episodes: season.episodes.map((ep) => ({
          name: ep.name,
          isSubbed: ep.name.includes("[L]"),
          episode: ep.episode,
        })),
      })),
    })),
  )

  return {
    series: seriesArray,
    standaloneChannels,
  }
}

// Function to get the first episode of a series
export function getFirstEpisode(series: SeriesInfo): Channel | null {
  const seasonNumbers = Object.keys(series.seasons)
    .map(Number)
    .sort((a, b) => a - b)

  if (seasonNumbers.length === 0) return null

  const firstSeason = series.seasons[seasonNumbers[0]]
  if (firstSeason.episodes.length === 0) return null

  return firstSeason.episodes[0]
}

// Function to get all episodes of a series
export function getAllEpisodes(series: SeriesInfo): SeriesEpisode[] {
  const episodes: SeriesEpisode[] = []

  Object.entries(series.seasons).forEach(([seasonNum, season]) => {
    season.episodes.forEach((episode) => {
      episodes.push({
        ...episode,
        seasonNumber: season.number,
        episodeNumber: episode.episode || 0,
      })
    })
  })

  // Debug log
  console.log(
    "All episodes for series:",
    series.name,
    episodes.map((ep) => ({
      name: ep.name,
      season: ep.seasonNumber,
      episode: ep.episodeNumber,
      isSubbed: ep.name.includes("[L]"),
    })),
  )

  return episodes
}

