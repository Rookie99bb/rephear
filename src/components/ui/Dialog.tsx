"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Minimal, dependency-free modal dialog (this repo has no shadcn/ui or
// Radix installed). Mirrors the shadcn/ui Dialog behavior closely enough
// to be reused for any future modal, not just Share: portaled to <body>,
// closes on Escape or overlay click, moves focus into the dialog on open
// and restores it to the trigger on close, and locks body scroll while
// open.
export function Dialog({
  open,
  onOpenChange,
  children,
  ariaLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_24px_48px_-12px_rgba(17,17,19,0.35)]"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 pr-6">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-ink">{children}</h2>;
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-subtle transition hover:bg-surface hover:text-ink"
    >
      ✕
    </button>
  );
}
