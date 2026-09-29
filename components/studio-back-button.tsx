"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StudioBackButtonProps = {
  href?: string;
  label?: string;
  /** Icon-only control for dense toolbars */
  iconOnly?: boolean;
  className?: string;
  title?: string;
  /** Prefer this over href when you need in-page back (e.g. gallery ↔ editor). */
  onClick?: () => void;
};

export function StudioBackButton({
  href = "/",
  label = "Back",
  iconOnly = false,
  className,
  title,
  onClick,
}: StudioBackButtonProps) {
  const classes = cn(
    iconOnly ? "h-8 w-8 shrink-0" : "h-8 shrink-0 gap-1.5 px-2.5 text-xs",
    className,
  );

  if (onClick) {
    return (
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon" : "sm"}
        className={classes}
        title={title ?? label}
        aria-label={title ?? label}
        onClick={onClick}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {!iconOnly && <span>{label}</span>}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      asChild
      className={classes}
    >
      <Link href={href} title={title ?? label} aria-label={title ?? label}>
        <ArrowLeft className="h-3.5 w-3.5" />
        {!iconOnly && <span>{label}</span>}
      </Link>
    </Button>
  );
}
