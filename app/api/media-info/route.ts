import { type NextRequest, NextResponse } from "next/server"
import { searchMovie, searchTVShow, getEpisodeDetails } from "@/lib/tmdb-service"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const title = searchParams.get("title")
    const type = searchParams.get("type") || "auto" // auto, movie, tv
    const seasonNumber = searchParams.get("season")
      ? Number.parseInt(searchParams.get("season") as string, 10)
      : undefined
    const episodeNumber = searchParams.get("episode")
      ? Number.parseInt(searchParams.get("episode") as string, 10)
      : undefined

    if (!title) {
      return NextResponse.json({ error: "Título não fornecido" }, { status: 400 })
    }

    let result = null

    // Buscar informações com base no tipo
    if (type === "movie" || type === "auto") {
      result = await searchMovie(title)

      // Se encontrou um filme ou se o tipo foi especificado como filme
      if (result || type === "movie") {
        return NextResponse.json({
          type: "movie",
          data: result,
        })
      }
    }

    // Se não encontrou um filme ou o tipo é série, buscar como série
    if (type === "tv" || type === "auto") {
      result = await searchTVShow(title)

      // Se encontrou uma série
      if (result) {
        let episodeInfo = null

        // Se temos informações de temporada e episódio, buscar detalhes do episódio
        if (seasonNumber !== undefined && episodeNumber !== undefined) {
          episodeInfo = await getEpisodeDetails(result.id, seasonNumber, episodeNumber)
        }

        return NextResponse.json({
          type: "tv",
          data: result,
          episode: episodeInfo,
        })
      }
    }

    // Se não encontrou nada
    return NextResponse.json({
      type: "unknown",
      data: null,
    })
  } catch (error) {
    console.error("Erro ao buscar informações de mídia:", error)
    return NextResponse.json({ error: "Erro ao buscar informações de mídia" }, { status: 500 })
  }
}

