"use client"

import { MediaInfoCard } from "@/components/media-info-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getThumbnail } from "@/lib/thumbnail-manager"
import { motion } from "framer-motion"
import { Film, Info, ListVideo, PlayCircle, Tv } from "lucide-react"
import { useEffect, useState } from "react"

interface IPTVContentItemProps {
  item: any
  onClick: (item: any) => void
}

export function IPTVContentItem({ item, onClick }: IPTVContentItemProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [showMediaInfo, setShowMediaInfo] = useState(false)

  // Carregar thumbnail personalizada
  useEffect(() => {
    const loadThumbnail = async () => {
      try {
        const thumbData = await getThumbnail(item.id)
        if (thumbData) {
          setThumbnail(thumbData)
        }
      } catch (error) {
        console.error(`Erro ao carregar thumbnail para ${item.id}:`, error)
      }
    }

    loadThumbnail()
  }, [item.id])

  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
      <Card className="overflow-hidden h-full cursor-pointer relative">
        <div className="aspect-video bg-muted relative overflow-hidden" onClick={() => onClick(item)}>
          {thumbnail ? (
            <img src={thumbnail || "/placeholder.svg"} alt={item.name} className="w-full h-full object-cover" />
          ) : item.logo ? (
            <img
              src={item.logo || "/placeholder.svg"}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = `/placeholder.svg?height=180&width=320`
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-primary/10">
              {(item as any).isSeries ? (
                <ListVideo className="w-12 h-12 text-primary/40" />
              ) : item.season && item.episode ? (
                <Tv className="w-12 h-12 text-primary/40" />
              ) : (
                <Film className="w-12 h-12 text-primary/40" />
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

          {/* Botão de informações */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute bottom-2 right-2 w-7 h-7 opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              setShowMediaInfo((prev) => !prev)
            }}
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
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

        {/* Informações de mídia */}
        {showMediaInfo && (
          <div className="p-3 pt-0">
            <MediaInfoCard
              title={item.name}
              type={
                (item as any).isSeries || (item.season !== undefined && item.episode !== undefined) ? "tv" : "movie"
              }
              season={item.season}
              episode={item.episode}
            />
          </div>
        )}
      </Card>
    </motion.div>
  )
}

