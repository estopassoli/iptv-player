import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  try {
    console.log(`Proxying video from: ${url}`)

    // Fazer uma solicitação para o vídeo
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      // Definir um timeout para evitar esperas longas
      signal: AbortSignal.timeout(30000),
    })

    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`)
    }

    // Obter os headers da resposta original
    const headers = new Headers()
    response.headers.forEach((value, key) => {
      // Copiar headers relevantes
      if (
        key.toLowerCase() === "content-type" ||
        key.toLowerCase() === "content-length" ||
        key.toLowerCase() === "accept-ranges" ||
        key.toLowerCase() === "cache-control"
      ) {
        headers.set(key, value)
      }
    })

    // Adicionar CORS headers
    headers.set("Access-Control-Allow-Origin", "*")

    // Criar e retornar a resposta
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    console.error("Error proxying video:", error)
    return NextResponse.json({ error: "Failed to proxy video" }, { status: 500 })
  }
}

