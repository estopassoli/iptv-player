"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

// Dynamically import client components with no SSR
const IPTVContent = dynamic(() => import("@/components/iptv-content").then((mod) => ({ default: mod.IPTVContent })), {
  ssr: false,
})
const Upload = dynamic(() => import("@/components/upload").then((mod) => ({ default: mod.Upload })), { ssr: false })

export function ClientContentWrapper() {
  return (
    <>
      <div className="border-b border-dashed w-full flex">
        <div className="container mx-auto">
          <div className="flex flex-col border-dashed border-l border-r p-2 mx-auto">
            <Suspense fallback={<div className="p-8 text-center">Carregando componente de upload...</div>}>
              <Upload />
            </Suspense>
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
    </>
  )
}

