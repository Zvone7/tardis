"use client";

import React from "react";
import { EyeIcon, EyeOffIcon, Trash2Icon, XIcon, CheckSquareIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export interface SelectPopupMenuAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

interface SelectPopupMenuProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onHide: () => void;
  onShow: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  onClear: () => void;
  extraActions?: SelectPopupMenuAction[];
}

function IconButton({
  icon,
  label,
  onClick,
  variant = "outline",
  disabled,
}: SelectPopupMenuAction) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant={variant} onClick={onClick} disabled={disabled}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function SelectPopupMenu({
  selectedCount,
  totalCount,
  onSelectAll,
  onHide,
  onShow,
  onDelete,
  isDeleting,
  onClear,
  extraActions,
}: SelectPopupMenuProps) {
  if (selectedCount === 0) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg">
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} selected
        </span>

        <IconButton
          icon={<CheckSquareIcon className="h-4 w-4" />}
          label={`Select all (${totalCount})`}
          onClick={onSelectAll}
          variant="outline"
        />

        {extraActions?.map((action, i) => (
          <IconButton key={i} {...action} />
        ))}

        <IconButton
          icon={<EyeOffIcon className="h-4 w-4" />}
          label="Hide"
          onClick={onHide}
          variant="outline"
        />
        <IconButton
          icon={<EyeIcon className="h-4 w-4" />}
          label="Show"
          onClick={onShow}
          variant="outline"
        />
        <IconButton
          icon={<Trash2Icon className="h-4 w-4" />}
          label="Delete"
          onClick={onDelete}
          variant="destructive"
          disabled={isDeleting}
        />
        <IconButton
          icon={<XIcon className="h-4 w-4" />}
          label="Clear selection"
          onClick={onClear}
          variant="ghost"
        />
      </div>
    </TooltipProvider>
  );
}
