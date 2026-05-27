"use client";

import * as React from "react";

import * as SelectPrimitive from "@radix-ui/react-select";

import {
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(
  (
    {
      className,
      children,
      ...props
    },
    ref
  ) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        `
        flex
        h-11
        w-full
        items-center
        justify-between

        whitespace-nowrap

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

        ring-offset-background

        data-[placeholder]:text-slate-400

        focus:outline-none
        focus:ring-2
        focus:ring-[#ff5a00]/30
        focus:border-[#ff5a00]/40

        hover:border-[#ff5a00]/20

        disabled:cursor-not-allowed
        disabled:opacity-50

        [&>span]:line-clamp-1
        `,
        className
      )}
      {...props}
    >

      {children}

      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </SelectPrimitive.Icon>

    </SelectPrimitive.Trigger>
  )
);

SelectTrigger.displayName =
  SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn(
        `
        flex
        cursor-default
        items-center
        justify-center
        py-2
        text-slate-300
        `,
        className
      )}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  )
);

SelectScrollUpButton.displayName =
  SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn(
        `
        flex
        cursor-default
        items-center
        justify-center
        py-2
        text-slate-300
        `,
        className
      )}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  )
);

SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef(
  (
    {
      className,
      children,
      position = "popper",
      ...props
    },
    ref
  ) => (
    <SelectPrimitive.Portal>

      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          `
          relative
          z-50

          max-h-96
          min-w-[10rem]

          overflow-hidden

          rounded-3xl

          border
          border-white/10

          bg-gradient-to-br
          from-[#08153d]
          via-[#0b1f5e]
          to-[#102969]

          text-white

          backdrop-blur-2xl

          shadow-[0_0_40px_rgba(0,0,0,0.35)]

          data-[state=open]:animate-in
          data-[state=closed]:animate-out

          data-[state=closed]:fade-out-0
          data-[state=open]:fade-in-0

          data-[state=closed]:zoom-out-95
          data-[state=open]:zoom-in-95

          data-[side=bottom]:slide-in-from-top-2
          data-[side=left]:slide-in-from-right-2
          data-[side=right]:slide-in-from-left-2
          data-[side=top]:slide-in-from-bottom-2
          `,
          position === "popper" &&
            `
            data-[side=bottom]:translate-y-1
            data-[side=left]:-translate-x-1
            data-[side=right]:translate-x-1
            data-[side=top]:-translate-y-1
            `,
          className
        )}
        position={position}
        {...props}
      >

        <SelectScrollUpButton />

        <SelectPrimitive.Viewport
          className={cn(
            `
            p-2
            `,
            position === "popper" &&
              `
              h-[var(--radix-select-trigger-height)]
              w-full
              min-w-[var(--radix-select-trigger-width)]
              `
          )}
        >
          {children}
        </SelectPrimitive.Viewport>

        <SelectScrollDownButton />

      </SelectPrimitive.Content>

    </SelectPrimitive.Portal>
  )
);

SelectContent.displayName =
  SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Label
      ref={ref}
      className={cn(
        `
        px-3
        py-2

        text-xs
        font-bold

        uppercase
        tracking-[0.15em]

        text-slate-400
        `,
        className
      )}
      {...props}
    />
  )
);

SelectLabel.displayName =
  SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef(
  (
    {
      className,
      children,
      ...props
    },
    ref
  ) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        `
        relative

        flex
        w-full

        cursor-pointer
        select-none

        items-center

        rounded-2xl

        py-3
        pl-4
        pr-10

        text-sm
        text-slate-200

        outline-none

        transition-all
        duration-200

        hover:bg-[#ff5a00]/10
        hover:text-[#ff5a00]

        focus:bg-[#ff5a00]/10
        focus:text-[#ff5a00]

        data-[disabled]:pointer-events-none
        data-[disabled]:opacity-50
        `,
        className
      )}
      {...props}
    >

      <span className="absolute right-4 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4 text-[#ff5a00]" />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>
        {children}
      </SelectPrimitive.ItemText>

    </SelectPrimitive.Item>
  )
);

SelectItem.displayName =
  SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn(
        `
        my-2
        h-px
        bg-white/10
        `,
        className
      )}
      {...props}
    />
  )
);

SelectSeparator.displayName =
  SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};