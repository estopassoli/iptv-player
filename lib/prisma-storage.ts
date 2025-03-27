"use client"

import type { Channel, IPTVData } from "@/types/iptv"
import { getUserId } from "./user-service"

// Constants
const CHUNK_SIZE = 5000 // Reduced chunk size to avoid issues with large datasets

// Store IPTV data
export async function storeIPTVData(data: IPTVData): Promise<void> {
  try {
    const userId = getUserId()

    if (!userId) {
      throw new Error("User ID not found")
    }

    // Store data in chunks to avoid timeouts
    const totalChannels = data.channels.length
    const chunks = Math.ceil(totalChannels / CHUNK_SIZE)

    for (let i = 0; i < chunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, totalChannels)
      const channelsChunk = data.channels.slice(start, end)

      await fetch("/api/iptv/store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          channels: channelsChunk,
          categories: i === 0 ? data.categories : [], // Only send categories with first chunk
          isFirstChunk: i === 0,
          isLastChunk: i === chunks - 1,
          totalChunks: chunks,
          currentChunk: i + 1,
        }),
      })
    }
  } catch (error) {
    console.error("Error storing IPTV data:", error)
    throw error
  }
}

// Check if IPTV data exists
export async function hasIPTVData(): Promise<boolean> {
  try {
    const userId = getUserId()

    if (!userId) {
      return false
    }

    const response = await fetch(`/api/iptv/has-data?userId=${userId}`)
    const data = await response.json()

    return data.hasData
  } catch (error) {
    console.error("Error checking IPTV data:", error)
    return false
  }
}

// Get all categories
export async function getAllCategories(): Promise<string[]> {
  try {
    const userId = getUserId()

    if (!userId) {
      return []
    }

    const response = await fetch(`/api/iptv/categories?userId=${userId}`)
    const data = await response.json()

    return data.categories
  } catch (error) {
    console.error("Error getting categories:", error)
    return []
  }
}

// Get channels paginated
export async function getChannelsPaginated(
  category = "all",
  page = 0,
  pageSize = 20,
): Promise<{ channels: Channel[]; total: number; hasMore: boolean }> {
  try {
    const userId = getUserId()

    if (!userId) {
      return { channels: [], total: 0, hasMore: false }
    }

    const response = await fetch(
      `/api/iptv/channels?userId=${userId}&category=${encodeURIComponent(category)}&page=${page}&pageSize=${pageSize}`,
    )

    return await response.json()
  } catch (error) {
    console.error("Error getting channels:", error)
    return { channels: [], total: 0, hasMore: false }
  }
}

// Search channels paginated
export async function searchChannelsPaginated(
  term: string,
  category = "all",
  page = 0,
  pageSize = 20,
): Promise<{ channels: Channel[]; total: number; hasMore: boolean }> {
  try {
    const userId = getUserId()
    console.log(term, category, page, pageSize)
    if (!userId) {
      return { channels: [], total: 0, hasMore: false }
    }

    const response = await fetch(
      `/api/iptv/search?userId=${userId}&term=${encodeURIComponent(term)}&category=${encodeURIComponent(category)}&page=${page}&pageSize=${pageSize}`,
    )

    return await response.json()
  } catch (error) {
    console.error("Error searching channels:", error)
    return { channels: [], total: 0, hasMore: false }
  }
}

