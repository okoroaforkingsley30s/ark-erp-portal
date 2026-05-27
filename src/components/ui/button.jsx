import * as React from "react";

import { Slot } from "@radix-ui/react-slot";

import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  `
  inline-flex
  items-center
  justify-center
  gap-2
  whitespace-nowrap
  rounded-xl
  text-sm
  font-semibold
  transition-all
  duration-300
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-[#ff5a00]/40
  disabled:pointer-events-none
  disabled:opacity-50
  [&_svg]:pointer-events-none
  [&_svg]:size-4
  [&_svg]:shrink-0
  `,
  {
    variants: {
      variant: {
        default:
          `
          bg-[#ff5a00]
          text-white
          border
          border-[#ff5a00]
          shadow-[0_0_20px_rgba(255,90,0,0.15)]
          hover:bg-[#ff6d1f]
          hover:shadow-[0_0_30px_rgba(255,90,0,0.25)]
          `,

        destructive:
          `
          bg-red-600
          text-white
          border
          border-red-500
          hover:bg-red-700
          `,

        outline:
          `
          border
          border-[#ff5a00]/30
          bg-[#ff5a00]/10
          text-[#ff5a00]
          backdrop-blur-xl
          hover:bg-[#ff5a00]/20
          hover:text-[#ff5a00]
          hover:border-[#ff5a00]/50
          `,

        secondary:
          `
          bg-[#102969]
          text-white
          border
          border-white/10
          hover:bg-[#16367d]
          `,

        ghost:
          `
          text-slate-200
          hover:bg-white/5
          hover:text-white
          `,

        link:
          `
          text-[#ff5a00]
          underline-offset-4
          hover:underline
          `,
      },

      size: {
        default: "h-10 px-5 py-2",

        sm:
          `
          h-8
          rounded-lg
          px-3
          text-xs
          `,

        lg:
          `
          h-12
          rounded-2xl
          px-8
          text-base
          `,

        icon:
          `
          h-10
          w-10
          rounded-xl
          `,
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(
          buttonVariants({
            variant,
            size,
            className,
          })
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export {
  Button,
  buttonVariants
};