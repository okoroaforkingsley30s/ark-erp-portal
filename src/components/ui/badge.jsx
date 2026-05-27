import * as React from "react";

import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  `
  inline-flex
  items-center
  rounded-full

  border

  px-3
  py-1

  text-[11px]
  font-bold

  tracking-wide

  transition-all
  duration-300

  focus:outline-none
  focus:ring-2
  focus:ring-[#ff5a00]/30
  `,
  {
    variants: {
      variant: {

        default:
          `
          border-[#ff5a00]/20
          bg-[#ff5a00]/15
          text-[#ff5a00]

          shadow-[0_0_15px_rgba(255,90,0,0.12)]

          hover:bg-[#ff5a00]/20
          `,

        secondary:
          `
          border-white/10
          bg-[#0b1f5e]
          text-slate-200

          hover:border-[#ff5a00]/20
          hover:text-white
          `,

        destructive:
          `
          border-red-500/20
          bg-red-500/15
          text-red-300

          shadow-[0_0_15px_rgba(239,68,68,0.12)]

          hover:bg-red-500/20
          `,

        outline:
          `
          border-white/10
          bg-transparent
          text-slate-300

          hover:border-[#ff5a00]/20
          hover:text-[#ff5a00]
          `,

        success:
          `
          border-emerald-500/20
          bg-emerald-500/15
          text-emerald-300

          shadow-[0_0_15px_rgba(16,185,129,0.12)]
          `,

        warning:
          `
          border-amber-500/20
          bg-amber-500/15
          text-amber-300

          shadow-[0_0_15px_rgba(245,158,11,0.12)]
          `,

        info:
          `
          border-cyan-500/20
          bg-cyan-500/15
          text-cyan-300

          shadow-[0_0_15px_rgba(6,182,212,0.12)]
          `,
      },
    },

    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}) {
  return (
    <div
      className={cn(
        badgeVariants({ variant }),
        className
      )}
      {...props}
    />
  );
}

export {
  Badge,
  badgeVariants
};