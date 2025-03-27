import type { Channel } from "@/types/iptv";

// Get user ID from localStorage
function getUserId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("userId")
}

export async function searchChannelsPaginated(
  term: string,
  category = "all",
  page = 0,
  pageSize = 100, // Increased default page size
): Promise<{ channels: Channel[]; total: number; hasMore: boolean }> {
  try {
    const userId = getUserId()
    console.log("Searching for:", term)

    if (!userId) {
      return { channels: [], total: 0, hasMore: false }
    }

    // Make the API call without category, page, or pageSize restrictions
    const response = await fetch(`/api/iptv/search?userId=${userId}&term=${encodeURIComponent(term)}`)

    const data = await response.json()

    if (!data.channels || !Array.isArray(data.channels)) {
      console.error("Invalid response format:", data)
      return { channels: [], total: 0, hasMore: false }
    }

    // Normalize the search term and split into words
    const searchWords = term
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 1)

    if (searchWords.length === 0) {
      return { channels: [], total: 0, hasMore: false }
    }

    // Filter channels to only include those that contain ALL search words
    const filteredChannels = data.channels.filter((channel: { name: string; }) => {
      const normalizedName = channel.name.toLowerCase()

      // Check if ALL search words are present in the channel name
      return searchWords.every((word) => normalizedName.includes(word))
    })

    // Score the filtered results for better ordering
    const scoredChannels = filteredChannels.map((channel: { name: string; }) => {
      const normalizedName = channel.name.toLowerCase()
      let score = 0

      // EXACT MATCH - Highest priority
      if (normalizedName === term.toLowerCase()) {
        score += 1000 // Extremely high score for exact matches
      }

      // CONTAINS EXACT PHRASE - High priority
      else if (normalizedName.includes(term.toLowerCase())) {
        score += 500

        // Even higher if it starts with the search term
        if (normalizedName.startsWith(term.toLowerCase())) {
          score += 200
        }
      }

      // WORD-BY-WORD MATCHING - Medium priority
      else {
        // Count how many words match at word boundaries
        let boundaryMatches = 0

        for (const word of searchWords) {
          // Bonus for word boundary matches (whole word matches)
          const regex = new RegExp(`\\b${word}\\b`, "i")
          if (regex.test(normalizedName)) {
            boundaryMatches++
            score += 50
          } else {
            // Still give some points for containing the word
            score += 20
          }

          // Bonus if the word appears at the beginning
          if (normalizedName.startsWith(word)) {
            score += 30
          }
        }

        // Bonus for matching all words at word boundaries
        if (boundaryMatches === searchWords.length) {
          score += 100
        }
      }

      // Apply penalties for much longer titles (likely less relevant)
      const lengthDifference = Math.abs(normalizedName.length - term.length)
      if (lengthDifference > term.length * 2) {
        score -= 20
      }

      return { channel, score }
    })

    // Sort by score (highest first)
    const sortedChannels = scoredChannels.sort((a: { score: number; }, b: { score: number; }) => b.score - a.score).map((item: { channel: any; }) => item.channel)

    console.log(`Found ${sortedChannels.length} channels containing ALL search words`)

    return {
      channels: sortedChannels,
      total: sortedChannels.length,
      hasMore: false, // Since we're returning all matches
    }
  } catch (error) {
    console.error("Error searching channels:", error)
    return { channels: [], total: 0, hasMore: false }
  }
}

