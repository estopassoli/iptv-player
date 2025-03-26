import { type NextRequest, NextResponse } from "next/server"
import { parseM3U } from "@/lib/m3u-parser"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  try {
    console.log("Fetching M3U from URL:", url)
    const response = await fetch(url, {
      // Add a timeout to prevent hanging on large files
      signal: AbortSignal.timeout(60000), // 60 second timeout
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch M3U content: ${response.statusText}`)
    }

    const content = await response.text()
    console.log("M3U content received, processing...")

    const parsedContent = parseM3U(content)
    console.log(`Parsed ${parsedContent.channels.length} channels in ${parsedContent.categories.length} categories`)

    return NextResponse.json({ content: parsedContent })
  } catch (error) {
    console.error("Error fetching M3U content:", error)
    return NextResponse.json({ error: "Failed to fetch or parse M3U content" }, { status: 500 })
  }
}

