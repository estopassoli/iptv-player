/**
 * Formata o tempo em segundos para o formato MM:SS ou HH:MM:SS
 * @param timeInSeconds Tempo em segundos
 * @param forceHours Força a exibição de horas mesmo se for zero
 * @returns String formatada no formato MM:SS ou HH:MM:SS
 */
export function formatTime(timeInSeconds: number, forceHours = false): string {
    if (isNaN(timeInSeconds)) return "00:00"
  
    const hours = Math.floor(timeInSeconds / 3600)
    const minutes = Math.floor((timeInSeconds % 3600) / 60)
    const seconds = Math.floor(timeInSeconds % 60)
  
    if (hours > 0 || forceHours) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }
  
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }
  
  