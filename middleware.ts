import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

export function middleware(request: NextRequest) {
  // Check if the user ID cookie exists
  const userId = request.cookies.get("iptv_user_id")?.value

  // If not, set a new random ID
  if (!userId) {
    const response = NextResponse.next()
    response.cookies.set("iptv_user_id", uuidv4(), {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}

