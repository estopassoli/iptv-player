"use client"

import type React from "react"

import { MediaInfoCard } from "@/components/media-info-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMobile } from "@/hooks/use-mobile"
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
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

type AudioType = "all" | "dubbed" | "subbed"

interface VideoPlayerProps {
  item: {
    id: string
    name: string
    url: string
    logo?: string
    thumbnail?: string
    group?: string
    season?: number
    episode?: number
    related?: Array<{
      id: string
      name: string
      url: string
      logo?: string
      thumbnail?: string
      season?: number
      episode?: number
    }>
  }
  onClose: () => void
}

export function VideoPlayer({ item, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const isMobile = useMobile()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [capturingThumbnail, setCapturingThumbnail] = useState(false)
  const [thumbnailCaptured, setThumbnailCaptured] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [audioType, setAudioType] = useState<AudioType>("all")
  const [relatedContent, setRelatedContent] = useState<Array<any>>([])
  const [controlsVisible, setControlsVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hideControlsTimeout, setHideControlsTimeout] = useState<NodeJS.Timeout | null>(null)
  const [lastClickTime, setLastClickTime] = useState(0)
  const [bufferProgress, setBufferProgress] = useState(0)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)

  // Função para formatar o tempo em minutos e segundos
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Função para mostrar controles e configurar timeout para escondê-los
  const showControls = () => {
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
      setProgress(videoRef.current.currentTime)
    }
  }

  // Função para definir o tempo do vídeo
  const setVideoTime = (value: number[]) => {
    if (!videoRef.current || value.length === 0) return

    try {
      // Verificar se o vídeo está pronto para buscar
      if (videoRef.current.readyState >= 1) {
        const newTime = Math.min(value[0], videoRef.current.duration - 0.1)
        videoRef.current.currentTime = newTime
      } else {
        // Se o vídeo não estiver pronto, definir um listener para quando estiver
        const setTimeWhenReady = () => {
          if (videoRef.current) {
            const newTime = Math.min(value[0], videoRef.current.duration - 0.1)
            videoRef.current.currentTime = newTime
            videoRef.current.removeEventListener("loadedmetadata", setTimeWhenReady)
          }
        }
        videoRef.current.addEventListener("loadedmetadata", setTimeWhenReady)
      }
    } catch (err) {
      console.warn("Erro ao definir o tempo do vídeo:", err)
      // Não mostrar erro na interface para não interromper a experiência
    }
  }

  // Função para lidar com o hover na barra de progresso
  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return

    const rect = progressBarRef.current.getBoundingClientRect()
    const position = e.clientX - rect.left
    const percentage = position / rect.width
    const timeAtPosition = percentage * videoRef.current.duration

    setHoverTime(timeAtPosition)
    setHoverPosition(position)
  }

  // Função para limpar o hover
  const handleProgressLeave = () => {
    setHoverTime(null)
    setHoverPosition(null)
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
  const adjustVolume = (value: number[]) => {
    if (!videoRef.current || value.length === 0) return

    const newVolume = value[0]
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

  // Função para obter a URL real do vídeo
  const fetchVideoUrl = async () => {
    try {
      setFetchingUrl(true)
      setIsLoading(true)
      setError(null)
      setIsRetrying(false)

      console.log("Obtendo URL real do vídeo:", item.url)

      // Fazer uma solicitação para obter a URL real do vídeo
      const response = await fetch(`/api/resolve-video-url?url=${encodeURIComponent(item.url)}`)

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

  // Processar conteúdo relacionado quando o item mudar
  useEffect(() => {
    // Se o item tiver conteúdo relacionado, processá-lo
    if (item.related && item.related.length > 0) {
      setRelatedContent(item.related)
    } else {
      setRelatedContent([])
    }
  }, [item])

  useEffect(() => {
    fetchVideoUrl()
  }, [item.url])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === " " || e.key === "k") {
        // Espaço ou tecla K para play/pause
        togglePlay()
      } else if (e.key === "i") {
        // Tecla I para alternar informações de mídia
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

      // Ignorar erros de busca (seek) que não afetam a reprodução
      if (errorCode === 3 && videoRef.current && !videoRef.current.paused) {
        // MediaError.MEDIA_ERR_DECODE = 3
        console.warn("Erro de decodificação durante a reprodução, tentando continuar...")
        return // Não mostrar erro ao usuário se o vídeo continua reproduzindo
      }

      if (
        errorMessage.includes("Mixed Content") ||
        errorMessage.includes("CORS") ||
        errorMessage.includes("blocked") ||
        (videoUrl?.startsWith("http:") && window.location.protocol === "https:")
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

      // Remove auto fullscreen and autoplay
      // video.play().catch((err) => {
      //   console.warn("Reprodução automática bloqueada:", err);
      //   setIsPlaying(false);
      // });

      // if (playerRef.current && !isFullscreen) {
      //   try {
      //     playerRef.current.requestFullscreen().catch((err) => {
      //       console.warn("Tela cheia automática bloqueada:", err);
      //     });
      //     setIsFullscreen(true);
      //   } catch (err) {
      //     console.warn("Erro ao tentar entrar em tela cheia:", err);
      //   }
      // }
    }

    const handleTimeUpdate = () => {
      updateProgress()
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
        showControls()
      }
    }

    const handleProgress = () => {
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

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)
    video.addEventListener("waiting", handleWaiting)
    video.addEventListener("playing", handlePlaying)
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("volumechange", handleVolumeChange)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    video.addEventListener("progress", handleProgress)

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
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      video.removeEventListener("progress", handleProgress)

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
      // Store the play promise to handle it properly
      const playPromise = videoRef.current.play()

      // Only if the browser returns a promise (modern browsers do)
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Playback started successfully
          })
          .catch((error) => {
            // Auto-play was prevented or another error occurred
            console.error("Error playing video:", error)
            if (error.name !== "AbortError") {
              // Only show errors that aren't just play/pause race conditions
              setError("Não foi possível reproduzir este conteúdo.")
            }
          })
      }
    } else {
      // Make sure we don't call pause() while a play() is still pending
      setTimeout(() => {
        videoRef.current?.pause()
      }, 0)
    }
  }

  // Função para tentar novamente com proxy forçado
  const retryWithProxy = async () => {
    try {
      setIsRetrying(true)
      setError(null)

      // Forçar o uso do proxy
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(item.url)}`
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
      if (wasPlaying) {
        // Use setTimeout to avoid race conditions with play/pause
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.pause()
            }
            resolve()
          }, 0)
        })
      }

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
      await saveThumbnail(item.id, thumbnailData)

      // Retornar ao estado anterior
      if (wasPlaying) {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("Não foi possível retomar a reprodução após captura:", err)
          })
        }
      }
    } catch (error) {
      console.error("Erro ao capturar thumbnail:", error)
    } finally {
      setCapturingThumbnail(false)
    }
  }

  // Filtrar conteúdo relacionado com base no tipo de áudio selecionado
  const filteredRelatedContent = relatedContent.filter((content) => {
    if (audioType === "all") return true
    const isSubbed = content.name.includes("[L]")
    return audioType === "subbed" ? isSubbed : !isSubbed
  })

  // Função para reproduzir um item relacionado
  const playRelatedItem = (relatedItem: any) => {
    // Pausar o vídeo atual
    if (videoRef.current && !videoRef.current.paused) {
      // Use setTimeout to avoid race conditions with play/pause
      setTimeout(() => {
        videoRef.current?.pause()
      }, 0)
    }

    // Atualizar o item atual com o relacionado
    const newItem = {
      ...item,
      id: relatedItem.id,
      name: relatedItem.name,
      url: relatedItem.url,
      logo: relatedItem.logo || item.logo,
      thumbnail: relatedItem.thumbnail || item.thumbnail,
      season: relatedItem.season,
      episode: relatedItem.episode,
    }

    // Reiniciar o player com o novo item
    setVideoUrl(null)
    setIsLoading(true)
    setError(null)

    // Buscar a URL do novo vídeo
    fetch(`/api/resolve-video-url?url=${encodeURIComponent(relatedItem.url)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Falha ao obter URL do vídeo relacionado")
        return response.json()
      })
      .then((data) => {
        if (!data.videoUrl) throw new Error("URL do vídeo relacionado não encontrada")
        setVideoUrl(data.videoUrl)
      })
      .catch((err) => {
        console.error("Erro ao obter URL do vídeo relacionado:", err)
        setError(`Não foi possível reproduzir o conteúdo relacionado: ${err.message}`)
      })
  }

  /* // Renderizar tela de carregamento enquanto busca a URL
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
  } */

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <Card className="w-full max-w-5xl relative">
        {isFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white absolute right-2 top-2 z-10"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            <X className="h-6 w-6" />
          </Button>
        )}

        <div className="flex flex-col lg:flex-row">
          {/* Área do player de vídeo */}
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
                    {videoUrl && (
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full"
                        poster={item.logo || item.thumbnail || "/placeholder.svg?height=720&width=1280"}
                        crossOrigin="anonymous"
                        onClick={handleVideoClick}
                        preload="metadata"
                      />
                    )}

                    {/* Canvas escondido para captura de thumbnail */}
                    <canvas ref={canvasRef} className="hidden" />

                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-50">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
                      <div className="w-full bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-4 pb-8">
                        <div className="px-4 flex justify-between items-center">
                          <div>
                            <h2 className="text-white text-xl font-semibold drop-shadow-md">
                              {item.name.replace("[L]", "").trim()}
                            </h2>
                            {item.group && (
                              <p className="text-white/80 text-sm drop-shadow-md">Categoria: {item.group}</p>
                            )}
                          </div>

                          {isFullscreen && (
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
                          {/* Barra de progresso com tooltip */}
                          <div
                            className="w-full mb-4 relative"
                            ref={progressBarRef}
                            onMouseMove={handleProgressHover}
                            onMouseLeave={handleProgressLeave}
                          >
                            {/* Tooltip de tempo */}
                            {hoverTime !== null && hoverPosition !== null && (
                              <div
                                className="absolute bottom-full mb-2 bg-black/80 text-white text-xs px-2 py-1 rounded transform -translate-x-1/2 pointer-events-none"
                                style={{ left: `${hoverPosition}px` }}
                              >
                                {formatTime(hoverTime)}
                              </div>
                            )}

                            {/* Slider para progresso */}
                            <div className="relative">
                              {/* Indicador de buffer */}
                              <div
                                className="absolute top-1/2 left-0 h-1 -translate-y-1/2 bg-white/50 rounded-full z-10 pointer-events-none"
                                style={{ width: `${bufferProgress}%` }}
                              />
                              <Slider
                                value={[videoRef.current?.currentTime || 0]}
                                max={duration || 100}
                                step={0.01}
                                onValueChange={setVideoTime}
                                className="z-20"
                              />
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
                                    <Volume2 className="h-5 w-5 text-white/50" />
                                  ) : (
                                    <Volume2 className="h-5 w-5" />
                                  )}
                                </Button>
                                <Slider
                                  value={[isMuted ? 0 : volume]}
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  onValueChange={adjustVolume}
                                  className="w-20"
                                />
                              </div>

                              {/* Tempo */}
                              <div className="text-white text-sm hidden md:block">
                                {videoRef.current
                                  ? `${formatTime(videoRef.current.currentTime)} / ${formatTime(duration)}`
                                  : "0:00 / 0:00"}
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
                <h2 className="text-xl font-semibold truncate">{item.name}</h2>
                {item.group && <p className="text-sm text-muted-foreground mt-1 truncate">Categoria: {item.group}</p>}
              </div>

              {/* Informações de mídia do TMDB - sempre visíveis */}
              <div className="px-4 pb-4">
                <MediaInfoCard
                  title={item.name}
                  type={item.season !== undefined && item.episode !== undefined ? "tv" : "auto"}
                  season={item.season}
                  episode={item.episode}
                />
              </div>
            </CardContent>
          </div>

          {/* Área de conteúdo relacionado */}
          <div className="lg:w-1/3 border-t lg:border-t-0 lg:border-l">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-medium">Conteúdo Relacionado</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {relatedContent.length > 0 ? (
              <div className="p-4">
                <Tabs defaultValue="all" value={audioType} onValueChange={(value) => setAudioType(value as AudioType)}>
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
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {filteredRelatedContent.length > 0 ? (
                        filteredRelatedContent.map((relatedItem) => (
                          <div
                            key={relatedItem.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                            onClick={() => playRelatedItem(relatedItem)}
                          >
                            <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                              {relatedItem.thumbnail || relatedItem.logo ? (
                                <img
                                  src={relatedItem.thumbnail || relatedItem.logo}
                                  alt={relatedItem.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=48&width=64"
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Play className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {relatedItem.name.replace("[L]", "").trim()}
                              </p>
                              {relatedItem.name.includes("[L]") && (
                                <span className="text-xs text-muted-foreground">Legendado</span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum conteúdo{" "}
                          {audioType === "dubbed" ? "dublado" : audioType === "subbed" ? "legendado" : ""} disponível.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <p>Nenhum conteúdo relacionado disponível.</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

