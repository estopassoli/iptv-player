"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { parseM3U } from "@/lib/m3u-parser"
import { hasIPTVData, storeIPTVData } from "@/lib/prisma-storage"
import { initializeUser } from "@/lib/user-service"
import { LinkIcon, Loader2, UploadIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export function Upload() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [url, setUrl] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    const checkData = async () => {
      try {
        const hasExistingData = await hasIPTVData()
        setHasData(hasExistingData)
      } catch (error) {
        console.error("Error checking for existing data:", error)
      }
    }

    checkData()
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    setUploadSuccess(false)

    try {
      // Ensure user is initialized
      await initializeUser()

      // Read the file
      const content = await readFileAsText(file, (progress) => {
        setUploadProgress(Math.round(progress * 50)) // First 50% is reading the file
      })

      // Parse the M3U content
      const parsedContent = parseM3U(content)

      // Store the data
      await storeIPTVData(parsedContent)

      setUploadSuccess(true)
      setUploadProgress(100)

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      // Reload the page to show the new content
      window.location.reload()
    } catch (error) {
      console.error("Error uploading file:", error)
      setUploadError("Failed to upload file. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleUrlSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!url.trim()) return

    setIsUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    setUploadSuccess(false)

    try {
      // Ensure user is initialized
      await initializeUser()

      // Fetch the M3U content from the API
      const response = await fetch(`/api/fetch-m3u?url=${encodeURIComponent(url)}`)

      if (!response.ok) {
        throw new Error("Failed to fetch M3U content")
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Store the data
      await storeIPTVData(data.content)

      setUploadSuccess(true)
      setUploadProgress(100)
      setUrl("")

      // Reload the page to show the new content
      window.location.reload()
    } catch (error) {
      console.error("Error fetching M3U:", error)
      setUploadError("Failed to fetch M3U content. Please check the URL and try again.")
    } finally {
      setIsUploading(false)
    }
  }

  // Helper function to read a file as text with progress
  const readFileAsText = (file: File, onProgress: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = event.loaded / event.total
          onProgress(progress)
        }
      }

      reader.onload = () => {
        resolve(reader.result as string)
      }

      reader.onerror = () => {
        reject(new Error("Failed to read file"))
      }

      reader.readAsText(file)
    })
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      {hasData ? (
        <div className="text-center p-4 border rounded-lg">
          <p className="mb-2">Você já possui uma lista IPTV carregada.</p>
          <p className="text-sm text-muted-foreground mb-4">
            Para carregar uma nova lista, primeiro exclua a atual através do menu de usuário.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <UploadIcon className="h-4 w-4" />
              <span>Upload File</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              <span>URL</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="m3u-file">Upload M3U File</Label>
                <Input
                  ref={fileInputRef}
                  id="m3u-file"
                  type="file"
                  accept=".m3u,.m3u8"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading... {uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300 ease-in-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && <div className="text-destructive text-sm">{uploadError}</div>}

              {uploadSuccess && <div className="text-green-500 text-sm">Upload successful!</div>}
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-4">
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="m3u-url">M3U URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="m3u-url"
                    type="url"
                    placeholder="https://example.com/playlist.m3u"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isUploading}
                  />
                  <Button type="submit" disabled={isUploading || !url.trim()}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
                  </Button>
                </div>
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading... {uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300 ease-in-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && <div className="text-destructive text-sm">{uploadError}</div>}

              {uploadSuccess && <div className="text-green-500 text-sm">URL loaded successfully!</div>}
            </form>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

