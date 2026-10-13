import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function SelectionCheck({ className }: { className?: string }) {
  return <span className={cn("selection-check", className)} aria-hidden="true"><Check className="size-3" /></span>;
}
