import "@/app/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Geist } from "next/font/google"
import type React from "react"

const inter = Geist({ subsets: ["latin"] })

export const metadata = {
  title: "M3U IPTV Player - Assista TV Online Gratuitamente",
  description:
    "O melhor player de IPTV M3U para assistir TV ao vivo online. Compatível com listas M3U, fácil de usar e gratuito. Assista seus canais favoritos agora!",
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
  },
  themeColor: "#000000",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-512x512.png",
  },
  manifest: "/manifest.json",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="IPTV Player" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="IPTV Player" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#000000" />

        <link rel="apple-touch-icon" href="/icons/icon-512x512.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-192x192.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          storageKey="iptv-theme"
        >
          <Toaster />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

import "./globals.css"



import { Toaster } from "@/components/ui/toaster"
import './globals.css'

