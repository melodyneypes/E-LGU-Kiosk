"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const SelectContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  disabled?: boolean;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}>({});

export function Select({ value, onValueChange, children, disabled = false }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, disabled, triggerRef }}>
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<"button">) {
  const { open, setOpen, disabled, triggerRef } = React.useContext(SelectContext);
  return (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      onClick={() => setOpen?.(!open)}
      className={cn(
        "flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  return <span>{value || placeholder}</span>;
}

export function SelectContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open, triggerRef } = React.useContext(SelectContext);
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    function updatePosition() {
      const trigger = triggerRef?.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const verticalMargin = 8;
      const gap = 6;
      const maxHeight = 240;
      const spaceBelow = Math.max(0, viewportHeight - rect.bottom - verticalMargin);
      const spaceAbove = Math.max(0, rect.top - verticalMargin);
      const openAbove = spaceBelow < maxHeight && spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;
      const contentHeight = Math.min(maxHeight, availableHeight);

      setStyle({
        position: "fixed",
        top: openAbove ? rect.top - contentHeight - gap : rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: `${contentHeight}px`,
        zIndex: 9999,
      });
    }

    if (open) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [open, triggerRef]);

  if (!open) return null;

  const content = (
    <div
      style={style}
      className={cn(
        "overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-1 shadow-md focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}

export function SelectItem({ className, value, children, ...props }: React.ComponentProps<"div"> & { value: string }) {
  const { value: selectedValue, onValueChange, setOpen } = React.useContext(SelectContext);
  const isSelected = selectedValue === value;
  
  return (
    <div
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={() => {
        onValueChange?.(value);
        setOpen?.(false);
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1 text-[14px] leading-5 outline-none hover:bg-slate-100 dark:hover:bg-white/5",
        isSelected && "bg-slate-50 dark:bg-white/5 font-semibold",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SelectGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
