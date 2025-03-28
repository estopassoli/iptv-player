"use client"

import { SeriesPlayer } from "@/components/series-player"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoPlayer } from "@/components/video-player"
import { useMobile } from "@/hooks/use-mobile"
import { getAllCategories, getChannelsPaginated, hasIPTVData, searchChannelsPaginated } from "@/lib/prisma-storage"
import { type SeriesInfo, getFirstEpisode, groupChannelsIntoSeries } from "@/lib/series-manager"
import { getThumbnail } from "@/lib/thumbnail-manager"
import { initializeUser } from "@/lib/user-service"
import type { Channel } from "@/types/iptv"
import axios from "axios"
import { AnimatePresence, motion } from "framer-motion"
import {
  Film,
  Folder,
  Globe,
  ListVideo,
  Loader2,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Search,
  Tv,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"

type AudioType = "all" | "dubbed" | "subbed"

export function IPTVContent() {
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [channels, setChannels] = useState<Channel[]>([])
  const [series, setSeries] = useState<SeriesInfo[]>([])
  const [standaloneChannels, setStandaloneChannels] = useState<Channel[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedItem, setSelectedItem] = useState<Channel | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<SeriesInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMorePages, setHasMorePages] = useState(false)
  const [totalItems, setTotalItems] = useState(0)
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [tmdbThumbnails, setTmdbThumbnails] = useState<Record<string, string>>({})
  const [audioType, setAudioType] = useState<AudioType>("all")
  const [viewMode, setViewMode] = useState<"all" | "series" | "movies">("all")
  const isMobile = useMobile()
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const PAGE_SIZE = 20

  // Initialize user and load initial data
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") return

    const loadInitialData = async () => {
      try {
        setIsLoading(true)

        // Initialize user
        await initializeUser()

        const contentExists = await hasIPTVData()

        if (contentExists) {
          // Load categories
          const allCategories = await getAllCategories()
          setCategories(allCategories)
          setHasContent(true)

          // Load first page of channels
          await loadChannels(0)
        } else {
          setHasContent(false)
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error)
        setHasContent(false)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [])

  // Debounce for search term
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't start search for very short terms
    if (searchTerm.length === 1) {
      return
    }

    // Set a timeout to update the debounced search term
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  // Function to load custom thumbnails
  const loadThumbnails = async (channelIds: string[]) => {
    const newThumbnails: Record<string, string> = {}

    // Process in batches to avoid overload
    const batchSize = 10
    for (let i = 0; i < channelIds.length; i += batchSize) {
      const batch = channelIds.slice(i, i + batchSize)

      // Process each item in the batch in parallel
      await Promise.all(
        batch.map(async (id) => {
          try {
            const thumbnail = await getThumbnail(id)
            if (thumbnail) {
              newThumbnails[id] = thumbnail
            }
          } catch (error) {
            console.error(`Erro ao carregar thumbnail para ${id}:`, error)
          }
        }),
      )
    }

    // Update state with new thumbnails
    setThumbnails((prev) => ({ ...prev, ...newThumbnails }))
  }

  // Function to filter channels by audio type (dubbed/subbed)
  const filterChannelsByAudioType = (channels: Channel[]): Channel[] => {
    if (audioType === "all") {
      return channels
    }

    return channels.filter((channel) => {
      // Check if the channel is subtitled by looking for [L] tag
      const isSubbed = channel.name.includes("[L]")

      // For "subbed" type, return channels with [L] tag
      // For "dubbed" type, return channels without [L] tag
      return audioType === "subbed" ? isSubbed : !isSubbed
    })
  }

  // Updated function to fetch TMDB thumbnails via API
  const fetchTMDBThumbnail = async (item: Channel) => {
    try {
      // Check if we already have the thumbnail in cache
      if (tmdbThumbnails[item.id]) {
        return tmdbThumbnails[item.id]
      }

      // Clean the title for search (remove tags like [L], season info, etc.)
      const cleanTitle = item.name
        .replace(/\[L\]/g, "")
        .replace(/S\d+\s*E\d+/gi, "")
        .replace(/\d+x\d+/g, "")
        .trim()

      // Determine if it's a movie or series based on season/episode presence
      const isEpisode = item.season !== undefined && item.episode !== undefined
      const type = isEpisode || (item as any).isSeries ? "tv" : "movie"

      // Make the request to the API endpoint
      const response = await fetch(`/api/tmdb-thumbnail?title=${encodeURIComponent(cleanTitle)}&type=${type}`)

      if (!response.ok) {
        throw new Error("Failed to fetch thumbnail")
      }

      const data = await response.json()

      // If an image was found, store it in cache
      if (data.url) {
        setTmdbThumbnails((prev) => ({
          ...prev,
          [item.id]: data.url,
        }))
        return data.url
      }

      return null
    } catch (error) {
      console.error(`Error fetching TMDB thumbnail for ${item.name}:`, error)
      return null
    }
  }

  // Function to load channels with pagination
  const loadChannels = useCallback(
    async (page: number) => {
      try {
        const isFirstPage = page === 0

        if (isFirstPage) {
          if (debouncedSearchTerm) {
            setIsSearching(true)
          } else {
            setIsLoading(true)
          }
        } else {
          setIsLoadingMore(true)
        }

        let result

        if (debouncedSearchTerm) {
          result = await searchChannelsPaginated(debouncedSearchTerm, activeCategory, page, PAGE_SIZE)
        } else {
          result = await getChannelsPaginated(activeCategory, page, PAGE_SIZE)
        }

        // Filter by audio type (dubbed/subbed)
        const filteredByAudio = filterChannelsByAudioType(result.channels)

        // Group channels into series
        const { series, standaloneChannels } = groupChannelsIntoSeries(filteredByAudio)

        // Debug log for series episodes
        console.log(
          "Series episodes by audio type:",
          audioType,
          series.map((s) => ({
            name: s.name,
            seasons: Object.entries(s.seasons).map(([seasonNum, season]) => ({
              season: seasonNum,
              episodes: season.episodes.map((ep) => ({
                name: ep.name,
                isSubbed: ep.name.includes("[L]"),
                episode: ep.episode,
              })),
            })),
          })),
        )

        // Debug log for series episodes
        console.log(
          "Series episodes by audio type:",
          series.map((s) => ({
            name: s.name,
            seasons: Object.entries(s.seasons).map(([seasonNum, season]) => ({
              season: seasonNum,
              episodes: season.episodes.map((ep) => ({
                name: ep.name,
                isSubbed: ep.name.includes("[L]"),
              })),
            })),
          })),
        )

        // Debug log
        console.log(
          "Series found:",
          series.map((s) => ({
            name: s.name,
            seasons: Object.keys(s.seasons)
              .map(Number)
              .sort((a, b) => a - b),
          })),
        )

        // Filter by view mode (series/movies)
        let displayedItems: Channel[] = []

        if (viewMode === "series") {
          // Show only series
          setSeries(series)
          setStandaloneChannels([])

          // For each series, get the first episode as representative
          displayedItems = series
            .map((serie) => {
              const firstEpisode = getFirstEpisode(serie)
              if (firstEpisode) {
                return {
                  ...firstEpisode,
                  id: serie.id,
                  name: serie.name,
                  isSeries: true,
                } as any
              }
              return null
            })
            .filter(Boolean) as Channel[]
        } else if (viewMode === "movies") {
          // Show only movies (standalone channels)
          setSeries([])
          setStandaloneChannels(standaloneChannels)
          displayedItems = standaloneChannels
        } else {
          // Show everything
          setSeries(series)
          setStandaloneChannels(standaloneChannels)

          // For each series, get the first episode as representative
          const seriesItems = series
            .map((serie) => {
              const firstEpisode = getFirstEpisode(serie)
              if (firstEpisode) {
                return {
                  ...firstEpisode,
                  id: serie.id,
                  name: serie.name,
                  isSeries: true,
                } as any
              }
              return null
            })
            .filter(Boolean) as Channel[]

          displayedItems = [...seriesItems, ...standaloneChannels]
        }

        // Update total items after filtering
        const totalFilteredCount = displayedItems.length

        // Check if there are more pages after filtering
        const hasMoreAfterFilter = page * PAGE_SIZE + displayedItems.length < totalFilteredCount

        if (isFirstPage) {
          setChannels(displayedItems)
        } else {
          setChannels((prev) => [...prev, ...displayedItems])
        }

        // Load custom thumbnails
        await loadThumbnails(displayedItems.map((channel) => channel.id))

        // Fetch TMDB thumbnails for the first items (to avoid overloading the API)
        const fetchTMDBThumbnails = async () => {
          const itemsToFetch = displayedItems.slice(0, 20) // Limit to 20 items at a time

          for (const item of itemsToFetch) {
            await fetchTMDBThumbnail(item)
          }
        }

        fetchTMDBThumbnails()

        setTotalItems(totalFilteredCount)
        setHasMorePages(hasMoreAfterFilter)
        setCurrentPage(page)
      } catch (error) {
        console.error("Error loading channels:", error)
      } finally {
        setIsLoading(false)
        setIsSearching(false)
        setIsLoadingMore(false)
      }
    },
    [activeCategory, debouncedSearchTerm, audioType, viewMode],
  )

  // Load channels when category, search term, audio type, or view mode changes
  useEffect(() => {
    if (hasContent) {
      // Reset to first page
      setCurrentPage(0)
      loadChannels(0)
    }
  }, [activeCategory, debouncedSearchTerm, audioType, viewMode, hasContent, loadChannels])

  // Load more channels
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMorePages) {
      loadChannels(currentPage + 1)
    }
  }

  const handleItemClick = async (item: Channel) => {
    // Check if the item is a series
    const thumbReq = await axios.get(`/api/tmdb-thumbnail?title=${encodeURIComponent(item.name)}&type=auto`)
    console.log(thumbReq)
    if ((item as any).isSeries) {
      // Find the corresponding series
      const seriesItem = series.find((s) => s.id === item.id)

      if (seriesItem) {
        setSelectedSeries({ ...seriesItem, thumbnail: thumbReq.data.url ?? "/placeholder.svg" })
      }
    } else {
      setSelectedItem({ ...item, logo: thumbReq.data.url ?? "/placeholder.svg" })
    }
  }

  const handleClosePlayer = () => {
    // Reload thumbnails after closing the player (in case new ones were captured)
    if (channels.length > 0) {
      loadThumbnails(channels.map((channel) => channel.id))
    }
    setSelectedItem(null)
    setSelectedSeries(null)
  }

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm("")
    setDebouncedSearchTerm("")
  }

  // Function to get the active tab title
  const getActiveTabTitle = () => {
    switch (audioType) {
      case "dubbed":
        return "Dublado"
      case "subbed":
        return "Legendado"
      default:
        return "Todos"
    }
  }

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Folder className="w-16 h-16 mb-4 text-muted-foreground" />
        <h3 className="text-xl font-medium mb-2">Nenhum conteúdo carregado</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Faça upload de um arquivo .m3u ou insira uma URL para visualizar seu conteúdo IPTV.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-8">
      {selectedItem ? (
        <VideoPlayer item={selectedItem} onClose={handleClosePlayer} />
      ) : selectedSeries ? (
        <SeriesPlayer series={selectedSeries} onClose={handleClosePlayer} />
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar with categories */}
          <div className="w-full md:w-64 shrink-0">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar canais..."
                className="pl-10 pr-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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

            <div className="bg-card rounded-lg border shadow-sm">
              <div className="p-3 font-medium border-b flex justify-between items-center">
                <span>Categorias</span>
                <Badge variant="outline">{totalItems}</Badge>
              </div>
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="p-2">
                  <Button
                    variant={activeCategory === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveCategory("all")}
                    className="w-full justify-start mb-1"
                  >
                    Todos
                  </Button>

                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={activeCategory === category ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveCategory(category)}
                      className="w-full justify-start mb-1 truncate"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Content type filter */}

          </div>

          {/* Main content area */}
          <div className="flex-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {debouncedSearchTerm
                  ? `Resultados para "${debouncedSearchTerm}" (${totalItems})`
                  : activeCategory === "all"
                    ? "Todos os Canais"
                    : activeCategory}
              </h2>

              <div className="flex items-center gap-2">

                {(isLoading || isSearching) && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isSearching ? "Buscando..." : "Carregando..."}
                  </div>
                )}


                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Film className="h-4 w-4" />
                      {viewMode === "all"
                        ? "Todos"
                        : viewMode === "series"
                          ? "Séries"
                          : "Filmes"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewMode("all")}>
                      Todos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setViewMode("series")}>
                      Séries
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setViewMode("movies")}>
                      Filmes
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Tabs for Dubbed/Subbed */}
            <Tabs
              defaultValue="all"
              value={audioType}
              onValueChange={(value) => setAudioType(value as AudioType)}
              className="mb-6"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <Tv className="h-4 w-4" />
                  <span>Todos</span>
                </TabsTrigger>
                <TabsTrigger value="dubbed" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Dublado</span>
                </TabsTrigger>
                <TabsTrigger value="subbed" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Legendado</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value={audioType} className="mt-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeCategory}-${debouncedSearchTerm}-${currentPage}-${audioType}-${viewMode}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  >
                    {(isLoading || isSearching) && channels.length === 0 ? (
                      <div className="col-span-full flex justify-center py-10">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : channels.length > 0 ? (
                      <>
                        {channels.map((item) => (
                          <motion.div key={item.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                            <Card
                              className="overflow-hidden h-full cursor-pointer"
                              onClick={() => handleItemClick(item)}
                            >
                              <div className="aspect-video bg-muted relative overflow-hidden">
                                {tmdbThumbnails[item.id] ? (
                                  <img
                                    src={tmdbThumbnails[item.id] || "/placeholder.svg"}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : thumbnails[item.id] ? (
                                  <img
                                    src={thumbnails[item.id] || "/placeholder.svg"}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : item.logo ? (
                                  <img
                                    src={thumbnails[item.id] || "/placeholder.svg"}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // Try to fetch from TMDB when image fails
                                      fetchTMDBThumbnail(item).then((url) => {
                                        if (url) {
                                          ; (e.target as HTMLImageElement).src = url
                                        } else {
                                          ; (e.target as HTMLImageElement).src = `/placeholder.svg?height=180&width=320`
                                        }
                                      })
                                    }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full bg-primary/10">
                                    {(item as any).isSeries ? (
                                      <ListVideo className="w-12 h-12 text-primary/40" />
                                    ) : (
                                      <Tv className="w-12 h-12 text-primary/40" />
                                    )}
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end p-3">
                                  <PlayCircle className="w-10 h-10 text-primary" />
                                </div>

                                {/* Subbed indicator */}
                                {item.name.includes("[L]") && (
                                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                                    LEG
                                  </div>
                                )}

                                {/* Series indicator */}
                                {(item as any).isSeries && (
                                  <div className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-xs px-1.5 py-0.5 rounded">
                                    SÉRIE
                                  </div>
                                )}
                              </div>
                              <CardHeader className="p-3">
                                <CardTitle className="text-base line-clamp-1">
                                  {/* Remove [L] from displayed title */}
                                  {item.name.replace("[L]", "").trim()}
                                </CardTitle>
                              </CardHeader>
                              <CardFooter className="p-3 pt-0">
                                <Badge variant="outline">
                                  {(item as any).isSeries
                                    ? "Série"
                                    : item.season && item.episode
                                      ? `S${item.season.toString().padStart(2, "0")}E${item.episode.toString().padStart(2, "0")}`
                                      : item.group}
                                </Badge>
                              </CardFooter>
                            </Card>
                          </motion.div>
                        ))}

                        {/* "Load more" button */}
                        {hasMorePages && (
                          <div className="col-span-full flex justify-center py-4">
                            <Button
                              variant="outline"
                              onClick={handleLoadMore}
                              disabled={isLoadingMore}
                              className="flex items-center gap-2"
                            >
                              {isLoadingMore ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Carregando...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4" />
                                  Carregar mais
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      channels.length === 0 &&
                      !isLoading &&
                      !isSearching && (
                        <div className="col-span-full text-center py-10">
                          <p className="text-muted-foreground">
                            {debouncedSearchTerm
                              ? `Nenhum resultado encontrado para "${debouncedSearchTerm}". Tente termos diferentes ou mais gerais.`
                              : `Nenhum conteúdo ${getActiveTabTitle().toLowerCase()} encontrado para esta categoria.`}
                          </p>
                        </div>
                      )
                    )}
                  </motion.div>
                </AnimatePresence>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  )
}