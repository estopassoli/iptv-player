import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
  try {
    const { email, password, userId } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    let user

    // If userId is provided, update the existing user
    if (userId) {
      // Check if user exists
      const existingUserById = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (existingUserById) {
        // Update existing user
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            email,
            passwordHash,
          },
        })
      } else {
        // Create new user with provided ID
        user = await prisma.user.create({
          data: {
            id: userId,
            email,
            passwordHash,
          },
        })
      }
    } else {
      // Create new user with generated ID
      user = await prisma.user.create({
        data: {
          id: uuidv4(),
          email,
          passwordHash,
        },
      })
    }

    return NextResponse.json({
      message: "User registered successfully",
      userId: user.id,
      email: user.email,
    })
  } catch (error) {
    console.error("Error registering user:", error)
    return NextResponse.json({ error: "Failed to register user" }, { status: 500 })
  }
}

