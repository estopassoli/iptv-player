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

    // Fazer uma solicitação HEAD primeiro para verificar o tipo de conteúdo
    // sem baixar todo o arquivo
    const headResponse = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000), // 5 segundos de timeout para HEAD
    }).catch(() => null)

    // Se a requisição HEAD falhar ou não retornar content-type, prosseguir com a requisição normal
    const contentType = headResponse?.headers.get("content-type") || ""
    const contentLength = headResponse?.headers.get("content-length")

    // Verificar se é um arquivo de vídeo
    const isVideo =
      contentType.includes("video") ||
      url.endsWith(".mp4") ||
      url.endsWith(".mkv") ||
      url.endsWith(".webm") ||
      url.endsWith(".m3u8")

    // Se for um arquivo de vídeo e tiver tamanho, usar range requests
    if (isVideo && contentLength) {
      const rangeHeader = request.headers.get("range")

      if (rangeHeader) {
        try {
          // Processar o header Range
          const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
          if (!match) {
            return NextResponse.json({ error: "Invalid range header" }, { status: 400 })
          }

          const start = match[1] ? Number.parseInt(match[1], 10) : 0
          const end = match[2] ? Number.parseInt(match[2], 10) : Number.parseInt(contentLength, 10) - 1

          // Limitar o tamanho do chunk para evitar timeouts
          const maxChunkSize = 2 * 1024 * 1024 // 2MB (reduzido para melhorar a velocidade de resposta)
          const newEnd = Math.min(end, start + maxChunkSize - 1)

          // Fazer a requisição com o range
          const response = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              Range: `bytes=${start}-${newEnd}`,
            },
            signal: AbortSignal.timeout(15000), // 15 segundos de timeout (reduzido)
          })

          if (!response.ok && response.status !== 206) {
            // Se receber erro 416 (Requested Range Not Satisfiable), tentar novamente sem o header Range
            if (response.status === 416) {
              console.log("Erro 416 (Range Not Satisfiable), tentando novamente sem Range header")
              const fullResponse = await fetch(url, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
                signal: AbortSignal.timeout(15000),
              })

              if (!fullResponse.ok) {
                throw new Error(`Failed to fetch video: ${fullResponse.statusText}`)
              }

              // Preparar os headers da resposta
              const headers = new Headers()
              headers.set("Content-Type", contentType)
              headers.set("Content-Length", contentLength)
              headers.set("Accept-Ranges", "bytes")
              headers.set("Access-Control-Allow-Origin", "*")
              headers.set("Cache-Control", "public, max-age=3600") // Adicionar cache para melhorar performance

              return new NextResponse(fullResponse.body, {
                status: 200,
                headers,
              })
            }

            throw new Error(`Failed to fetch video: ${response.statusText}`)
          }

          // Preparar os headers da resposta
          const headers = new Headers()
          headers.set("Content-Type", contentType)
          headers.set("Content-Range", `bytes ${start}-${newEnd}/${contentLength}`)
          headers.set("Content-Length", String(newEnd - start + 1))
          headers.set("Accept-Ranges", "bytes")
          headers.set("Access-Control-Allow-Origin", "*")
          headers.set("Cache-Control", "public, max-age=3600") // Adicionar cache para melhorar performance

          return new NextResponse(response.body, {
            status: 206,
            statusText: "Partial Content",
            headers,
          })
        } catch (error) {
          console.error("Erro ao processar range request:", error)
          // Se falhar com range, tentar sem range
          const fullResponse = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            signal: AbortSignal.timeout(15000),
          })

          if (!fullResponse.ok) {
            throw new Error(`Failed to fetch video: ${fullResponse.statusText}`)
          }

          // Preparar os headers da resposta
          const headers = new Headers()
          headers.set("Content-Type", contentType)
          headers.set("Content-Length", contentLength)
          headers.set("Accept-Ranges", "bytes")
          headers.set("Access-Control-Allow-Origin", "*")
          headers.set("Cache-Control", "public, max-age=3600") // Adicionar cache para melhorar performance

          return new NextResponse(fullResponse.body, {
            status: 200,
            headers,
          })
        }
      }
    }

    // Fazer uma solicitação para o vídeo (sem range ou para outros tipos de arquivo)
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      // Definir um timeout para evitar esperas longas
      signal: AbortSignal.timeout(15000), // 15 segundos de timeout (reduzido)
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
    headers.set("Cache-Control", "public, max-age=3600") // Adicionar cache para melhorar performance

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

