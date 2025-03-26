import { type NextRequest, NextResponse } from "next/server"
import { searchMovie, searchTVShow, getTMDBImageUrl, ImageSize } from "@/lib/tmdb-service"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const title = searchParams.get("title")
    const type = searchParams.get("type") || "auto" // auto, movie, tv

    if (!title) {
      return NextResponse.json({ error: "Título não fornecido" }, { status: 400 })
    }

    let posterUrl = null

    if (type === "tv" || type === "auto") {
      // Buscar como série
      const tvShow = await searchTVShow(title)
      if (tvShow && tvShow.poster_path) {
        posterUrl = getTMDBImageUrl(tvShow.poster_path, ImageSize.poster.medium)
      }
    }

    // Se não encontrou como série ou o tipo é filme, buscar como filme
    if (!posterUrl && (type === "movie" || type === "auto")) {
      const movie = await searchMovie(title)
      if (movie && movie.poster_path) {
        posterUrl = getTMDBImageUrl(movie.poster_path, ImageSize.poster.medium)
      }
    }

    return NextResponse.json({
      url: posterUrl,
      title: title,
    })
  } catch (error) {
    console.error("Erro ao buscar thumbnail do TMDB:", error)
    return NextResponse.json({ error: "Falha ao buscar thumbnail" }, { status: 500 })
  }
}

