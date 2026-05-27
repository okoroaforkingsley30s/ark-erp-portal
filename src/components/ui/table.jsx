import * as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      className="
        relative
        w-full
        overflow-auto
        rounded-3xl
        border
        border-white/10
        bg-[#102969]/90
        backdrop-blur-xl
        shadow-[0_0_30px_rgba(0,0,0,0.25)]
      "
    >
      <table
        ref={ref}
        className={cn(
          `
          w-full
          caption-bottom
          text-sm
          text-white
          `,
          className
        )}
        {...props}
      />
    </div>
  )
);

Table.displayName = "Table";

const TableHeader = React.forwardRef(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        `
        border-b
        border-white/10
        bg-[#0b1f5e]
        `,
        className
      )}
      {...props}
    />
  )
);

TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn(
        `
        [&_tr:last-child]:border-0
        `,
        className
      )}
      {...props}
    />
  )
);

TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn(
        `
        border-t
        border-white/10
        bg-[#0b1f5e]
        font-medium
        text-white
        `,
        className
      )}
      {...props}
    />
  )
);

TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        `
        border-b
        border-white/5
        transition-all
        duration-200

        hover:bg-[#ff5a00]/5

        data-[state=selected]:bg-[#ff5a00]/10
        `,
        className
      )}
      {...props}
    />
  )
);

TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        `
        h-12
        px-4
        text-left
        align-middle
        font-semibold
        text-slate-300
        uppercase
        tracking-[0.15em]
        text-[11px]

        [&:has([role=checkbox])]:pr-0
        [&>[role=checkbox]]:translate-y-[2px]
        `,
        className
      )}
      {...props}
    />
  )
);

TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        `
        p-4
        align-middle
        text-slate-100

        [&:has([role=checkbox])]:pr-0
        [&>[role=checkbox]]:translate-y-[2px]
        `,
        className
      )}
      {...props}
    />
  )
);

TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn(
        `
        mt-4
        text-sm
        text-slate-300
        `,
        className
      )}
      {...props}
    />
  )
);

TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};