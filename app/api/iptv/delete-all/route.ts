import prisma from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Delete all user's channels
    await prisma.channel.deleteMany({
      where: { userId },
    })

    // Delete all user's categories
    await prisma.category.deleteMany({
      where: { userId },
    })

    // Delete all user's metadata
    await prisma.metadata.deleteMany({
      where: { userId },
    })

    // Delete all user's search cache
    await prisma.searchCache.deleteMany({
      where: { userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting IPTV data:", error)
    return NextResponse.json({ error: "Failed to delete IPTV data" }, { status: 500 })
  }
}

