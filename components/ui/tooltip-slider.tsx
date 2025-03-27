"use client"

import { Slider } from "@/components/ui/slider"
import { formatTime } from "@/lib/format-time"
import type * as React from "react"
import { useRef, useState } from "react"

interface TooltipSliderProps {
  min: number
  max: number
  step?: number
  value: number[]
  onValueChange: (value: number[]) => void
  onValueCommit?: (value: number[]) => void
  duration: number
  bufferProgress?: number
  className?: string
  disabled?: boolean
}

export function TooltipSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  onValueCommit,
  duration,
  bufferProgress = 0,
  className = "",
  disabled = false,
}: TooltipSliderProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState(0)
  const [tooltipTime, setTooltipTime] = useState("")
  const sliderRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current || !duration) return

    const rect = sliderRef.current.getBoundingClientRect()
    const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const time = position * duration

    setTooltipPosition(position * 100)
    setTooltipTime(formatTime(time, duration >= 3600))
    setShowTooltip(true)
  }

  const handleMouseLeave = () => {
    setShowTooltip(false)
  }

  return (
    <div
      className={`relative ${className}`}
      ref={sliderRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Buffer progress indicator */}
      {bufferProgress > 0 && (
        <div
          className="absolute top-1/2 left-0 h-1 bg-white/30 rounded-full -translate-y-1/2 pointer-events-none"
          style={{ width: `${bufferProgress}%` }}
        />
      )}

      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
        disabled={disabled}
      />

      {showTooltip && (
        <div
          className="absolute top-0 -translate-y-8 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none"
          style={{ left: `calc(${tooltipPosition}% - 20px)` }}
        >
          {tooltipTime}
        </div>
      )}
    </div>
  )
}

