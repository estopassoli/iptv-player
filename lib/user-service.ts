"use client"

import { v4 as uuidv4 } from "uuid"

// Constants
const USER_ID_KEY = "iptv_user_id"
const USER_EMAIL_KEY = "iptv_user_email"

// Get or create user ID
export function getUserId(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  let userId = localStorage.getItem(USER_ID_KEY)

  if (!userId) {
    // Generate a new UUID
    userId = uuidv4()

    // Store in localStorage
    localStorage.setItem(USER_ID_KEY, userId)
  }

  return userId
}

// Initialize user in the database
export async function initializeUser(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Cannot initialize user on server side")
  }

  const userId = getUserId()

  if (!userId) {
    throw new Error("Failed to generate user ID")
  }

  try {
    // Check if user already exists in the database
    const response = await fetch("/api/auth/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      throw new Error("Failed to initialize user")
    }
  } catch (error) {
    console.error("Error initializing user:", error)
    // Don't throw error here to allow the app to continue
  }

  return userId
}

// Set user ID and email after login
export function setUserSession(userId: string, email: string): void {
  if (typeof window === "undefined") {
    return
  }

  localStorage.setItem(USER_ID_KEY, userId)
  localStorage.setItem(USER_EMAIL_KEY, email)
}

// Clear user session on logout
export function clearUserSession(): void {
  if (typeof window === "undefined") {
    return
  }

  // Generate a new anonymous ID
  const newId = uuidv4()
  localStorage.setItem(USER_ID_KEY, newId)
  localStorage.removeItem(USER_EMAIL_KEY)
}

// Check if user is logged in (has email)
export function isUserLoggedIn(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  return !!localStorage.getItem(USER_EMAIL_KEY)
}

// Get user email
export function getUserEmail(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  return localStorage.getItem(USER_EMAIL_KEY)
}

