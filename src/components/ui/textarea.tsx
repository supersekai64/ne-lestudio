import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full min-w-0 resize-y rounded-md border border-foreground/60 bg-background px-3 py-3 text-base leading-relaxed shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-destructive dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
