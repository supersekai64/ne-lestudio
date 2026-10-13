"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none inline-flex h-6 w-11 items-center rounded-full border border-primary bg-background p-0.5 transition-colors group-data-[size=sm]/switch:h-5 group-data-[size=sm]/switch:w-9 group-data-[state=checked]/switch:bg-primary"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="pointer-events-none block size-[1.125rem] rounded-full bg-primary ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground data-[state=unchecked]:translate-x-0 group-data-[size=sm]/switch:size-3.5 group-data-[size=sm]/switch:data-[state=checked]:translate-x-4 motion-reduce:transition-none"
        />
      </span>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
