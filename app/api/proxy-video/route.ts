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

    // Obter o header Range da requisição original, se existir
    const rangeHeader = request.headers.get("range")

    // Configurar headers para a requisição
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    }

    // Se houver um header Range, incluí-lo na requisição
    if (rangeHeader) {
      headers["Range"] = rangeHeader
    }

    // Fazer a requisição para o vídeo
    const response = await fetch(url, {
      headers,
      // Definir um timeout para evitar esperas longas
      signal: AbortSignal.timeout(60000), // 60 segundos
    })

    // Verificar se a resposta foi bem-sucedida
    if (!response.ok && response.status !== 206) {
      throw new Error(`Failed to fetch video: ${response.statusText}`)
    }

    // Obter os headers da resposta original
    const responseHeaders = new Headers()

    // Copiar headers relevantes
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey === "content-type" ||
        lowerKey === "content-length" ||
        lowerKey === "content-range" ||
        lowerKey === "accept-ranges" ||
        lowerKey === "cache-control" ||
        lowerKey === "etag" ||
        lowerKey === "last-modified"
      ) {
        responseHeaders.set(key, value)
      }
    })

    // Adicionar CORS headers
    responseHeaders.set("Access-Control-Allow-Origin", "*")

    // Definir o status correto (206 para respostas parciais, status original para outras)
    const status = response.status === 206 ? 206 : response.status

    // Criar e retornar a resposta
    return new NextResponse(response.body, {
      status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error("Error proxying video:", error)
    return NextResponse.json(
      {
        error: "Failed to proxy video",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

