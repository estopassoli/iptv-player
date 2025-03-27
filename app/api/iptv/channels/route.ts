import prisma from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    const category = request.nextUrl.searchParams.get("category") || "all"
    const page = Number.parseInt(request.nextUrl.searchParams.get("page") || "0")
    const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") || "20")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Build query
    const where = {
      userId,
      ...(category !== "all"
        ? {
            categories: {
              has: category,
            },
          }
        : {}),
    }

    // Get total count
    const total = await prisma.channel.count({ where })

    // Get channels for current page
    const channels = await prisma.channel.findMany({
      where,
      skip: page * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
    })

    // Check if there are more pages
    const hasMore = (page + 1) * pageSize < total

    return NextResponse.json({
      channels,
      total,
      hasMore,
    })
  } catch (error) {
    console.error("Error getting channels:", error)
    return NextResponse.json({ error: "Failed to get channels" }, { status: 500 })
  }
}

