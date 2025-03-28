import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// Cache para armazenar respostas por URL
const responseCache = new Map()

// Lista de User-Agents para rotação
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/123.0.0.0 Safari/537.36",
]

// Lista de Referers para rotação
const referers = [
  "https://www.google.com/",
  "https://www.bing.com/",
  "https://www.youtube.com/",
  "https://www.facebook.com/",
  "https://www.reddit.com/",
  "https://www.instagram.com/",
  "https://www.twitter.com/",
]

// Função para obter um item aleatório de um array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

// Função para gerar um delay aleatório
function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

// Contador de requisições por URL para implementar backoff exponencial
const requestCounters: Record<string, number> = {}

// Função para obter headers que simulam um navegador real
function getBrowserLikeHeaders(url: string, rangeHeader: string | null): Record<string, string> {
  const parsedUrl = new URL(url)
  const origin = `${parsedUrl.protocol}//${parsedUrl.hostname}`

  const headers: Record<string, string> = {
    "User-Agent": getRandomItem(userAgents),
    Accept: "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
    Referer: getRandomItem(referers),
    Origin: origin,
    "Sec-Fetch-Dest": "video",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    "Sec-CH-UA": '"Chromium";v="123", "Google Chrome";v="123", "Not:A-Brand";v="99"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
    Connection: "keep-alive",
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
  }

  // Adicionar Range header se existir
  if (rangeHeader) {
    headers["Range"] = rangeHeader
  }

  return headers
}

// Implementar sistema de retry com backoff exponencial
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null

  // Incrementar contador de requisições para esta URL
  requestCounters[url] = (requestCounters[url] || 0) + 1

  // Calcular backoff baseado no número de requisições anteriores
  const backoffFactor = Math.min(requestCounters[url], 5) // Limitar o fator de backoff

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Adicionar um delay aleatório antes de cada tentativa (exceto a primeira)
      if (attempt > 0) {
        const delay = getRandomDelay(200, 500) * Math.pow(2, attempt - 1) * backoffFactor
        await new Promise((resolve) => setTimeout(resolve, delay))

        // Atualizar headers para cada nova tentativa
        if (options.headers) {
          options.headers = {
            ...options.headers,
            "User-Agent": getRandomItem(userAgents),
            Referer: getRandomItem(referers),
          }
        }
      }

      const response = await fetch(url, options)

      // Se a resposta for bem-sucedida, resetar o contador de erros
      if (response.ok || response.status === 206) {
        return response
      }

      // Se receber 429 (Too Many Requests), esperar mais tempo
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After")
        const waitTime = retryAfter
          ? Number.parseInt(retryAfter, 10) * 1000
          : getRandomDelay(2000, 5000) * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        continue
      }

      // Para outros erros, lançar exceção
      throw new Error(`HTTP error! status: ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Attempt ${attempt + 1} failed for ${url}: ${lastError.message}`)
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries} attempts`)
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  // Obter o header Range da requisição original
  const rangeHeader = request.headers.get("range")

  // Se não for uma requisição de range, podemos verificar o cache
  if (!rangeHeader) {
    // Verificar se já temos uma resposta em cache para este URL
    const cachedResponse = responseCache.get(url)
    if (cachedResponse) {
      console.log(`Usando resposta em cache para: ${url}`)
      return cachedResponse
    }
  }

  try {
    console.log(`Proxying video from: ${url}`)

    // Obter headers que simulam um navegador real
    const headers = getBrowserLikeHeaders(url, rangeHeader)

    // Adicionar um pequeno delay aleatório para parecer mais natural
    await new Promise((resolve) => setTimeout(resolve, getRandomDelay(50, 200)))

    // Fazer a requisição para o vídeo com retry
    const response = await fetchWithRetry(url, {
      headers,
      // Definir um timeout para evitar esperas longas
      signal: AbortSignal.timeout(60000), // 60 segundos
    })

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

    // Criar a resposta
    const nextResponse = new NextResponse(response.body, {
      status,
      statusText: response.statusText,
      headers: responseHeaders,
    })

    // Armazenar em cache apenas se não for uma requisição de range
    if (!rangeHeader) {
      responseCache.set(url, nextResponse.clone())

      // Limitar o tamanho do cache para evitar vazamento de memória
      if (responseCache.size > 100) {
        const oldestKey = responseCache.keys().next().value
        responseCache.delete(oldestKey)
      }
    }

    return nextResponse
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

