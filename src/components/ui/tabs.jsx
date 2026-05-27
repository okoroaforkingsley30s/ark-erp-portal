import * as React from "react";

import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        `
        inline-flex
        items-center
        justify-center
        gap-2

        rounded-2xl

        border
        border-white/10

        bg-[#0b1f5e]/80

        p-2

        backdrop-blur-xl

        shadow-[0_0_25px_rgba(0,0,0,0.2)]
        `,
        className
      )}
      {...props}
    />
  )
);

TabsList.displayName =
  TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        `
        inline-flex
        items-center
        justify-center
        whitespace-nowrap

        rounded-xl

        px-4
        py-2.5

        text-sm
        font-semibold

        text-slate-300

        transition-all
        duration-300

        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-[#ff5a00]/30

        disabled:pointer-events-none
        disabled:opacity-50

        hover:bg-[#ff5a00]/10
        hover:text-[#ff5a00]

        data-[state=active]:bg-gradient-to-br
        data-[state=active]:from-[#ff5a00]
        data-[state=active]:to-[#ff7a2f]

        data-[state=active]:text-white

        data-[state=active]:shadow-[0_0_25px_rgba(255,90,0,0.25)]

        data-[state=active]:border
        data-[state=active]:border-[#ff5a00]/30
        `,
        className
      )}
      {...props}
    />
  )
);

TabsTrigger.displayName =
  TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        `
        mt-4

        focus-visible:outline-none
        focus-visible:ring-0

        animate-in
        fade-in-50
        duration-300
        `,
        className
      )}
      {...props}
    />
  )
);

TabsContent.displayName =
  TabsPrimitive.Content.displayName;

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
};