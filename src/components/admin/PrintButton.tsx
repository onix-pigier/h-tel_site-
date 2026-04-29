"use client";

import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type PrintButtonProps = {
  label?: string;
  documentTitle?: string;
  variant?: "outline" | "default";
};

export function PrintButton({
  label = "Imprimer",
  documentTitle,
  variant = "outline",
}: PrintButtonProps) {
  const handlePrint = () => {
    const previousTitle = document.title;

    if (documentTitle) {
      document.title = documentTitle;
    }

    window.print();

    window.setTimeout(() => {
      document.title = previousTitle;
    }, 300);
  };

  return (
    <Button type="button" variant={variant} className="print:hidden" onClick={handlePrint}>
      {label.toLowerCase().includes("pdf") ? <FileDown className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}
