import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 p-1 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:text-zinc-400 dark:data-[state=active]:bg-zinc-950 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[0_0_0_1px_rgba(63,63,70,0.9)]",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, onFocus, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    onFocus={(e) => {
      // Prevent browser scroll-into-view when the panel receives focus after tab switch
      const viewport = e.currentTarget.closest?.("[data-radix-scroll-area-viewport]");
      if (viewport) {
        const savedTop = viewport.scrollTop;
        requestAnimationFrame(() => { viewport.scrollTop = savedTop; });
      }
      onFocus?.(e);
    }}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
