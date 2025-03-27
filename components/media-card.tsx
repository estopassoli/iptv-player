"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getThumbnail } from "@/lib/thumbnail-manager"
import type { Channel } from "@/types/iptv"
import { motion } from "framer-motion"
import { ListVideo, PlayCircle, Tv } from "lucide-react"
import { useEffect, useState } from "react"

interface MediaCardProps {
  channel: Channel
  onClick?: (channel: Channel) => void
}

export function MediaCard({ channel, onClick }: MediaCardProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [tmdbThumbnail, setTmdbThumbnail] = useState<string | null>(null)

  // Load custom thumbnail
  useEffect(() => {
    async function loadThumbnail() {
      try {
        const thumb = await getThumbnail(channel.id)
        if (thumb) {
          setThumbnail(thumb)
        }
      } catch (error) {
        console.error(`Error loading thumbnail for ${channel.id}:`, error)
      }
    }

    loadThumbnail()
  }, [channel.id])

  // Load TMDB thumbnail
  useEffect(() => {
    async function fetchTMDBThumbnail() {
      try {
        // Clean the title for search (remove tags like [L], season info, etc.)
        const cleanTitle = channel.name
          .replace(/\[L\]/g, "")
          .replace(/S\d+\s*E\d+/gi, "")
          .replace(/\d+x\d+/g, "")
          .trim()

        // Determine if it's a movie or series based on season/episode presence
        const isEpisode = channel.season !== undefined && channel.episode !== undefined
        const type = isEpisode || (channel as any).isSeries ? "tv" : "movie"

        // Make the request to the API endpoint
        const response = await fetch(`/api/tmdb-thumbnail?title=${encodeURIComponent(cleanTitle)}&type=${type}`)

        if (!response.ok) {
          throw new Error("Failed to fetch thumbnail")
        }

        const data = await response.json()

        // If an image was found, store it
        if (data.url) {
          setTmdbThumbnail(data.url)
        }
      } catch (error) {
        console.error(`Error fetching TMDB thumbnail for ${channel.name}:`, error)
      }
    }

    fetchTMDBThumbnail()
  }, [channel])

  const handleClick = () => {
    if (onClick) {
      onClick(channel)
    }
  }

  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
      <Card className="overflow-hidden h-full cursor-pointer" onClick={handleClick}>
        <div className="aspect-video bg-muted relative overflow-hidden">
          {tmdbThumbnail ? (
            <img src={tmdbThumbnail || "/placeholder.svg"} alt={channel.name} className="w-full h-full object-cover" />
          ) : thumbnail ? (
            <img src={thumbnail || "/placeholder.svg"} alt={channel.name} className="w-full h-full object-cover" />
          ) : channel.logo ? (
            <img
              src={channel.logo || "/placeholder.svg"}
              alt={channel.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = `/placeholder.svg?height=180&width=320`
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-primary/10">
              {(channel as any).isSeries ? (
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
          {channel.name.includes("[L]") && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
              LEG
            </div>
          )}

          {/* Series indicator */}
          {(channel as any).isSeries && (
            <div className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-xs px-1.5 py-0.5 rounded">
              SÉRIE
            </div>
          )}
        </div>
        <CardHeader className="p-3">
          <CardTitle className="text-base line-clamp-1">
            {/* Remove [L] from displayed title */}
            {channel.name.replace("[L]", "").trim()}
          </CardTitle>
        </CardHeader>
        <CardFooter className="p-3 pt-0">
          <Badge variant="outline">
            {(channel as any).isSeries
              ? "Série"
              : channel.season && channel.episode
                ? `S${channel.season.toString().padStart(2, "0")}E${channel.episode.toString().padStart(2, "0")}`
                : channel.group}
          </Badge>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

