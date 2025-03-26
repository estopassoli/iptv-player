import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  try {
    console.log(`Resolvendo URL do vídeo: ${url}`)

    // Verificar se a URL é HTTP (não HTTPS)
    const isHttpUrl = url.startsWith("http:")

    // Se for HTTP, vamos usar nosso proxy para servir o conteúdo
    if (isHttpUrl) {
      console.log(`URL usa HTTP, usando proxy para servir conteúdo seguro`)
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(url)}`

      return NextResponse.json({
        originalUrl: url,
        videoUrl: proxyUrl,
        proxied: true,
      })
    }

    // Para URLs HTTPS, tentamos resolver redirecionamentos
    try {
      // Fazer uma solicitação HEAD para verificar se há redirecionamentos
      const headResponse = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        // Definir um timeout para evitar esperas longas
        signal: AbortSignal.timeout(10000),
      })

      // Se houver redirecionamento, retornar a URL final
      if (headResponse.redirected) {
        const redirectUrl = headResponse.url

        // Verificar se a URL redirecionada é HTTP
        if (redirectUrl.startsWith("http:")) {
          console.log(`URL redirecionada para HTTP: ${redirectUrl}, usando proxy`)
          const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(redirectUrl)}`

          return NextResponse.json({
            originalUrl: url,
            videoUrl: proxyUrl,
            proxied: true,
          })
        }

        console.log(`URL redirecionada para: ${redirectUrl}`)
        return NextResponse.json({
          originalUrl: url,
          videoUrl: redirectUrl,
          proxied: false,
        })
      }

      // Se não houver redirecionamento, retornar a URL original
      return NextResponse.json({
        originalUrl: url,
        videoUrl: url,
        proxied: false,
      })
    } catch (fetchError) {
      console.error("Erro ao fazer fetch da URL:", fetchError)

      // Se falhar, tentar usar o proxy como fallback
      console.log(`Usando proxy como fallback para: ${url}`)
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(url)}`

      return NextResponse.json({
        originalUrl: url,
        videoUrl: proxyUrl,
        proxied: true,
      })
    }
  } catch (error) {
    console.error("Erro ao resolver URL do vídeo:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro desconhecido ao resolver URL do vídeo",
      },
      { status: 500 },
    )
  }
}

