"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Tv,
  PlayCircle,
  Folder,
  Search,
  Loader2,
  RefreshCw,
  X,
  Globe,
  MessageSquare,
  Film,
  ListVideo,
} from "lucide-react"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoPlayer } from "@/components/video-player"
import { SeriesPlayer } from "@/components/series-player"
import { useMobile } from "@/hooks/use-mobile"
import { getAllCategories, getChannelsPaginated, searchChannelsPaginated, hasIPTVData } from "@/lib/idb-storage"
import { getThumbnail } from "@/lib/thumbnail-manager"
import type { Channel } from "@/types/iptv"
import { type SeriesInfo, groupChannelsIntoSeries, getFirstEpisode } from "@/lib/series-manager"

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

  // Carregar categorias e verificar se há conteúdo
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        const contentExists = await hasIPTVData()

        if (contentExists) {
          // Carregar categorias
          const allCategories = await getAllCategories()
          setCategories(allCategories)
          setHasContent(true)

          // Carregar primeira página de canais
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

  // Debounce para o termo de busca
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Não iniciar busca para termos muito curtos
    if (searchTerm.length === 1) {
      return
    }

    // Definir um timeout para atualizar o termo de busca debounced
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms de debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  // Função para carregar thumbnails personalizadas
  const loadThumbnails = async (channelIds: string[]) => {
    const newThumbnails: Record<string, string> = {}

    // Processar em lotes para não sobrecarregar
    const batchSize = 10
    for (let i = 0; i < channelIds.length; i += batchSize) {
      const batch = channelIds.slice(i, i + batchSize)

      // Processar cada item do lote em paralelo
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

    // Atualizar o estado com as novas thumbnails
    setThumbnails((prev) => ({ ...prev, ...newThumbnails }))
  }

  // Função para filtrar canais por tipo de áudio (dublado/legendado)
  const filterChannelsByAudioType = (channels: Channel[]): Channel[] => {
    if (audioType === "all") {
      return channels
    }

    return channels.filter((channel) => {
      const isSubbed = channel.name.includes("[L]")
      return audioType === "subbed" ? isSubbed : !isSubbed
    })
  }

  // Função atualizada para buscar thumbnails do TMDB via API
  const fetchTMDBThumbnail = async (item: Channel) => {
    try {
      // Verificar se já temos a thumbnail em cache
      if (tmdbThumbnails[item.id]) {
        return tmdbThumbnails[item.id]
      }

      // Limpar o título para busca (remover tags como [L], informações de temporada, etc.)
      const cleanTitle = item.name
        .replace(/\[L\]/g, "")
        .replace(/S\d+\s*E\d+/gi, "")
        .replace(/\d+x\d+/g, "")
        .trim()

      // Determinar se é um filme ou série com base na presença de season/episode
      const isEpisode = item.season !== undefined && item.episode !== undefined
      const type = isEpisode || (item as any).isSeries ? "tv" : "movie"

      // Fazer a requisição para o endpoint de API
      const response = await fetch(`/api/tmdb-thumbnail?title=${encodeURIComponent(cleanTitle)}&type=${type}`)

      if (!response.ok) {
        throw new Error("Falha ao buscar thumbnail")
      }

      const data = await response.json()

      // Se encontrou uma imagem, armazenar no cache
      if (data.url) {
        setTmdbThumbnails((prev) => ({
          ...prev,
          [item.id]: data.url,
        }))
        return data.url
      }

      return null
    } catch (error) {
      console.error(`Erro ao buscar thumbnail do TMDB para ${item.name}:`, error)
      return null
    }
  }

  // Função para carregar canais com paginação
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

        // Filtrar por tipo de áudio (dublado/legendado)
        const filteredByAudio = filterChannelsByAudioType(result.channels)

        // Agrupar canais em séries
        const { series, standaloneChannels } = groupChannelsIntoSeries(filteredByAudio)

        // Filtrar por tipo de visualização (séries/filmes)
        let displayedItems: Channel[] = []

        if (viewMode === "series") {
          // Mostrar apenas séries
          setSeries(series)
          setStandaloneChannels([])

          // Para cada série, pegar o primeiro episódio como representante
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
          // Mostrar apenas filmes (canais independentes)
          setSeries([])
          setStandaloneChannels(standaloneChannels)
          displayedItems = standaloneChannels
        } else {
          // Mostrar tudo
          setSeries(series)
          setStandaloneChannels(standaloneChannels)

          // Para cada série, pegar o primeiro episódio como representante
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

        // Atualizar o total de itens após a filtragem
        const totalFilteredCount = displayedItems.length

        // Verificar se há mais páginas após a filtragem
        const hasMoreAfterFilter = page * PAGE_SIZE + displayedItems.length < totalFilteredCount

        if (isFirstPage) {
          setChannels(displayedItems)
        } else {
          setChannels((prev) => [...prev, ...displayedItems])
        }

        // Carregar thumbnails personalizadas
        await loadThumbnails(displayedItems.map((channel) => channel.id))

        // Buscar thumbnails do TMDB para os primeiros itens (para não sobrecarregar a API)
        const fetchTMDBThumbnails = async () => {
          const itemsToFetch = displayedItems.slice(0, 20) // Limitar a 20 itens por vez

          for (const item of itemsToFetch) {
            await fetchTMDBThumbnail(item)
          }
        }

        fetchTMDBThumbnails()

        setTotalItems(totalFilteredCount)
        setHasMorePages(hasMoreAfterFilter)
        setCurrentPage(page)
      } catch (error) {
        console.error("Erro ao carregar canais:", error)
      } finally {
        setIsLoading(false)
        setIsSearching(false)
        setIsLoadingMore(false)
      }
    },
    [activeCategory, debouncedSearchTerm, audioType, viewMode],
  )

  // Carregar canais quando a categoria, termo de busca, tipo de áudio ou modo de visualização mudar
  useEffect(() => {
    if (hasContent) {
      // Resetar para a primeira página
      setCurrentPage(0)
      loadChannels(0)
    }
  }, [activeCategory, debouncedSearchTerm, audioType, viewMode, hasContent, loadChannels])

  // Carregar mais canais
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMorePages) {
      loadChannels(currentPage + 1)
    }
  }

  const handleItemClick = (item: Channel) => {
    // Verificar se o item é uma série
    if ((item as any).isSeries) {
      // Encontrar a série correspondente
      const seriesItem = series.find((s) => s.id === item.id)
      if (seriesItem) {
        setSelectedSeries(seriesItem)
      }
    } else {
      setSelectedItem(item)
    }
  }

  const handleClosePlayer = () => {
    // Recarregar thumbnails após fechar o player (caso tenha capturado novas)
    if (channels.length > 0) {
      loadThumbnails(channels.map((channel) => channel.id))
    }
    setSelectedItem(null)
    setSelectedSeries(null)
  }

  // Limpar busca
  const handleClearSearch = () => {
    setSearchTerm("")
    setDebouncedSearchTerm("")
  }

  // Função para obter o título da aba ativa
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
          {/* Sidebar com categorias */}
          <div className="w-full md:w-64 shrink-0">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
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

            {/* Filtro de tipo de conteúdo */}
            <div className="mt-4 bg-card rounded-lg border shadow-sm">
              <div className="p-3 font-medium border-b">
                <span>Tipo de Conteúdo</span>
              </div>
              <div className="p-2">
                <div className="flex flex-col space-y-1">
                  <Button
                    variant={viewMode === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("all")}
                    className="justify-start"
                  >
                    <Tv className="mr-2 h-4 w-4" />
                    Todos
                  </Button>
                  <Button
                    variant={viewMode === "series" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("series")}
                    className="justify-start"
                  >
                    <ListVideo className="mr-2 h-4 w-4" />
                    Séries
                  </Button>
                  <Button
                    variant={viewMode === "movies" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("movies")}
                    className="justify-start"
                  >
                    <Film className="mr-2 h-4 w-4" />
                    Filmes
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Área de conteúdo principal */}
          <div className="flex-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {debouncedSearchTerm
                  ? `Resultados para "${debouncedSearchTerm}" (${totalItems})`
                  : activeCategory === "all"
                    ? "Todos os Canais"
                    : activeCategory}
              </h2>
              {(isLoading || isSearching) && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSearching ? "Buscando..." : "Carregando..."}
                </div>
              )}
            </div>

            {/* Tabs para Dublado/Legendado */}
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
                                    src={item.logo || "/placeholder.svg"}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // Tentar buscar do TMDB quando a imagem falhar
                                      fetchTMDBThumbnail(item).then((url) => {
                                        if (url) {
                                          ;(e.target as HTMLImageElement).src = url
                                        } else {
                                          ;(e.target as HTMLImageElement).src = `/placeholder.svg?height=180&width=320`
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

                                {/* Indicador de Legendado */}
                                {item.name.includes("[L]") && (
                                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                                    LEG
                                  </div>
                                )}

                                {/* Indicador de Série */}
                                {(item as any).isSeries && (
                                  <div className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-xs px-1.5 py-0.5 rounded">
                                    SÉRIE
                                  </div>
                                )}
                              </div>
                              <CardHeader className="p-3">
                                <CardTitle className="text-base line-clamp-1">
                                  {/* Remover o [L] do título exibido */}
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

                        {/* Botão "Carregar mais" */}
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

