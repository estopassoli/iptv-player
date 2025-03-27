import prisma from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    // If no userId is provided, generate a new one
    const id = userId || uuidv4()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (existingUser) {
      return NextResponse.json({
        message: "User already exists",
        userId: existingUser.id,
      })
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        id,
      },
    })

    return NextResponse.json({
      message: "User initialized successfully",
      userId: user.id,
    })
  } catch (error) {
    console.error("Error initializing user:", error)
    return NextResponse.json({ error: "Failed to initialize user" }, { status: 500 })
  }
}

