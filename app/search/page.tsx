"use client"

import type React from "react"

import { MediaCard } from "@/components/media-card"
import { SeriesPlayer } from "@/components/series-player"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VideoPlayer } from "@/components/video-player"
import { searchChannelsPaginated } from "@/lib/api-client"
import { groupChannelsIntoSeries } from "@/lib/series-manager"
import type { Channel } from "@/types/iptv"
import axios from "axios"
import { Loader2, Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get("q") || ""

  const [searchTerm, setSearchTerm] = useState(query)
  const [results, setResults] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<Channel | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<any | null>(null)
  const [series, setSeries] = useState<any[]>([])

  useEffect(() => {
    if (query) {
      performSearch(query)
    }
  }, [query])

  const performSearch = async (term: string) => {
    if (!term.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { channels } = await searchChannelsPaginated(term)
      setResults(channels)
      logSearchResults(channels, term)

      // Group channels into series
      const { series: seriesGroups } = groupChannelsIntoSeries(channels)
      setSeries(seriesGroups)
    } catch (err) {
      console.error("Search error:", err)
      setError("Falha ao buscar resultados. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    router.push(`/search?q=${encodeURIComponent(searchTerm)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const handleClearSearch = () => {
    setSearchTerm("")
    router.push("/search")
  }

  const handleItemClick = async (item: Channel) => {
    try {
      // Check if the item is a series
      const thumbReq = await axios.get(`/api/tmdb-thumbnail?title=${encodeURIComponent(item.name)}&type=auto`)

      if ((item as any).isSeries) {
        // Find the corresponding series
        const seriesItem = series.find((s) => s.id === item.id)

        if (seriesItem) {
          setSelectedSeries({ ...seriesItem, thumbnail: thumbReq.data.url ?? "/placeholder.svg" })
        }
      } else {
        setSelectedItem({ ...item, logo: thumbReq.data.url ?? "/placeholder.svg" })
      }
    } catch (error) {
      console.error("Error handling item click:", error)
    }
  }

  const handleClosePlayer = () => {
    setSelectedItem(null)
    setSelectedSeries(null)
  }

  const logSearchResults = (results: Channel[], term: string) => {
    if (process.env.NODE_ENV === "development") {
      console.group("Search Results for:", term)
      results.forEach((channel, index) => {
        console.log(`${index + 1}. ${channel.name}`)
      })
      console.groupEnd()
    }
  }

  // Get search words for display
  const searchWords = query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1)

  return (
    <div className="container mx-auto py-6 px-4">
      {selectedItem ? (
        <VideoPlayer item={selectedItem} onClose={handleClosePlayer} />
      ) : selectedSeries ? (
        <SeriesPlayer series={selectedSeries} onClose={handleClosePlayer} />
      ) : (
        <>
          <div className="mb-6 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar filmes, séries, etc..."
                className="pl-10 pr-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={handleClearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="mt-2 flex justify-center">
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
            </div>
          </div>

          <div className="mb-4">
            {query && (
              <div>
                <h1 className="text-2xl font-bold">
                  Resultados para: <span className="text-primary">{query}</span>
                  {results.length > 0 && (
                    <span className="text-sm text-muted-foreground ml-2">({results.length} encontrados)</span>
                  )}
                </h1>

                {/* Search mode indicator */}
                {searchWords.length > 1 && (
                  <div className="mt-2 flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">Buscando por:</span>
                    {searchWords.map((word, index) => (
                      <Badge key={index} variant="outline" className="mr-1">
                        {word}
                      </Badge>
                    ))}
                    <Badge variant="secondary" className="ml-2">
                      Modo: Todas as palavras (AND)
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">{error}</div>
          ) : results.length === 0 ? (
            <div className="text-center text-muted-foreground p-4">
              {query ? "Nenhum resultado encontrado com todas as palavras da busca." : "Digite algo para buscar."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((channel) => (
                <MediaCard key={channel.id} channel={channel} onClick={handleItemClick} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

