
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "./scroll-area"
import { Input } from "./input";

export type ComboboxOption = {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyPlaceholder?: string
  className?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyPlaceholder = "Nothing found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn("w-full pr-8", className)}
          aria-expanded={open}
        />
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((prev) => !prev)}
          >
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            <span className="sr-only">Toggle suggestions</span>
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()} // prevent focus steal
      >
        <Command>
          {/* We don't need a visible search input inside the popover anymore */}
          <CommandList>
            <CommandEmpty>{emptyPlaceholder}</CommandEmpty>
            <CommandGroup>
                <ScrollArea className="max-h-60">
                    {options
                        .filter(option => option.label.toLowerCase().includes(value?.toLowerCase() ?? ''))
                        .map((option) => (
                        <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => {
                                onChange(option.value);
                                setOpen(false);
                                inputRef.current?.blur();
                            }}
                        >
                            <Check
                                className={cn(
                                "mr-2 h-4 w-4",
                                value?.toLowerCase() === option.value.toLowerCase() ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {option.label}
                        </CommandItem>
                    ))}
                </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
