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
};

export function StudioBackButton({
  href = "/",
  label = "Back",
  iconOnly = false,
  className,
  title,
}: StudioBackButtonProps) {
  return (
    <Button
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      asChild
      className={cn(
        iconOnly ? "h-8 w-8 shrink-0" : "h-8 shrink-0 gap-1.5 px-2.5 text-xs",
        className,
      )}
    >
      <Link href={href} title={title ?? label} aria-label={title ?? label}>
        <ArrowLeft className="h-3.5 w-3.5" />
        {!iconOnly && <span>{label}</span>}
      </Link>
    </Button>
  );
}
