
"use client"

import * as React from "react"
import { Moon, Sun, Check } from "lucide-react"
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
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const MenuItem = ({ themeName, displayName }: { themeName: string, displayName: string }) => (
    <DropdownMenuItem onClick={() => setTheme(themeName)}>
      <Check className={cn("mr-2 h-4 w-4", theme === themeName ? "opacity-100" : "opacity-0")} />
      {displayName}
    </DropdownMenuItem>
  );

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
        <MenuItem themeName="light" displayName="Default Light" />
        <MenuItem themeName="theme-minimal-light" displayName="Minimal Light" />
        <MenuItem themeName="theme-neumorphism" displayName="Neumorphism" />
        <MenuItem themeName="theme-retro-vintage" displayName="Retro / Vintage" />
        <MenuItem themeName="theme-material-design" displayName="Material Design" />
        <MenuItem themeName="theme-y2k" displayName="Y2K Aesthetic" />
        <MenuItem themeName="theme-nature-earthy" displayName="Nature / Earthy" />
        <MenuItem themeName="theme-corporate" displayName="Corporate" />
        <MenuItem themeName="theme-cartoon" displayName="Cartoon / Playful" />
        <MenuItem themeName="theme-monochrome-blue" displayName="Monochrome Blue" />

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Dark Themes</DropdownMenuLabel>
        <MenuItem themeName="dark" displayName="Default Dark" />
        <MenuItem themeName="theme-minimal-dark" displayName="Minimal Dark" />
        <MenuItem themeName="theme-glassmorphism" displayName="Glassmorphism" />
        <MenuItem themeName="theme-cyberpunk" displayName="Cyberpunk / Neon" />
        <MenuItem themeName="theme-sci-fi" displayName="Futuristic Sci-Fi" />
        <MenuItem themeName="theme-luxury" displayName="Luxury / Premium" />
        <MenuItem themeName="theme-gradient-modern" displayName="Gradient Modern" />

        <DropdownMenuSeparator />
        <MenuItem themeName="system" displayName="System" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
