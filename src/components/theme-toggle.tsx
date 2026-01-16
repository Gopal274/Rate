"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Light Themes</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Default Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("minimal-light")}>
          Minimal Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("neumorphism")}>
          Neumorphism
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("retro-vintage")}>
          Retro / Vintage
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("material-design")}>
          Material Design
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("y2k")}>
          Y2K Aesthetic
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("nature-earthy")}>
          Nature / Earthy
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("corporate")}>
          Corporate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("cartoon")}>
          Cartoon / Playful
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("monochrome-blue")}>
          Monochrome Blue
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Dark Themes</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Default Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("minimal-dark")}>
          Minimal Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("glassmorphism")}>
          Glassmorphism
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("cyberpunk")}>
          Cyberpunk / Neon
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("sci-fi")}>
          Futuristic Sci-Fi
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("luxury")}>
          Luxury / Premium
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("gradient-modern")}>
          Gradient Modern
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
