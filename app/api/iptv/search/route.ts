import { db } from "@/lib/db"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const term = searchParams.get("term") || ""

    if (!userId) {
      return NextResponse.json({ channels: [], total: 0, hasMore: false })
    }

    // If term is empty, return empty results
    if (!term.trim()) {
      return NextResponse.json({ channels: [], total: 0, hasMore: false })
    }

    // Split the search term into words
    const searchWords = term
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 1)

    if (searchWords.length === 0) {
      return NextResponse.json({ channels: [], total: 0, hasMore: false })
    }

    // Create conditions for each word (ALL words must be present)
    const wordConditions = searchWords.map((word) => ({
      name: {
        contains: word,
        mode: "insensitive" as const,
      },
    }))

    // First, try to find exact matches (highest priority)
    const exactMatches = await db.channel.findMany({
      where: {
        userId,
        name: {
          equals: term,
          mode: "insensitive" as const,
        },
      },
    })

    // Then, find channels that contain the exact phrase
    const phraseMatches = await db.channel.findMany({
      where: {
        userId,
        name: {
          contains: term,
          mode: "insensitive" as const,
        },
        id: {
          notIn: exactMatches.map((channel) => channel.id),
        },
      },
    })

    // Find channels that contain ALL of the search words
    const wordMatches = await db.channel.findMany({
      where: {
        userId,
        AND: wordConditions, // This ensures ALL conditions must be met
        id: {
          notIn: [...exactMatches, ...phraseMatches].map((channel) => channel.id),
        },
      },
    })

    // Combine all results, with exact matches first, then phrase matches, then word matches
    const channels = [...exactMatches, ...phraseMatches, ...wordMatches]

    return NextResponse.json({
      channels,
      total: channels.length,
      hasMore: false,
    })
  } catch (error) {
    console.error("Error searching channels:", error)
    return NextResponse.json({ error: "Failed to search channels" }, { status: 500 })
  }
}

