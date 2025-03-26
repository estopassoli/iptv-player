"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoPlayer } from "@/components/video-player"
import { useMobile } from "@/hooks/use-mobile"
import { getAllCategories, getChannelsPaginated, hasIPTVData, searchChannelsPaginated } from "@/lib/idb-storage"
import { getThumbnail } from "@/lib/thumbnail-manager"
import { AnimatePresence, motion } from "framer-motion"
import { Folder, Globe, Loader2, MessageSquare, PlayCircle, RefreshCw, Search, Tv, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

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

interface Episode {
  id: string
  name: string
  url: string
  thumbnail?: string
  season: number
  episode: number
}

type AudioType = "all" | "dubbed" | "subbed"

export function IPTVContent() {
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [channels, setChannels] = useState<Channel[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedItem, setSelectedItem] = useState<Channel | Episode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMorePages, setHasMorePages] = useState(false)
  const [totalItems, setTotalItems] = useState(0)
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [audioType, setAudioType] = useState<AudioType>("all")
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
        const filteredChannels = filterChannelsByAudioType(result.channels)

        // Atualizar o total de itens após a filtragem
        const totalFilteredCount =
          audioType === "all"
            ? result.totalCount
            : result.channels.filter((channel) => {
              const isSubbed = channel.name.includes("[L]")
              return audioType === "subbed" ? isSubbed : !isSubbed
            }).length

        // Verificar se há mais páginas após a filtragem
        const hasMoreAfterFilter = page * PAGE_SIZE + filteredChannels.length < totalFilteredCount

        if (isFirstPage) {
          setChannels(filteredChannels)
        } else {
          setChannels((prev) => [...prev, ...filteredChannels])
        }

        // Carregar thumbnails personalizadas
        await loadThumbnails(filteredChannels.map((channel) => channel.id))

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
    [activeCategory, debouncedSearchTerm, audioType],
  )

  // Carregar canais quando a categoria, termo de busca ou tipo de áudio mudar
  useEffect(() => {
    if (hasContent) {
      // Resetar para a primeira página
      setCurrentPage(0)
      loadChannels(0)
    }
  }, [activeCategory, debouncedSearchTerm, audioType, hasContent, loadChannels])

  // Carregar mais canais
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMorePages) {
      loadChannels(currentPage + 1)
    }
  }

  const handleItemClick = (item: Channel | Episode) => {
    setSelectedItem(item)
  }

  const handleClosePlayer = () => {
    // Recarregar thumbnails após fechar o player (caso tenha capturado novas)
    if (channels.length > 0) {
      loadThumbnails(channels.map((channel) => channel.id))
    }
    setSelectedItem(null)
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
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          {/* Sidebar com categorias */}
          <div className="w-72">
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
              <ScrollArea className="h-[calc(100vh-300px)] flex flex-col w-full px-1">
                <div className="p-1">
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
                      className="w-full justify-start mb-1 truncate !capitalize"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <div className="border-r border-dashed" />
          {/* Área de conteúdo principal */}
          <div className="flex-1 truncate flex-grow-0">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {debouncedSearchTerm
                  ? `Resultados para "${debouncedSearchTerm}"`
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
              <TabsList className="ml-auto">
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

              <TabsContent value={audioType} className="mt-4 overflow-y-auto">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${activeCategory}-${debouncedSearchTerm}-${currentPage}-${audioType}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4"
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
                                  {thumbnails[item.id] ? (
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
                                        ; (e.target as HTMLImageElement).src = `/placeholder.svg?height=180&width=320`
                                      }}
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center h-full bg-primary/10">
                                      <Tv className="w-12 h-12 text-primary/40" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end p-3">
                                    <PlayCircle className="w-10 h-10" />
                                  </div>

                                  {/* Indicador de Legendado */}
                                  {item.name.includes("[L]") && (
                                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
                                      LEG
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
                                    {item.season && item.episode
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
                        <div className="col-span-full text-center py-10">
                          <p className="text-muted-foreground">
                            Nenhum conteúdo {getActiveTabTitle().toLowerCase()} encontrado para esta categoria ou busca.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  )
}

