"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { hasIPTVData } from "@/lib/idb-storage"

export function SearchBar() {
  const [searchTerm, setSearchTerm] = useState("")
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    // Check if there's any content loaded using IndexedDB
    const checkContent = async () => {
      const contentExists = await hasIPTVData()
      setHasContent(contentExists)
    }

    checkContent()

    // Set up event listener for search
    const handleSearch = () => {
      const event = new CustomEvent("iptv-search", {
        detail: { searchTerm },
      })
      window.dispatchEvent(event)
    }

    // Debounce search to avoid too many events
    const debounceTimeout = setTimeout(handleSearch, 300)

    return () => clearTimeout(debounceTimeout)
  }, [searchTerm])

  if (!hasContent) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Buscar canais, filmes ou séries..."
        className="pl-10"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </motion.div>
  )
}

