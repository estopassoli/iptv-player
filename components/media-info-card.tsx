"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getTMDBImageUrl, ImageSize } from "@/lib/tmdb-service"
import { Calendar, Clock, Star } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"

interface MediaInfoCardProps {
  title: string
  type?: "auto" | "movie" | "tv"
  season?: number
  episode?: number
  className?: string
}

export function MediaInfoCard({ title, type = "auto", season, episode, className = "" }: MediaInfoCardProps) {
  const [mediaInfo, setMediaInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMediaInfo = async () => {
      try {
        setLoading(true)
        setError(null)

        // Construir URL de busca
        let url = `/api/media-info?title=${encodeURIComponent(title)}&type=${type}`

        // Adicionar parâmetros de temporada e episódio, se disponíveis
        if (season !== undefined) {
          url += `&season=${season}`
        }
        if (episode !== undefined) {
          url += `&episode=${episode}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error("Falha ao buscar informações de mídia")
        }

        const data = await response.json()
        setMediaInfo(data)
      } catch (err) {
        console.error("Erro ao buscar informações de mídia:", err)
        setError("Não foi possível carregar informações adicionais")
      } finally {
        setLoading(false)
      }
    }

    if (title) {
      fetchMediaInfo()
    }
  }, [title, type, season, episode])

  // Renderizar estado de carregamento
  if (loading) {
    return (
      <Card className={`overflow-hidden ${className}`}>
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Renderizar estado de erro
  if (error || !mediaInfo || mediaInfo.type === "unknown") {
    return null // Não mostrar nada em caso de erro
  }

  // Extrair dados com base no tipo de mídia
  const isMovie = mediaInfo.type === "movie"
  const data = mediaInfo.data
  const episodeData = mediaInfo.episode

  if (!data) return null

  // Formatar data
  const formatDate = (dateString: string) => {
    if (!dateString) return "Data desconhecida"
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR")
  }

  // Formatar duração (para filmes)
  const formatRuntime = (minutes: number) => {
    if (!minutes) return ""
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}min`
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Poster/Imagem */}
          <div className="md:w-1/3 lg:w-1/4 relative">
            <Image
              src={getTMDBImageUrl(
                isMovie ? data.poster_path : episodeData?.still_path || data.poster_path,
                isMovie ? ImageSize.poster.medium : episodeData ? ImageSize.backdrop.medium : ImageSize.poster.medium,
              )}
              fill
              alt={isMovie ? data.title : episodeData?.name || data.name}
              className="object-cover"
            />
          </div>

          {/* Informações */}
          <div className="p-4 md:w-2/3 lg:w-3/4">
            <h3 className="text-xl font-semibold mb-1">{isMovie ? data.title : episodeData?.name || data.name}</h3>

            {/* Informações adicionais */}
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Avaliação */}
              <Badge variant="secondary" className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {(isMovie ? data.vote_average : episodeData?.vote_average || data.vote_average).toFixed(1)}/10
              </Badge>

              {/* Data de lançamento */}
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(isMovie ? data.release_date : episodeData?.air_date || data.first_air_date)}
              </Badge>

              {/* Duração (apenas para filmes) */}
              {isMovie && data.runtime && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRuntime(data.runtime)}
                </Badge>
              )}

              {/* Temporada/Episódio (apenas para séries) */}
              {!isMovie && episodeData && (
                <Badge variant="outline">
                  S{episodeData.season_number}E{episodeData.episode_number}
                </Badge>
              )}
            </div>

            {/* Gêneros */}
            {data.genres && (
              <div className="flex flex-wrap gap-1 mb-3">
                {data.genres.slice(0, 3).map((genre: any) => (
                  <Badge key={genre.id} variant="secondary" className="text-xs">
                    {genre.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Sinopse */}
            <p className="text-sm text-muted-foreground line-clamp-4 text-wrap">
              {isMovie ? data.overview : episodeData?.overview || data.overview || "Sem sinopse disponível."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

