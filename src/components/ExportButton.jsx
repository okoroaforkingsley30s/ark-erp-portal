import React, { useState } from 'react';

import { Button } from '@/components/ui/button';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import {
  Download,
  FileSpreadsheet,
  FileText
} from 'lucide-react';

import {
  exportCSV,
  exportExcel
} from '@/utils/exportData';

export default function ExportButton({
  data,
  filename = 'export',
  label = 'Export',
  size = 'sm'
}) {
  const [open, setOpen] = useState(false);

  const getRows = () =>
    Array.isArray(data)
      ? data
      : Object.values(data).flat();

  const handleCSV = () => {
    exportCSV(getRows(), filename);
    setOpen(false);
  };

  const handleExcel = async () => {
    try {
      await exportExcel(data, filename);
      setOpen(false);
    } catch (error) {
      alert(error.message || 'Unable to export the workbook.');
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={setOpen}
    >
      <DropdownMenuTrigger asChild>

        <Button
          size={size}
          className="
            gap-2
            rounded-xl
            border
            border-[#ff5a00]/30
            bg-[#ff5a00]/10
            hover:bg-[#ff5a00]/20
            text-[#ff5a00]
            hover:text-[#ff5a00]
            shadow-[0_0_20px_rgba(255,90,0,0.12)]
            transition-all
            duration-300
            font-semibold
            backdrop-blur-xl
          "
        >
          <Download className="w-4 h-4" />

          {label}
        </Button>

      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="
          w-56
          rounded-2xl
          border
          border-white/10
          bg-[#102969]
          text-white
          backdrop-blur-xl
          shadow-[0_0_30px_rgba(0,0,0,0.3)]
        "
      >

        <DropdownMenuItem
          onClick={handleCSV}
          className="
            gap-3
            cursor-pointer
            rounded-xl
            m-1
            text-slate-200
            hover:bg-[#ff5a00]/10
            hover:text-[#ff5a00]
            focus:bg-[#ff5a00]/10
            focus:text-[#ff5a00]
          "
        >
          <div className="w-8 h-8 rounded-lg bg-[#ff5a00]/15 border border-[#ff5a00]/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#ff5a00]" />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              CSV Export
            </span>

            <span className="text-[11px] text-slate-400">
              Download spreadsheet data
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleExcel}
          className="
            gap-3
            cursor-pointer
            rounded-xl
            m-1
            text-slate-200
            hover:bg-[#ff5a00]/10
            hover:text-[#ff5a00]
            focus:bg-[#ff5a00]/10
            focus:text-[#ff5a00]
          "
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              Excel Export
            </span>

            <span className="text-[11px] text-slate-400">
              Download .xlsx workbook
            </span>
          </div>
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
