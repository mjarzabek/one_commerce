import { StarIcon } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Gwiazdka przy wartości domyślnej (np. domyślna grupa cenowa) - z podpowiedzią.
export function DefaultStar() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex shrink-0 items-center text-amber-500" aria-label="Wartość domyślna">
            <StarIcon className="size-3.5 fill-current" />
          </span>
        }
      />
      <TooltipContent>Gwiazdka oznacza wartość domyślną</TooltipContent>
    </Tooltip>
  )
}
