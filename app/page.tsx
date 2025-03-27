import { IPTVContent } from "@/components/iptv-content"
import { ThemeToggle } from "@/components/theme-toggle"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload } from "@/components/upload"
import { PlayCircle } from "lucide-react"
import { Suspense } from "react"

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <ScrollArea>
        <div className="border-b border-dashed w-full flex">
          <div className="container mx-auto">
            <div className="flex items-center justify-between border-dashed border-l border-r p-4 mx-auto">
              <div className="flex items-center gap-2">
                <PlayCircle size={32} />
                <h1 className="text-3xl font-bold">IPTV Viewer</h1>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="border-b border-dashed w-full flex">
          <div className="container mx-auto">
            <div className="flex flex-col items-start border-dashed border-l border-r mx-auto p-6">
              <h2 className="text-xl font-bold">Instruções</h2>
              <p className="text-sm">
                1. Clique no botão "Escolher arquivo" para selecionar o arquivo de playlist IPTV ou cole a URL da lista
                IPTV m3u.
              </p>
              <p className="text-sm">2. Clique no botão "Enviar" para carregar a playlist.</p>
              <p className="text-sm">3. Clique no botão "Play" para assistir ao canal.</p>
            </div>
          </div>
        </div>

        <div className="border-b border-dashed w-full flex">
          <div className="container mx-auto">
            <div className="flex flex-col border-dashed border-l border-r p-2 mx-auto">
              <Upload />
            </div>
          </div>
        </div>
        <div className="border-b border-dashed w-full flex overflow-x-hidden">
          <div className="container mx-auto">
            <div className="flex flex-col border-dashed border-l border-r p-2 mx-auto">
              <Suspense fallback={<div className="mt-8 text-center">Carregando conteúdo...</div>}>
                <IPTVContent />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="border-dashed w-full flex">
          <div className="container mx-auto">
            <div className="flex flex-col border-dashed border-l border-r p-2 py-4 text-sm mx-auto">
              <div className="flex items-center gap-1">
                <p>
                  Built by
                </p>
                <a className="underline font-semibold" href="https://github.com/estopassoli">
                  estopassoli
                </a>
                <p>
                  with
                </p>
                <a className="underline font-semibold" href="https://v0.dev">
                  v0.dev.
                </a>
                <p>The source code is available on</p>
                <a className="underline font-semibold" href="https://github.com/estopassoli/iptv-player">
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </main>
  )
}

