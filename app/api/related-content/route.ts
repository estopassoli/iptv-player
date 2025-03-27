import { getIPTVData } from "@/lib/idb-storage-server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const title = searchParams.get("title")
    const group = searchParams.get("group")

    if (!title && !group) {
      return NextResponse.json({ error: "Título ou grupo é necessário" }, { status: 400 })
    }

    // Obter dados IPTV do servidor
    const iptvData = await getIPTVData()

    if (!iptvData || !iptvData.channels || iptvData.channels.length === 0) {
      return NextResponse.json({ related: [] })
    }

    // Função para limpar o título para comparação
    const cleanTitle = (text: string) => {
      return text
        .toLowerCase()
        .replace(/\[l\]/g, "")
        .replace(/$$\d{4}$$/g, "")
        .replace(/\[\d{4}\]/g, "")
        .trim()
    }

    const cleanedSearchTitle = cleanTitle(title || "")

    // Encontrar conteúdo relacionado
    let relatedContent: any[] = []

    // Se temos um grupo, priorizar conteúdo do mesmo grupo
    if (group) {
      // Filtrar por grupo e excluir o título exato
      relatedContent = iptvData.channels
        .filter((channel: { group: string; name: string }) => channel.group === group && cleanTitle(channel.name) !== cleanedSearchTitle)
        .slice(0, 20) // Limitar a 20 itens
    }

    // Se não encontramos conteúdo suficiente pelo grupo, buscar por similaridade no título
    if (relatedContent.length < 5 && title) {
      // Dividir o título em palavras-chave
      const keywords = cleanedSearchTitle.split(/\s+/).filter((word) => word.length > 3)

      // Buscar por títulos similares
      const similarContent = iptvData.channels
        .filter((channel: { name: string; id: any }) => {
          const channelTitle = cleanTitle(channel.name)
          // Verificar se não é o mesmo título
          if (channelTitle === cleanedSearchTitle) return false

          // Verificar se contém alguma palavra-chave
          return keywords.some(
            (keyword) =>
              channelTitle.includes(keyword) &&
              // Evitar duplicatas do que já encontramos pelo grupo
              !relatedContent.some((item) => item.id === channel.id),
          )
        })
        .slice(0, 20 - relatedContent.length)

      // Adicionar ao conteúdo relacionado
      relatedContent = [...relatedContent, ...similarContent]
    }

    return NextResponse.json({ related: relatedContent })
  } catch (error) {
    console.error("Erro ao buscar conteúdo relacionado:", error)
    return NextResponse.json({ error: "Falha ao buscar conteúdo relacionado" }, { status: 500 })
  }
}

