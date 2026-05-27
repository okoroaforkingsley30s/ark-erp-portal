import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        `
        rounded-3xl
        border
        border-white/10
        bg-[#102969]/90
        text-white
        backdrop-blur-xl
        shadow-[0_0_30px_rgba(0,0,0,0.25)]
        transition-all
        duration-300
        hover:border-[#ff5a00]/20
        hover:shadow-[0_0_40px_rgba(255,90,0,0.08)]
        `,
        className
      )}
      {...props}
    />
  )
);

Card.displayName = "Card";

const CardHeader = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        `
        flex
        flex-col
        space-y-2
        p-6
        `,
        className
      )}
      {...props}
    />
  )
);

CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        `
        font-bold
        leading-none
        tracking-tight
        text-white
        text-lg
        `,
        className
      )}
      {...props}
    />
  )
);

CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        `
        text-sm
        text-slate-300
        `,
        className
      )}
      {...props}
    />
  )
);

CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        `
        p-6
        pt-0
        text-slate-100
        `,
        className
      )}
      {...props}
    />
  )
);

CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        `
        flex
        items-center
        p-6
        pt-0
        `,
        className
      )}
      {...props}
    />
  )
);

CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent
};