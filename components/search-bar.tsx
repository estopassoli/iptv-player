"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/use-debounce"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

interface SearchBarProps {
  onSearch?: (term: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({ onSearch, placeholder = "Buscar...", className = "" }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debouncedSearchTerm && debouncedSearchTerm.length > 2) {
      if (onSearch) {
        onSearch(debouncedSearchTerm)
      } else {
        router.push(`/search?q=${encodeURIComponent(debouncedSearchTerm)}`)
      }
    }
  }, [debouncedSearchTerm, onSearch, router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      if (onSearch) {
        onSearch(searchTerm)
      } else {
        router.push(`/search?q=${encodeURIComponent(searchTerm)}`)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`relative flex w-full ${className}`}>
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pr-10"
      />
      <Button type="submit" variant="ghost" size="icon" className="absolute right-0 top-0 h-full">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  )
}

