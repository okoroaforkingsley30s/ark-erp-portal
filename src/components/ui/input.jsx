import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          `
          flex
          h-11
          w-full
          rounded-2xl
          border
          border-white/10
          bg-[#0b1f5e]/80
          px-4
          py-2
          text-sm
          text-white
          backdrop-blur-xl
          shadow-[0_0_20px_rgba(0,0,0,0.15)]
          transition-all
          duration-300

          placeholder:text-slate-400

          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-[#ff5a00]/30
          focus-visible:border-[#ff5a00]/40
          focus-visible:bg-[#102969]

          hover:border-[#ff5a00]/20

          disabled:cursor-not-allowed
          disabled:opacity-50

          file:border-0
          file:bg-transparent
          file:text-sm
          file:font-medium
          file:text-white
          `,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };