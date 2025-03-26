"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  X,
  Maximize,
  Volume2,
  Play,
  Pause,
  Loader2,
  Camera,
  AlertCircle,
  RefreshCw,
  Globe,
  MessageSquare,
  Tv,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useMobile } from "@/hooks/use-mobile"
import { saveThumbnail } from "@/lib/thumbnail-manager"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { type SeriesInfo, type SeriesEpisode, getAllEpisodes } from "@/lib/series-manager"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MediaInfoCard } from "@/components/media-info-card"

type AudioType = "all" | "dubbed" | "subbed"

interface SeriesPlayerProps {
  series: SeriesInfo
  initialEpisode?: SeriesEpisode
  onClose: () => void
}

export function SeriesPlayer({ series, initialEpisode, onClose }: SeriesPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isMobile = useMobile()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [capturingThumbnail, setCapturingThumbnail] = useState(false)
  const [thumbnailCaptured, setThumbnailCaptured] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [currentEpisode, setCurrentEpisode] = useState<SeriesEpisode | undefined>(initialEpisode)
  const [allEpisodes, setAllEpisodes] = useState<SeriesEpisode[]>([])
  const [audioType, setAudioType] = useState<AudioType>("all")
  const [controlsVisible, setControlsVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hideControlsTimeout, setHideControlsTimeout] = useState<NodeJS.Timeout | null>(null)
  const [seriesId, setSeriesId] = useState<number | null>(null)

  // Função para mostrar controles e configurar timeout para escondê-los
  const showControls = () => {
    setControlsVisible(true)

    // Limpar timeout existente
    if (hideControlsTimeout) {
      clearTimeout(hideControlsTimeout)
    }

    // Configurar novo timeout para esconder controles após 3 segundos
    const timeout = setTimeout(() => {
      if (!videoRef.current?.paused) {
        setControlsVisible(false)
      }
    }, 3000)

    setHideControlsTimeout(timeout)
  }

  // Função para atualizar o progresso do vídeo
  const updateProgress = () => {
    if (videoRef.current) {
      const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100
      setProgress(currentProgress)
    }
  }

  // Função para definir o tempo do vídeo ao clicar na barra de progresso
  const setVideoTime = (e: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = e.currentTarget
    const clickPosition = e.nativeEvent.offsetX
    const progressBarWidth = progressBar.clientWidth
    const seekPercentage = clickPosition / progressBarWidth

    if (videoRef.current) {
      videoRef.current.currentTime = seekPercentage * videoRef.current.duration
    }
  }

  // Função para alternar tela cheia
  const toggleFullscreen = () => {
    if (!playerRef.current) return

    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Função para alternar mudo
  const toggleMute = () => {
    if (!videoRef.current) return

    const newMutedState = !videoRef.current.muted
    videoRef.current.muted = newMutedState
    setIsMuted(newMutedState)
  }

  // Função para ajustar volume
  const adjustVolume = (value: number) => {
    if (!videoRef.current) return

    const newVolume = Math.max(0, Math.min(1, value))
    videoRef.current.volume = newVolume
    setVolume(newVolume)

    if (newVolume === 0) {
      videoRef.current.muted = true
      setIsMuted(true)
    } else if (isMuted) {
      videoRef.current.muted = false
      setIsMuted(false)
    }
  }

  // Organizar episódios por temporada
  useEffect(() => {
    const episodes = getAllEpisodes(series)
    setAllEpisodes(episodes)

    // Se não houver episódio inicial, usar o primeiro
    if (!currentEpisode && episodes.length > 0) {
      setCurrentEpisode(episodes[0])
    }
  }, [series, currentEpisode])

  // Função para obter a URL real do vídeo
  const fetchVideoUrl = async (episodeUrl: string) => {
    try {
      setFetchingUrl(true)
      setIsLoading(true)
      setError(null)
      setIsRetrying(false)

      console.log("Obtendo URL real do vídeo:", episodeUrl)

      // Fazer uma solicitação para obter a URL real do vídeo
      const response = await fetch(`/api/resolve-video-url?url=${encodeURIComponent(episodeUrl)}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Falha ao obter URL do vídeo")
      }

      const data = await response.json()

      if (!data.videoUrl) {
        throw new Error("URL do vídeo não encontrada")
      }

      console.log("URL real do vídeo obtida:", data.videoUrl, "Proxied:", data.proxied)
      setVideoUrl(data.videoUrl)
    } catch (err) {
      console.error("Erro ao obter URL do vídeo:", err)
      setError(`Não foi possível obter o link do vídeo: ${err instanceof Error ? err.message : "Erro desconhecido"}`)
    } finally {
      setFetchingUrl(false)
    }
  }

  // Carregar URL do vídeo quando o episódio mudar
  useEffect(() => {
    if (currentEpisode?.url) {
      fetchVideoUrl(currentEpisode.url)
    }
  }, [currentEpisode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === " " || e.key === "k") {
        // Espaço ou tecla K para play/pause
        togglePlay()
      } else if (e.key === "i") {
        // Tecla I para alternar informações de mídia
        //setShowMediaInfo((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  useEffect(() => {
    // Configurar o player de vídeo quando a URL estiver disponível
    if (!videoUrl || !videoRef.current) return

    const video = videoRef.current

    // Adicionar event listeners para monitorar o estado do vídeo
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleError = (e: Event) => {
      console.error("Erro ao reproduzir vídeo:", e)

      // Verificar se é um erro de conteúdo misto
      const target = e.target as HTMLVideoElement
      const errorCode = target.error?.code
      const errorMessage = target.error?.message || ""

      if (
        errorMessage.includes("Mixed Content") ||
        errorMessage.includes("CORS") ||
        errorMessage.includes("blocked") ||
        (videoUrl.startsWith("http:") && window.location.protocol === "https:")
      ) {
        setError("Erro de segurança: O vídeo está em HTTP mas a página está em HTTPS. Tente novamente usando o proxy.")
      } else {
        setError(`Não foi possível reproduzir este conteúdo. ${errorMessage}`)
      }

      setIsLoading(false)
    }
    const handleWaiting = () => setIsLoading(true)
    const handlePlaying = () => setIsLoading(false)
    const handleCanPlay = () => {
      setIsLoading(false)
      setDuration(video.duration)

      // Tentar iniciar a reprodução automaticamente
      video.play().catch((err) => {
        console.warn("Reprodução automática bloqueada:", err)
        setIsPlaying(false)
      })

      // Tentar entrar em tela cheia automaticamente
      if (playerRef.current && !isFullscreen) {
        try {
          playerRef.current.requestFullscreen().catch((err) => {
            console.warn("Tela cheia automática bloqueada:", err)
          })
          setIsFullscreen(true)
        } catch (err) {
          console.warn("Erro ao tentar entrar em tela cheia:", err)
        }
      }
    }

    const handleTimeUpdate = () => {
      updateProgress()
    }

    const handleVolumeChange = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)
    video.addEventListener("waiting", handleWaiting)
    video.addEventListener("playing", handlePlaying)
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("volumechange", handleVolumeChange)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    // Limpar event listeners
    return () => {
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("error", handleError)
      video.removeEventListener("waiting", handleWaiting)
      video.removeEventListener("playing", handlePlaying)
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("volumechange", handleVolumeChange)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)

      // Limpar timeout ao desmontar
      if (hideControlsTimeout) {
        clearTimeout(hideControlsTimeout)
      }
    }
  }, [videoUrl, hideControlsTimeout, isFullscreen])

  // Adicionar event listeners para mostrar/esconder controles ao mover o mouse
  useEffect(() => {
    if (!playerRef.current) return

    const player = playerRef.current

    const handleMouseMove = () => {
      showControls()
    }

    const handleMouseLeave = () => {
      if (!videoRef.current?.paused) {
        setControlsVisible(false)
        if (hideControlsTimeout) {
          clearTimeout(hideControlsTimeout)
          setHideControlsTimeout(null)
        }
      }
    }

    player.addEventListener("mousemove", handleMouseMove)
    player.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      player.removeEventListener("mousemove", handleMouseMove)
      player.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [hideControlsTimeout])

  const togglePlay = () => {
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current.play().catch((err) => {
        console.error("Erro ao reproduzir:", err)
        setError("Não foi possível reproduzir este conteúdo.")
      })
    } else {
      videoRef.current.pause()
    }
  }

  // Função para trocar de episódio
  const changeEpisode = (episode: SeriesEpisode) => {
    if (currentEpisode?.id === episode.id) return

    // Pausar o vídeo atual
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }

    setCurrentEpisode(episode)
  }

  // Função para tentar novamente com proxy forçado
  const retryWithProxy = async () => {
    if (!currentEpisode) return

    try {
      setIsRetrying(true)
      setError(null)

      // Forçar o uso do proxy
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(currentEpisode.url)}`
      setVideoUrl(proxyUrl)
    } catch (error) {
      console.error("Erro ao tentar com proxy:", error)
      setError("Falha ao tentar com proxy. Por favor, tente novamente mais tarde.")
    } finally {
      setIsRetrying(false)
    }
  }

  // Função para capturar thumbnail do vídeo atual
  const captureThumbnail = async () => {
    if (!currentEpisode) return

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || video.readyState < 2) {
      console.error("Vídeo não está pronto para captura")
      return
    }

    try {
      setCapturingThumbnail(true)

      // Pausar o vídeo se estiver reproduzindo
      const wasPlaying = !video.paused
      if (wasPlaying) video.pause()

      // Avançar para 15 minutos (ou 10% da duração se for menor que 15 minutos)
      const targetTime = Math.min(15 * 60, video.duration * 0.1)
      video.currentTime = targetTime

      // Esperar o vídeo carregar o frame
      await new Promise<void>((resolve) => {
        const handleSeeked = () => {
          video.removeEventListener("seeked", handleSeeked)
          resolve()
        }
        video.addEventListener("seeked", handleSeeked)
      })

      // Capturar o frame
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Não foi possível obter contexto do canvas")

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Converter para base64
      const thumbnailData = canvas.toDataURL("image/jpeg", 0.8)

      // Salvar thumbnail
      await saveThumbnail(currentEpisode.id, thumbnailData)

      // Retornar ao estado anterior
      if (wasPlaying) video.play()

      setThumbnailCaptured(true)
      setTimeout(() => setThumbnailCaptured(false), 3000) // Mostrar confirmação por 3 segundos
    } catch (error) {
      console.error("Erro ao capturar thumbnail:", error)
    } finally {
      setCapturingThumbnail(false)
    }
  }

  // Filtrar episódios por tipo de áudio (dublado/legendado)
  const filteredEpisodes = allEpisodes.filter((episode) => {
    if (audioType === "all") return true
    const isSubbed = episode.name.includes("[L]")
    return audioType === "subbed" ? isSubbed : !isSubbed
  })

  // Agrupar episódios por temporada para o accordion
  const seasonEpisodes = Object.entries(series.seasons)
    .sort(([seasonA], [seasonB]) => Number.parseInt(seasonA) - Number.parseInt(seasonB))
    .map(([season, data]) => {
      // Filtrar episódios desta temporada pelo tipo de áudio
      const filteredSeasonEpisodes = data.episodes.filter((episode) => {
        if (audioType === "all") return true
        const isSubbed = episode.name.includes("[L]")
        return audioType === "subbed" ? isSubbed : !isSubbed
      })

      return {
        season: Number.parseInt(season),
        episodes: filteredSeasonEpisodes,
      }
    })
    // Remover temporadas sem episódios após filtragem
    .filter((season) => season.episodes.length > 0)

  // Renderizar tela de carregamento enquanto busca a URL
  if (fetchingUrl || isRetrying) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <Card className="w-full max-w-md relative">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {isRetrying ? "Tentando novamente com proxy..." : "Carregando vídeo"}
            </h3>
            <p className="text-muted-foreground text-center">
              {isRetrying ? "Estabelecendo conexão segura..." : "Obtendo link de reprodução..."}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <Card className="w-full max-w-6xl relative">
        <Button variant="ghost" size="icon" className="absolute right-2 top-2 z-10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>

        <div className="flex flex-col lg:flex-row">
          {/* Player de vídeo */}
          <div className="lg:w-2/3">
            <CardContent className="p-0 overflow-hidden" ref={playerRef}>
              <div className="aspect-video relative">
                {error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-4 text-center">
                    <Alert variant="destructive" className="max-w-md mb-4">
                      <AlertCircle className="h-5 w-5" />
                      <AlertTitle>Erro ao carregar vídeo</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>

                    <div className="flex gap-3 mt-2">
                      <Button variant="outline" onClick={onClose}>
                        Voltar
                      </Button>
                      <Button variant="default" onClick={retryWithProxy} className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Tentar com proxy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {videoUrl && currentEpisode && (
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full"
                        poster={currentEpisode.logo || series.thumbnail || "/placeholder.svg?height=720&width=1280"}
                        crossOrigin="anonymous"
                      />
                    )}

                    {/* Canvas escondido para captura de thumbnail */}
                    <canvas ref={canvasRef} className="hidden" />

                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      </div>
                    )}

                    {/* Controles estilo Netflix */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 ${
                        controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                      onClick={togglePlay}
                    >
                      {/* Título e informações no topo */}
                      <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                        <div>
                          <h2 className="text-white text-xl font-semibold drop-shadow-md">
                            {series.name}
                            {currentEpisode?.seasonNumber !== undefined &&
                              currentEpisode?.episodeNumber !== undefined && (
                                <span className="ml-2 text-sm text-white/80">
                                  S{currentEpisode.seasonNumber.toString().padStart(2, "0")}E
                                  {currentEpisode.episodeNumber.toString().padStart(2, "0")}
                                </span>
                              )}
                          </h2>
                          {currentEpisode && (
                            <p className="text-white/80 text-sm drop-shadow-md">
                              {currentEpisode.name.replace(/\[L\]/g, "").trim()}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            onClose()
                          }}
                        >
                          <X className="h-6 w-6" />
                        </Button>
                      </div>

                      {/* Botão de play/pause centralizado */}
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isPlaying && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-20 w-20 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20"
                            onClick={togglePlay}
                          >
                            <Play className="h-10 w-10 text-white" />
                          </Button>
                        )}
                      </div>

                      {/* Controles inferiores */}
                      <div
                        className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Barra de progresso */}
                        <div
                          className="w-full h-1 bg-white/30 rounded-full mb-4 cursor-pointer relative"
                          onClick={setVideoTime}
                        >
                          <div
                            className="absolute top-0 left-0 h-full bg-primary rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                          <div
                            className="absolute top-0 left-0 h-3 w-3 bg-primary rounded-full -mt-1"
                            style={{ left: `${progress}%` }}
                          />
                        </div>

                        {/* Botões de controle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <Button variant="ghost" size="icon" className="text-white" onClick={togglePlay}>
                              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                            </Button>

                            {/* Controle de volume */}
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="icon" className="text-white" onClick={toggleMute}>
                                {isMuted ? (
                                  <Volume2 className="h-5 w-5 text-white/50" />
                                ) : (
                                  <Volume2 className="h-5 w-5" />
                                )}
                              </Button>
                              <div className="w-20 h-1 bg-white/30 rounded-full cursor-pointer hidden md:block">
                                <div
                                  className="h-full bg-white rounded-full"
                                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                                  onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const x = e.clientX - rect.left
                                    adjustVolume(x / rect.width)
                                  }}
                                />
                              </div>
                            </div>

                            {/* Tempo */}
                            <div className="text-white text-sm hidden md:block">
                              {videoRef.current
                                ? `${Math.floor(videoRef.current.currentTime / 60)}:${Math.floor(
                                    videoRef.current.currentTime % 60,
                                  )
                                    .toString()
                                    .padStart(2, "0")} / ${Math.floor(duration / 60)}:${Math.floor(duration % 60)
                                    .toString()
                                    .padStart(2, "0")}`
                                : "0:00 / 0:00"}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Botão para capturar thumbnail */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-white"
                              onClick={captureThumbnail}
                              disabled={capturingThumbnail || isLoading}
                            >
                              {capturingThumbnail ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Camera className="h-5 w-5" />
                              )}
                            </Button>

                            {/* Botão de tela cheia */}
                            <Button variant="ghost" size="icon" className="text-white" onClick={toggleFullscreen}>
                              <Maximize className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notificação de thumbnail capturada */}
                    {thumbnailCaptured && (
                      <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-2 rounded-md text-sm animate-fade-in-out">
                        Thumbnail capturada com sucesso!
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-4">
                <h2 className="text-xl font-semibold">
                  {currentEpisode ? (
                    <>
                      {series.name}
                      {currentEpisode.seasonNumber !== undefined && currentEpisode.episodeNumber !== undefined && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          S{currentEpisode.seasonNumber.toString().padStart(2, "0")}E
                          {currentEpisode.episodeNumber.toString().padStart(2, "0")}
                        </span>
                      )}
                    </>
                  ) : (
                    series.name
                  )}
                </h2>
                {currentEpisode && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentEpisode.name.replace(/\[L\]/g, "").trim()}
                  </p>
                )}
              </div>

              {/* Informações de mídia do TMDB - sempre visíveis */}
              <div className="px-4 pb-4">
                <MediaInfoCard
                  title={series.name}
                  type="tv"
                  season={currentEpisode?.seasonNumber}
                  episode={currentEpisode?.episodeNumber}
                />
              </div>
            </CardContent>
          </div>

          {/* Lista de episódios */}
          <div className="lg:w-1/3 border-t lg:border-t-0 lg:border-l">
            <div className="p-4 border-b">
              <h3 className="font-medium">Episódios</h3>
            </div>

            <Tabs defaultValue="all" value={audioType} onValueChange={(value) => setAudioType(value as AudioType)}>
              <div className="px-4 pt-4">
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
              </div>

              <TabsContent value={audioType}>
                <ScrollArea className="h-[400px] lg:h-[600px]">
                  <div className="p-4">
                    {seasonEpisodes.length > 0 ? (
                      <Accordion type="multiple" defaultValue={[`season-${seasonEpisodes[0]?.season}`]}>
                        {seasonEpisodes.map(({ season, episodes }) => (
                          <AccordionItem key={`season-${season}`} value={`season-${season}`}>
                            <AccordionTrigger className="hover:bg-muted/50 px-2 rounded-md">
                              <div className="flex items-center">
                                <span>Temporada {season}</span>
                                <Badge variant="outline" className="ml-2">
                                  {episodes.length}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-1 pl-2">
                                {episodes.map((episode) => (
                                  <div
                                    key={episode.id}
                                    className={`p-2 rounded-md cursor-pointer flex items-center hover:bg-muted ${
                                      currentEpisode?.id === episode.id ? "bg-primary/10 text-primary" : ""
                                    }`}
                                    onClick={() =>
                                      changeEpisode({
                                        ...episode,
                                        seasonNumber: season,
                                        episodeNumber: episode.episode || 0,
                                      })
                                    }
                                  >
                                    <div className="mr-2 w-6 text-center text-sm">{episode.episode}</div>
                                    <div className="flex-1 truncate">{episode.name.replace(/\[L\]/g, "").trim()}</div>
                                    {episode.name.includes("[L]") && (
                                      <Badge variant="outline" className="ml-2 text-xs">
                                        LEG
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>
                          Nenhum episódio{" "}
                          {audioType === "dubbed" ? "dublado" : audioType === "subbed" ? "legendado" : ""} disponível.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

