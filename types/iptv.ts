export interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group: string
  epg?: string
  season?: number
  episode?: number
}

export interface IPTVData {
  channels: Channel[]
  series: Series[]
  categories: string[]
}

export interface Series {
  id: string
  name: string
  seasons: Season[]
  poster?: string
}

export interface Season {
  number: number
  episodes: Episode[]
}

export interface Episode {
  id: string
  name: string
  url: string
  thumbnail?: string
  season: number
  episode: number
}

