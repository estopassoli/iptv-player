// Utilitários para busca avançada

/**
 * Remove acentos e caracteres especiais de uma string
 */
export function normalizeString(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .toLowerCase()
    .trim()
}

/**
 * Divide um texto em palavras-chave, removendo palavras muito comuns
 */
export function extractKeywords(text: string): string[] {
  const normalized = normalizeString(text)

  // Lista de palavras muito comuns que podem ser ignoradas (stop words)
  const stopWords = new Set([
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "uns",
    "umas",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "por",
    "pelo",
    "pela",
    "pelos",
    "pelas",
    "com",
    "para",
    "e",
    "ou",
    "que",
    "se",
    "the",
    "of",
    "and",
    "to",
    "in",
    "is",
    "it",
  ])

  // Dividir em palavras e filtrar stop words
  return normalized.split(/\s+/).filter((word) => word.length > 1 && !stopWords.has(word))
}

/**
 * Calcula a pontuação de relevância entre um texto e um conjunto de palavras-chave
 * Retorna um número entre 0 e 1, onde 1 é uma correspondência perfeita
 */
export function calculateRelevanceScore(text: string, keywords: string[]): number {
  if (!keywords.length) return 0

  const normalizedText = normalizeString(text)
  let matchCount = 0
  let totalScore = 0

  for (const keyword of keywords) {
    // Verificar correspondência exata da palavra
    if (normalizedText.includes(keyword)) {
      matchCount++
      totalScore += 1.0 // Pontuação máxima para correspondência exata
    } else {
      // Verificar correspondência parcial (pelo menos 3 caracteres)
      if (keyword.length >= 3) {
        // Verificar se pelo menos 3 caracteres consecutivos do keyword estão no texto
        for (let i = 0; i <= keyword.length - 3; i++) {
          const subKeyword = keyword.substring(i, i + 3)
          if (normalizedText.includes(subKeyword)) {
            matchCount++
            // Pontuação parcial baseada no tamanho da correspondência
            totalScore += 0.5 * (subKeyword.length / keyword.length)
            break
          }
        }
      }
    }
  }

  // Calcular pontuação final
  // Fator 1: Proporção de palavras-chave encontradas
  const keywordCoverageScore = matchCount / keywords.length

  // Fator 2: Pontuação média das correspondências
  const matchQualityScore = matchCount > 0 ? totalScore / matchCount : 0

  // Fator 3: Bônus para correspondências de múltiplas palavras
  const multiWordBonus = matchCount > 1 ? 0.2 : 0

  // Combinar os fatores (com pesos)
  return Math.min(1, keywordCoverageScore * 0.5 + matchQualityScore * 0.3 + multiWordBonus)
}

// Adicionar a nova função de busca por regex
export function buscarPorRegex(texto: string, busca: string): boolean {
  // Limpar a busca e o texto para remover caracteres especiais
  const textoNormalizado = normalizeString(texto)
  const buscaNormalizada = normalizeString(busca)

  const regexPadrao = buscaNormalizada
    .split(/\s+/) // Divide a busca em palavras (considerando múltiplos espaços)
    .filter((palavra) => palavra.length > 1) // Filtra palavras muito curtas
    .map((palavra) => `\\b${palavra}\\b`) // Adiciona bordas de palavra
    .join(".*") // Permite qualquer coisa entre as palavras (.*)

  if (regexPadrao === "") return false

  try {
    const regex = new RegExp(regexPadrao, "i") // 'i' para ignorar maiúsculas/minúsculas
    return regex.test(textoNormalizado) // Testa se o padrão corresponde ao texto
  } catch (error) {
    console.error("Erro ao criar regex:", error)
    return false
  }
}

// Modificar a função isRelevantMatch para usar a nova busca por regex
export function isRelevantMatch(text: string, searchTerm: string, threshold = 0.3): boolean {
  // Primeiro tentar com regex para casos como "homem aranha" vs "homem-aranha"
  if (buscarPorRegex(text, searchTerm)) {
    return true
  }

  // Se não encontrar com regex, usar o método original baseado em pontuação
  const keywords = extractKeywords(searchTerm)
  if (keywords.length === 0) return false

  const score = calculateRelevanceScore(text, keywords)
  return score >= threshold
}

