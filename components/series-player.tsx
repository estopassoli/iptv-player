"use client"

import type React from "react"

import { MediaInfoCard } from "@/components/media-info-card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMobile } from "@/hooks/use-mobile"
import { type SeriesEpisode, type SeriesInfo, getAllEpisodes } from "@/lib/series-manager"
import { saveThumbnail } from "@/lib/thumbnail-manager"
import { motion } from "framer-motion"
import {
  AlertCircle,
  Globe,
  Loader2,
  Maximize,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Tv,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

type AudioType = "all" | "dubbed" | "subbed"

interface SeriesPlayerProps {
  series: SeriesInfo
  initialEpisode?: SeriesEpisode
  onClose: () => void
}

// Certifique-se de que todas as temporadas sejam exibidas e que o accordion esteja aberto por padrão
export function SeriesPlayer({ series, onClose }: { series: SeriesInfo; onClose: () => void }) {
  const [selectedEpisode, setSelectedEpisode] = useState<SeriesEpisode | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffering, setBuffering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [defaultOpenValues, setDefaultOpenValues] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMobile = useMobile()
  const [isLoading, setIsLoading] = useState(true)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [capturingThumbnail, setCapturingThumbnail] = useState(false)
  const [thumbnailCaptured, setThumbnailCaptured] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [currentEpisode, setCurrentEpisode] = useState<SeriesEpisode | undefined>(undefined)
  const [allEpisodes, setAllEpisodes] = useState<SeriesEpisode[]>([])
  const [audioType, setAudioType] = useState<AudioType>("all")
  const [controlsVisible, setControlsVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const [hideControlsTimeout, setHideControlsTimeout] = useState<NodeJS.Timeout | null>(null)
  const [lastClickTime, setLastClickTime] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [bufferProgress, setBufferProgress] = useState(0)
  const [seekInProgress, setSeekInProgress] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [seekTime, setSeekTime] = useState<number | null>(null)
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Definir todas as temporadas como abertas por padrão
  useEffect(() => {
    // Criar um array com todas as temporadas para abrir por padrão
    const seasonKeys = Object.keys(series.seasons).map((season) => `season-${season}`)
    console.log("Definindo temporadas para abrir:", seasonKeys)
    setDefaultOpenValues(seasonKeys)
  }, [series.seasons])

  // Função para selecionar um episódio
  const handleSelectEpisode = (episode: SeriesEpisode) => {
    setCurrentEpisode(episode)
    setError(null)
    setIsPlaying(false) // Alterado para false para evitar reprodução automática
  }

  // Selecionar o primeiro episódio por padrão
  useEffect(() => {
    // Encontrar a primeira temporada (menor número)
    const seasonNumbers = Object.keys(series.seasons)
      .map(Number)
      .sort((a, b) => a - b)

    console.log("Temporadas disponíveis:", seasonNumbers)

    if (seasonNumbers.length > 0) {
      const firstSeason = series.seasons[seasonNumbers[0]]
      if (firstSeason.episodes.length > 0) {
        handleSelectEpisode({
          ...firstSeason.episodes[0],
          seasonNumber: seasonNumbers[0],
          episodeNumber: firstSeason.episodes[0].episode || 0,
        })
      }
    }
  }, [series])

  // Função para mostrar controles e configurar timeout para escondê-los
  const showControlsFunc = () => {
    setControlsVisible(true)

    // Limpar timeout existente
    if (hideControlsTimeout) {
      clearTimeout(hideControlsTimeout)
    }

    // Configurar novo timeout para esconder controles após 4 segundos
    const timeout = setTimeout(() => {
      if (!videoRef.current?.paused) {
        setControlsVisible(false)
      }
    }, 4000) // Changed from 3000 to 4000

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

    if (videoRef.current && !seekInProgress && videoRef.current.readyState >= 1) {
      try {
        setSeekInProgress(true)
        setIsBuffering(true)

        // Calcular o tempo baseado na porcentagem
        const newTime = seekPercentage * videoRef.current.duration

        // Garantir que o tempo não exceda a duração do vídeo
        const safeTime = Math.min(newTime, videoRef.current.duration - 0.1)

        // Mostrar o tempo de seek no UI
        setSeekTime(safeTime)

        // Limpar qualquer timeout anterior
        if (seekTimeoutRef.current) {
          clearTimeout(seekTimeoutRef.current)
        }

        // Definir um timeout para limpar o tempo de seek após 2 segundos
        seekTimeoutRef.current = setTimeout(() => {
          setSeekTime(null)
          seekTimeoutRef.current = null
        }, 2000)

        // Aplicar o seek
        videoRef.current.currentTime = safeTime
      } catch (err) {
        console.error("Erro ao definir tempo do vídeo:", err)
        // Ignorar erros de decode que não interrompem a reprodução
        if (err instanceof DOMException && err.name === "NotSupportedError") {
          console.warn("Erro de decode ignorado durante seek")
        }
      } finally {
        // Resetar o estado de seek após um pequeno delay
        setTimeout(() => {
          setSeekInProgress(false)
        }, 500)
      }
    }
  }

  // Função para alternar tela cheia
  const toggleFullscreen = () => {
    if (!playerRef.current) return

    try {
      if (!document.fullscreenElement) {
        playerRef.current
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true)
          })
          .catch((err) => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`)
          })
      } else {
        document
          .exitFullscreen()
          .then(() => {
            setIsFullscreen(false)
          })
          .catch((err) => {
            console.error(`Error attempting to exit fullscreen: ${err.message}`)
          })
      }
    } catch (err) {
      console.error("Fullscreen API error:", err)
    }
  }

  // Função para detectar duplo clique
  const handleVideoClick = (e: React.MouseEvent) => {
    const currentTime = new Date().getTime()
    const timeDiff = currentTime - lastClickTime

    // Se o tempo entre cliques for menor que 300ms, é um duplo clique
    if (timeDiff < 300) {
      toggleFullscreen()
    } else {
      togglePlay()
    }

    setLastClickTime(currentTime)
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

    // Preparar os valores do accordion para abrir todas as temporadas
    const seasonValues = Object.keys(series.seasons).map((season) => `season-${season}`)
    setDefaultOpenValues(seasonValues)
  }, [series])

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

    // Configurar preload para melhorar a experiência de seek
    video.preload = "auto"

    // Adicionar event listeners para monitorar o estado do vídeo
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleError = (e: Event) => {
      console.error("Erro ao reproduzir vídeo:", e)

      // Verificar se é um erro de conteúdo misto
      const target = e.target as HTMLVideoElement
      const errorCode = target.error?.code
      const errorMessage = target.error?.message || ""

      // Se não houver código de erro ou mensagem, usar uma mensagem genérica
      if (!errorCode && !errorMessage) {
        setError("Erro desconhecido ao reproduzir o vídeo. Tente novamente ou use o proxy.")
        setIsLoading(false)
        return
      }

      if (
        errorMessage.includes("Mixed Content") ||
        errorMessage.includes("CORS") ||
        errorMessage.includes("blocked") ||
        (videoUrl?.startsWith("http:") && window.location.protocol === "https:")
      ) {
        setError("Erro de segurança: O vídeo está em HTTP mas a página está em HTTPS. Tente novamente usando o proxy.")
      } else {
        setError(`Não foi possível reproduzir este conteúdo. ${errorMessage || "Erro desconhecido"}`)
      }

      setIsLoading(false)
    }

    const handleWaiting = () => {
      setIsLoading(true)
      setIsBuffering(true)
    }

    const handlePlaying = () => {
      setIsLoading(false)
      setIsBuffering(false)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
      setDuration(video.duration)
    }

    const handleTimeUpdate = () => {
      updateProgress()
      // Se estiver em buffering e o vídeo está reproduzindo, desativar o buffering
      if (isBuffering && !video.paused && !video.seeking) {
        setIsBuffering(false)
      }
    }

    const handleVolumeChange = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
    }

    const handleFullscreenChange = () => {
      const isInFullscreen = !!document.fullscreenElement
      setIsFullscreen(isInFullscreen)

      // Show controls initially when entering fullscreen, then let the normal timeout handle hiding
      if (isInFullscreen) {
        showControlsFunc()
      }
    }

    const handleVideoProgress = () => {
      if (videoRef.current) {
        const buffered = videoRef.current.buffered
        if (buffered.length > 0) {
          const bufferedEnd = buffered.end(buffered.length - 1)
          const duration = videoRef.current.duration
          const bufferedPercent = (bufferedEnd / duration) * 100
          setBufferProgress(bufferedPercent)
        }
      }
    }

    const handleSeeking = () => {
      setIsBuffering(true)
    }

    const handleSeeked = () => {
      setIsBuffering(false)
    }

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)
    video.addEventListener("waiting", handleWaiting)
    video.addEventListener("playing", handlePlaying)
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("volumechange", handleVolumeChange)
    video.addEventListener("progress", handleVideoProgress)
    video.addEventListener("seeking", handleSeeking)
    video.addEventListener("seeked", handleSeeked)
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
      video.removeEventListener("progress", handleVideoProgress)
      video.removeEventListener("seeking", handleSeeking)
      video.removeEventListener("seeked", handleSeeked)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)

      // Limpar timeout ao desmontar
      if (hideControlsTimeout) {
        clearTimeout(hideControlsTimeout)
      }

      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
      }
    }
  }, [videoUrl, hideControlsTimeout, isFullscreen, isBuffering])

  // Adicionar event listeners para mostrar/esconder controles ao mover o mouse
  useEffect(() => {
    if (!playerRef.current) return

    const player = playerRef.current

    const handleMouseMove = () => {
      showControlsFunc()
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
      try {
        videoRef.current.play().catch((err) => {
          console.error("Erro ao reproduzir:", err)
          // Verificar se o erro tem uma mensagem antes de exibi-lo
          if (err && err.message) {
            setError(`Não foi possível reproduzir este conteúdo: ${err.message}`)
          } else {
            setError("Não foi possível reproduzir este conteúdo. Tente novamente ou use o proxy.")
          }
        })
      } catch (err) {
        console.error("Exceção ao tentar reproduzir:", err)
        setError("Erro ao tentar reproduzir o vídeo. Tente novamente.")
      }
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

  // Formatar tempo em formato MM:SS ou HH:MM:SS
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "00:00"

    const hours = Math.floor(timeInSeconds / 3600)
    const minutes = Math.floor((timeInSeconds % 3600) / 60)
    const seconds = Math.floor(timeInSeconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }

    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

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
      <Card className="w-full max-w-6xl relative truncate">
        {isFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white absolute right-2 top-2 z-[999]"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            <X className="h-6 w-6" />
          </Button>
        )}

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
                        //poster={currentEpisode?.logo || series.thumbnail || "/placeholder.svg?height=720&width=1280"}
                        crossOrigin="anonymous"
                        onClick={handleVideoClick}
                        preload="auto"
                      />
                    )}

                    {/* Canvas escondido para captura de thumbnail */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Indicador de buffering */}
                    {isBuffering && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-50">
                        <div className="flex flex-col items-center">
                          <Loader2 className="h-12 w-12 animate-spin text-primary mb-2" />
                          <p className="text-white text-sm bg-black/60 px-3 py-1 rounded-md">
                            {seekTime !== null ? `Avançando para ${formatTime(seekTime)}...` : "Carregando..."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Controles estilo Netflix */}
                    <div
                      className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
                        controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Título e informações no topo com gradiente melhorado */}
                      <div className="w-full bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-4 pb-8 z-50">
                        <div className="px-4 flex justify-between items-center">
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

                          {isFullscreen && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-white"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFullscreen()
                              }}
                            >
                              <X className="h-6 w-6" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Botões centrais com glasmorfismo */}
                      <div
                        className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 hover:opacity-100 transition-opacity duration-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Botão de retroceder 15s */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-14 w-14 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 relative overflow-hidden group"
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 15)
                            }
                          }}
                        >
                          <span className="absolute inset-0 w-full h-full scale-0 rounded-full opacity-40 bg-white/30 group-active:scale-100 group-active:opacity-0 transition-all duration-500"></span>
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="text-white"
                          >
                            <path
                              d="M12.5 8C9.85 8 7.45 8.99 5.6 10.6L2 7V16H11L7.38 12.38C8.77 11.22 10.54 10.5 12.5 10.5C16.04 10.5 19.05 12.81 20.1 16L22.47 15.22C21.08 11.03 17.15 8 12.5 8Z"
                              fill="currentColor"
                            />
                            <text x="12" y="19" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">
                              15
                            </text>
                          </svg>
                        </Button>

                        {/* Botão de play/pause */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-16 w-16 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 relative overflow-hidden group"
                          onClick={togglePlay}
                        >
                          <span className="absolute inset-0 w-full h-full scale-0 rounded-full opacity-40 bg-white/30 group-active:scale-100 group-active:opacity-0 transition-all duration-500"></span>
                          {isPlaying ? (
                            <Pause className="h-8 w-8 text-white" />
                          ) : (
                            <Play className="h-8 w-8 text-white" />
                          )}
                        </Button>

                        {/* Botão de avançar 15s */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-14 w-14 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 relative overflow-hidden group"
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = Math.min(
                                videoRef.current.duration,
                                videoRef.current.currentTime + 15,
                              )
                            }
                          }}
                        >
                          <span className="absolute inset-0 w-full h-full scale-0 rounded-full opacity-40 bg-white/30 group-active:scale-100 group-active:opacity-0 transition-all duration-500"></span>
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="text-white"
                          >
                            <path
                              d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8C6.85 8 2.92 11.03 1.54 15.22L3.9 16C4.95 12.81 7.96 10.5 11.5 10.5C13.45 10.5 15.23 11.22 16.62 12.38L13 16H22V7L18.4 10.6Z"
                              fill="currentColor"
                            />
                            <text x="12" y="19" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">
                              15
                            </text>
                          </svg>
                        </Button>
                      </div>

                      {/* Controles inferiores com gradiente melhorado */}
                      <div className="w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-4 pt-8 z-50">
                        <div className="px-4" onClick={(e) => e.stopPropagation()}>
                          {/* Barra de progresso com tooltip de tempo */}
                          <div className="relative mb-4">
                            <div
                              className="w-full h-1 bg-white/30 rounded-full cursor-pointer relative group"
                              onClick={setVideoTime}
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const offsetX = e.clientX - rect.left
                                const percentage = offsetX / rect.width
                                const timeTooltip = document.getElementById("time-tooltip-series")
                                if (timeTooltip && videoRef.current) {
                                  const tooltipTime = percentage * videoRef.current.duration
                                  timeTooltip.textContent = formatTime(tooltipTime)
                                  timeTooltip.style.left = `${offsetX}px`
                                  timeTooltip.style.opacity = "1"
                                }
                              }}
                              onMouseLeave={() => {
                                const timeTooltip = document.getElementById("time-tooltip-series")
                                if (timeTooltip) {
                                  timeTooltip.style.opacity = "0"
                                }
                              }}
                            >
                              {/* Indicador de buffer */}
                              <div
                                className="absolute top-0 left-0 h-full bg-white/50 rounded-full"
                                style={{ width: `${bufferProgress}%` }}
                              />
                              <div
                                className="absolute top-0 left-0 h-full bg-primary rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                              <div
                                className="absolute top-0 left-0 h-3 w-3 bg-primary rounded-full -mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ left: `${progress}%` }}
                              />

                              {/* Tooltip de tempo */}
                              <div
                                id="time-tooltip-series"
                                className="absolute bottom-4 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 pointer-events-none transition-opacity"
                                style={{ left: "0%" }}
                              >
                                00:00
                              </div>
                            </div>
                          </div>

                          {/* Botões de controle */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-white"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  togglePlay()
                                }}
                              >
                                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                              </Button>

                              {/* Controle de volume */}
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-white"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleMute()
                                  }}
                                >
                                  {isMuted ? (
                                    <VolumeX className="h-5 w-5 text-white/50" />
                                  ) : (
                                    <Volume2 className="h-5 w-5" />
                                  )}
                                </Button>
                                <div
                                  className="w-20 h-1 bg-white/30 rounded-full cursor-pointer hidden md:block relative group"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const x = e.clientX - rect.left
                                    const newVolume = Math.max(0, Math.min(1, x / rect.width))
                                    adjustVolume(newVolume)
                                  }}
                                >
                                  <div
                                    className="h-full bg-white rounded-full"
                                    style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                                  />
                                  <div
                                    className="absolute top-1/2 -mt-1.5 -ml-1.5 h-3 w-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ left: `${isMuted ? 0 : volume * 100}%` }}
                                  />
                                </div>
                              </div>

                              {/* Tempo */}
                              <div className="text-white text-sm hidden md:block">
                                {videoRef.current && duration
                                  ? `${formatTime(videoRef.current.currentTime)} / ${formatTime(duration)}`
                                  : "00:00 / 00:00"}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              {/* Botão de tela cheia */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-white"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleFullscreen()
                                }}
                              >
                                <Maximize className="h-5 w-5" />
                              </Button>
                            </div>
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
                <h2 className="text-xl font-semibold truncate">
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
                  <p className="text-sm text-muted-foreground mt-1 truncate">
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
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-medium">Episódios</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Tabs defaultValue="dubbed" value={audioType} onValueChange={(value) => setAudioType(value as AudioType)}>
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
                      <Accordion type="multiple" defaultValue={defaultOpenValues}>
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

