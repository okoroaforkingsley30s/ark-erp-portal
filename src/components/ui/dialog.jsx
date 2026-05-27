"use client";

import * as React from "react";

import * as DialogPrimitive from "@radix-ui/react-dialog";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        `
        fixed
        inset-0
        z-50

        bg-black/70
        backdrop-blur-md

        data-[state=open]:animate-in
        data-[state=closed]:animate-out
        data-[state=closed]:fade-out-0
        data-[state=open]:fade-in-0
        `,
        className
      )}
      {...props}
    />
  )
);

DialogOverlay.displayName =
  DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(
  (
    {
      className,
      children,
      ...props
    },
    ref
  ) => (
    <DialogPortal>

      <DialogOverlay />

      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          `
          fixed
          left-[50%]
          top-[50%]
          z-50
          grid
          w-full
          max-w-lg
          translate-x-[-50%]
          translate-y-[-50%]
          gap-4

          border
          border-white/10

          bg-gradient-to-br
          from-[#08153d]
          via-[#0b1f5e]
          to-[#102969]

          text-white

          p-6

          rounded-3xl

          backdrop-blur-2xl

          shadow-[0_0_50px_rgba(0,0,0,0.45)]

          duration-300

          data-[state=open]:animate-in
          data-[state=closed]:animate-out

          data-[state=closed]:fade-out-0
          data-[state=open]:fade-in-0

          data-[state=closed]:zoom-out-95
          data-[state=open]:zoom-in-95

          data-[state=closed]:slide-out-to-left-1/2
          data-[state=closed]:slide-out-to-top-[48%]

          data-[state=open]:slide-in-from-left-1/2
          data-[state=open]:slide-in-from-top-[48%]
          `,
          className
        )}
        {...props}
      >

        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#ff5a00]/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10">
          {children}
        </div>

        <DialogPrimitive.Close
          className="
            absolute
            right-4
            top-4

            rounded-xl

            border
            border-white/10

            bg-white/5

            p-2

            text-slate-300

            transition-all
            duration-300

            hover:bg-[#ff5a00]/15
            hover:text-[#ff5a00]
            hover:border-[#ff5a00]/30

            focus:outline-none
            focus:ring-2
            focus:ring-[#ff5a00]/30

            disabled:pointer-events-none
          "
        >
          <X className="h-4 w-4" />

          <span className="sr-only">
            Close
          </span>
        </DialogPrimitive.Close>

      </DialogPrimitive.Content>

    </DialogPortal>
  )
);

DialogContent.displayName =
  DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      `
      flex
      flex-col
      space-y-2
      text-center
      sm:text-left
      `,
      className
    )}
    {...props}
  />
);

DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      `
      flex
      flex-col-reverse
      gap-2

      sm:flex-row
      sm:justify-end
      `,
      className
    )}
    {...props}
  />
);

DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        `
        text-xl
        font-bold
        tracking-tight
        text-white
        `,
        className
      )}
      {...props}
    />
  )
);

DialogTitle.displayName =
  DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn(
        `
        text-sm
        leading-relaxed
        text-slate-300
        `,
        className
      )}
      {...props}
    />
  )
);

DialogDescription.displayName =
  DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};