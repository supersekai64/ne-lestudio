"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-base leading-6 font-medium [overflow-wrap:anywhere] select-none group-data-[disabled=true]:opacity-70 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 [&>span]:min-w-0",
        className
      )}
      {...props}
    />
  )
}

export { Label }
