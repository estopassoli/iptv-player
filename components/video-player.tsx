"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useMobile } from "@/hooks/use-mobile"
import { saveThumbnail } from "@/lib/thumbnail-manager"
import { motion } from "framer-motion"
import { AlertCircle, Camera, Loader2, Maximize, Pause, Play, RefreshCw, Volume2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ThemeToggle } from "./theme-toggle"

interface VideoPlayerProps {
  item: {
    id: string
    name: string
    url: string
    logo?: string
    thumbnail?: string
  }
  onClose: () => void
}

export function VideoPlayer({ item, onClose }: VideoPlayerProps) {
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
      // Tentar iniciar a reprodução automaticamente
      video.play().catch((err) => {
        console.warn("Reprodução automática bloqueada:", err)
        setIsPlaying(false)
      })
    }

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)
    video.addEventListener("waiting", handleWaiting)
    video.addEventListener("playing", handlePlaying)
    video.addEventListener("canplay", handleCanPlay)

    // Limpar event listeners
    return () => {
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("error", handleError)
      video.removeEventListener("waiting", handleWaiting)
      video.removeEventListener("playing", handlePlaying)
      video.removeEventListener("canplay", handleCanPlay)
    }
  }, [videoUrl])

  const toggleFullscreen = () => {
    if (!playerRef.current) return

    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
  }

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
      await saveThumbnail(item.id, thumbnailData)

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

      <div className="absolute top-2 right-2 z-10">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-5xl relative truncate">
        <Button variant="ghost" size="icon" className="absolute right-2 top-2 z-10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>

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
                    controls
                    className="w-full h-full"
                    poster={item.logo || item.thumbnail || "/placeholder.svg?height=720&width=1280"}
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

                <div className="absolute bottom-4 right-4 space-x-2 hidden">
                  <Button variant="secondary" size="icon" className="opacity-70 hover:opacity-100" onClick={togglePlay}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>

                  <Button variant="secondary" size="icon" className="opacity-70 hover:opacity-100" onClick={toggleMute}>
                    <Volume2 className="h-4 w-4" />
                  </Button>

                  {!isMobile && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="opacity-70 hover:opacity-100"
                      onClick={toggleFullscreen}
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Botão para capturar thumbnail */}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="opacity-70 hover:opacity-100"
                    onClick={captureThumbnail}
                    disabled={capturingThumbnail || isLoading}
                  >
                    {capturingThumbnail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
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
            <h2 className="text-xl font-semibold">{item.name}</h2>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

