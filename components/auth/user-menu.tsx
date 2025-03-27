"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { hasIPTVData } from "@/lib/prisma-storage"
import { clearUserSession, getUserEmail, getUserId, isUserLoggedIn } from "@/lib/user-service"
import { LogIn, LogOut, Trash2, User, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface UserMenuProps {
  userEmail?: string | null
}

export function UserMenu({ userEmail: serverUserEmail }: UserMenuProps) {
  const [email, setEmail] = useState<string | null>(serverUserEmail || null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasData, setHasData] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check client-side login status
    setIsLoggedIn(isUserLoggedIn())
    setEmail(getUserEmail())

    // Check if user has IPTV data
    const checkData = async () => {
      const hasData = await hasIPTVData()
      setHasData(hasData)
    }

    checkData()
  }, [])

  const handleLogout = () => {
    clearUserSession()
    setIsLoggedIn(false)
    setEmail(null)
    router.refresh()
  }

  const handleDeleteIPTV = async () => {
    try {
      setIsDeleting(true)
      const userId = getUserId()

      if (!userId) {
        throw new Error("User ID not found")
      }

      const response = await fetch(`/api/iptv/delete-all?userId=${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete IPTV data")
      }

      setHasData(false)
      setShowDeleteDialog(false)
      router.refresh()
    } catch (error) {
      console.error("Error deleting IPTV data:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      {isLoggedIn ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="max-w-[100px] truncate">{email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-muted-foreground">{email}</DropdownMenuItem>
              <DropdownMenuSeparator />

              {hasData && (
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Excluir Lista IPTV</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Lista IPTV</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir sua lista IPTV? Esta ação não pode ser desfeita e todos os seus canais,
                  categorias e dados relacionados serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    handleDeleteIPTV()
                  }}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Excluindo..." : "Sim, excluir tudo"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/login")}>
            <LogIn className="mr-2 h-4 w-4" />
            <span>Entrar</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => router.push("/register")}>
            <UserPlus className="mr-2 h-4 w-4" />
            <span>Registrar</span>
          </Button>
        </div>
      )}
    </div>
  )
}

