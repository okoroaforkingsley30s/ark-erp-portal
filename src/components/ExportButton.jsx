import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportCSV, exportExcel } from '@/utils/exportData';

/**
 * ExportButton component
 * @param {Object} props
 * @param {Array|Object} props.data - rows[] for single sheet, or { sheetName: rows[] } for multi-sheet Excel
 * @param {string} props.filename - base filename
 * @param {string} [props.label] - button label
 * @param {string} [props.variant] - button variant
 * @param {string} [props.size] - button size
 */
export default function ExportButton({ data, filename = 'export', label = 'Export', variant = 'outline', size = 'sm' }) {
  const [open, setOpen] = useState(false);

  const getRows = () => Array.isArray(data) ? data : Object.values(data).flat();

  const handleCSV = () => {
    exportCSV(getRows(), filename);
    setOpen(false);
  };

  const handleExcel = () => {
    exportExcel(data, filename);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCSV} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Download as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          Download as Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}