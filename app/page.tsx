import { UserMenu } from "@/components/auth/user-menu"
import { ClientContentWrapper } from "@/components/client-content-wrapper"
import { ThemeToggle } from "@/components/theme-toggle"
import { ScrollArea } from "@/components/ui/scroll-area"
import prisma from "@/lib/prisma"
import { PlayCircle } from "lucide-react"
import { cookies } from "next/headers"

async function getUserEmail() {
  // In a real app, you'd use a session or token
  // For this example, we'll read from a cookie
  const cookieStore = await cookies()
  const userId = cookieStore.get("iptv_user_id")?.value

  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  return user?.email
}

export default async function Home() {
  const userEmail = await getUserEmail()

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
              <div className="flex items-center gap-2">
                <UserMenu userEmail={userEmail} />
                <ThemeToggle />
              </div>
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

        <ClientContentWrapper />

        <div className="border-dashed w-full flex">
          <div className="container mx-auto">
            <div className="flex flex-col border-dashed border-l border-r p-2 py-4 h-[24svh] text-sm mx-auto">
              <h1>
                Built by{" "}
                <a className="underline font-semibold" href="https://github.com/estopassoli">
                  estopassoli
                </a>
                . The source code is available on{" "}
                <a className="underline font-semibold" href="https://github.com/estopassoli/iptv-player">
                  GitHub
                </a>
                .
              </h1>
            </div>
          </div>
        </div>
      </ScrollArea>
    </main>
  )
}

