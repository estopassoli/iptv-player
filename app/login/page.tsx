import { LoginForm } from "@/components/auth/login-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { PlayCircle } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <PlayCircle size={32} />
            <h1 className="text-2xl font-bold">IPTV Viewer</h1>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <LoginForm />
      </main>

      <footer className="border-t p-4 text-center text-sm text-muted-foreground">
        <p>
          Built by{" "}
          <a className="underline font-semibold" href="https://github.com/estopassoli">
            estopassoli
          </a>
        </p>
      </footer>
    </div>
  )
}

