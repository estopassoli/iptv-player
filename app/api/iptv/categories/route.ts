import prisma from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get all categories
    const categories = await prisma.category.findMany({
      where: { userId },
      select: { name: true },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ categories: categories.map((c) => c.name) })
  } catch (error) {
    console.error("Error getting categories:", error)
    return NextResponse.json({ error: "Failed to get categories" }, { status: 500 })
  }
}

