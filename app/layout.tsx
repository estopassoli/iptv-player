import "@/app/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Geist } from "next/font/google"
import type React from "react"

const inter = Geist({ subsets: ["latin"] })

export const metadata = {
  title: "M3U IPTV Player - Assista TV Online Gratuitamente",
  description: "O melhor player de IPTV M3U para assistir TV ao vivo online. Compatível com listas M3U, fácil de usar e gratuito. Assista seus canais favoritos agora!",
  keywords: "iptv, m3u, iptv grátis, iptv player, assistir tv online, tv ao vivo, iptv m3u, player iptv online",
  robots: "index, follow",
  author: "Seu Nome ou Nome do Site",
  openGraph: {
    title: "M3U IPTV Player - O Melhor Player IPTV Online",
    description: "Assista TV ao vivo online com o melhor player IPTV compatível com listas M3U.",
    url: "https://iptv-player-chi.vercel.app",
    type: "website",
    image: "https://iptv-player-chi.vercel.app/logo.png",
  },
  twitter: {
    card: "summary_large_image",
    title: "M3U IPTV Player - Assista TV Online Gratuitamente",
    description: "Player IPTV compatível com listas M3U para assistir TV ao vivo online.",
    image: "https://iptv-player-chi.vercel.app/logo.png",
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          storageKey="iptv-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}