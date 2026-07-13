"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface DialogProps {
  children: ReactNode;
  className?: string;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function Dialog({
  children,
  className,
  description,
  onClose,
  open,
  title,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className={cn(
        "m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl bg-white p-0 text-emerald-950 shadow-2xl backdrop:bg-emerald-950/50",
        className,
      )}
      onCancel={onClose}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            aria-label="關閉對話框"
            className="min-h-9 px-3 py-1"
            onClick={onClose}
            variant="ghost"
          >
            ×
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}
