import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

/** Context nội bộ để Trigger thông báo trạng thái pointer cho Tooltip */
const TooltipPointerCtx = React.createContext<{
  setPointer: (v: boolean) => void
} | null>(null)

/**
 * Tooltip – chỉ mở khi hover (không mở khi focus)
 * Mặc định hành vi Radix mở tooltip khi trigger nhận focus → gây tooltip xuất hiện
 * khi Dialog auto-focus phần tử đầu tiên. Fix: dùng controlled open + pointer tracking.
 */
function Tooltip({
  children,
  open: controlledOpen,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  const [open, setOpen] = React.useState(false)
  const isPointerRef = React.useRef(false)

  const ctx = React.useMemo(
    () => ({ setPointer: (v: boolean) => { isPointerRef.current = v } }),
    []
  )

  const handleOpenChange = (val: boolean) => {
    // Chặn mở bởi focus – chỉ cho phép khi con trỏ đang hover
    if (val && !isPointerRef.current) return
    if (controlledOpen === undefined) setOpen(val)
    onOpenChange?.(val)
  }

  return (
    <TooltipPrimitive.Root
      open={controlledOpen ?? open}
      onOpenChange={handleOpenChange}
      {...props}
    >
      <TooltipPointerCtx.Provider value={ctx}>
        {children}
      </TooltipPointerCtx.Provider>
    </TooltipPrimitive.Root>
  )
}

/**
 * TooltipTrigger – inject pointer tracking để Tooltip biết khi nào con trỏ hover
 */
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onPointerEnter, onPointerLeave, ...props }, ref) => {
  const ctx = React.useContext(TooltipPointerCtx)
  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      onPointerEnter={(e) => {
        ctx?.setPointer(true)
        onPointerEnter?.(e)
      }}
      onPointerLeave={(e) => {
        ctx?.setPointer(false)
        onPointerLeave?.(e)
      }}
      {...props}
    />
  )
})
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
