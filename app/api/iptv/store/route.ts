import prisma from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { userId, channels, categories, isFirstChunk, isLastChunk } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // If this is the first chunk, clear existing data
    if (isFirstChunk) {
      // Delete existing channels
      await prisma.channel.deleteMany({
        where: { userId },
      })

      // Delete existing categories
      await prisma.category.deleteMany({
        where: { userId },
      })

      // Store categories
      if (categories && categories.length > 0) {
        await prisma.category.createMany({
          data: categories.map((name: string) => ({
            userId,
            name,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Store channels in batches
    if (channels && channels.length > 0) {
      // Process in smaller batches to avoid DB limits
      const batchSize = 100 * 1000; // 100k channels at a time
      for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize)

        await prisma.channel.createMany({
          data: batch.map((channel: any) => ({
            id: channel.id,
            userId,
            name: channel.name,
            url: channel.url,
            logo: channel.logo || null,
            group: channel.group || null,
            season: channel.season || null,
            episode: channel.episode || null,
            categories: channel.categories || [],
          })),
          skipDuplicates: true,
        })
      }
    }

    // If this is the last chunk, update metadata
    if (isLastChunk) {
      // Count total channels
      const totalChannels = await prisma.channel.count({
        where: { userId },
      })

      // Store metadata
      await prisma.metadata.upsert({
        where: {
          userId_key: {
            userId,
            key: "totalChannels",
          },
        },
        update: {
          value: totalChannels.toString(),
        },
        create: {
          userId,
          key: "totalChannels",
          value: totalChannels.toString(),
        },
      })

      // Store last updated timestamp
      await prisma.metadata.upsert({
        where: {
          userId_key: {
            userId,
            key: "lastUpdated",
          },
        },
        update: {
          value: new Date().toISOString(),
        },
        create: {
          userId,
          key: "lastUpdated",
          value: new Date().toISOString(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error storing IPTV data:", error)
    return NextResponse.json({ error: "Failed to store IPTV data" }, { status: 500 })
  }
}

