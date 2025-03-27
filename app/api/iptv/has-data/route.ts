import prisma from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Check if user has any channels
    const count = await prisma.channel.count({
      where: { userId },
    })

    return NextResponse.json({ hasData: count > 0 })
  } catch (error) {
    console.error("Error checking IPTV data:", error)
    return NextResponse.json({ error: "Failed to check IPTV data" }, { status: 500 })
  }
}

