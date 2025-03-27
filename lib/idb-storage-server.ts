import type { IPTVData } from "@/types/iptv"
import fs from "fs"
import path from "path"

// Caminho para o arquivo de cache
const CACHE_FILE = path.join(process.cwd(), "cache", "iptv-data.json")

// Função para obter dados IPTV do servidor
export async function getIPTVData(): Promise<IPTVData | null> {
  try {
    // Verificar se o diretório de cache existe
    const cacheDir = path.join(process.cwd(), "cache")
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }

    // Verificar se o arquivo de cache existe
    if (!fs.existsSync(CACHE_FILE)) {
      return null
    }

    // Ler o arquivo de cache
    const data = fs.readFileSync(CACHE_FILE, "utf-8")
    return JSON.parse(data) as IPTVData
  } catch (error) {
    console.error("Erro ao obter dados IPTV do servidor:", error)
    return null
  }
}

// Função para salvar dados IPTV no servidor
export async function saveIPTVData(data: IPTVData): Promise<void> {
  try {
    // Verificar se o diretório de cache existe
    const cacheDir = path.join(process.cwd(), "cache")
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }

    // Salvar os dados no arquivo de cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data))
  } catch (error) {
    console.error("Erro ao salvar dados IPTV no servidor:", error)
  }
}

