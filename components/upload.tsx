"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { UploadIcon, LinkIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { parseM3U } from "@/lib/m3u-parser"
import { storeIPTVData } from "@/lib/idb-storage"

export function Upload() {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("file")
  const [url, setUrl] = useState("")
  const [progress, setProgress] = useState(0)
  const { toast } = useToast()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setProgress(0)
    try {
      const content = await file.text()
      console.log("Processando arquivo M3U...")
      setProgress(30)

      // Processar o arquivo M3U usando a biblioteca iptv-playlist-parser
      const parsedContent = parseM3U(content)
      setProgress(60)

      // Log de informações sobre o conteúdo processado
      console.log(
        `Processados ${parsedContent.channels.length} canais em ${parsedContent.categories.length} categorias`,
      )

      // Armazenar o conteúdo processado no IndexedDB
      await storeIPTVData(parsedContent)
      setProgress(100)

      toast({
        title: "Arquivo processado com sucesso",
        description: `${parsedContent.channels.length} canais encontrados em ${parsedContent.categories.length} categorias.`,
      })

      // Forçar um reload da página para mostrar o conteúdo
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error("Erro ao processar arquivo M3U:", error)
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o formato do arquivo é válido.",
        variant: "destructive",
      })
      setProgress(0)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setIsLoading(true)
    setProgress(0)
    try {
      setProgress(10)
      const response = await fetch(`/api/fetch-m3u?url=${encodeURIComponent(url)}`)

      if (!response.ok) {
        throw new Error("Falha ao buscar conteúdo M3U")
      }

      setProgress(50)
      const data = await response.json()

      // Armazenar o conteúdo processado no IndexedDB
      await storeIPTVData(data.content)
      setProgress(100)

      toast({
        title: "Conteúdo carregado com sucesso",
        description: `${data.content.channels.length} canais encontrados.`,
      })

      // Forçar um reload da página para mostrar o conteúdo
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error("Erro ao carregar M3U da URL:", error)
      toast({
        title: "Erro ao carregar URL",
        description: "Verifique se a URL é válida e acessível.",
        variant: "destructive",
      })
      setProgress(0)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div>
        <CardHeader>
          <CardTitle>Adicionar Conteúdo IPTV</CardTitle>
          <CardDescription>
            Faça upload de um arquivo .m3u ou insira uma URL remota para carregar seu conteúdo IPTV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="file" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">Arquivo</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg">
                <UploadIcon className="w-10 h-10 mb-4 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  Arraste e solte seu arquivo .m3u aqui ou clique para selecionar
                </p>
                <Input
                  type="file"
                  accept=".m3u,.m3u8"
                  className="max-w-xs"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                />
              </div>
            </TabsContent>
            <TabsContent value="url" className="mt-4">
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div className="flex items-center space-x-2">
                  <LinkIcon className="w-5 h-5 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="https://exemplo.com/playlist.m3u"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    "Carregar URL"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {isLoading && (
            <div className="mt-4">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center mt-1 text-muted-foreground">
                {progress < 100 ? "Processando..." : "Concluído!"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

