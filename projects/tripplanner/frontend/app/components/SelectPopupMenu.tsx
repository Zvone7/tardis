"use client";

import React from "react";
import { EyeIcon, EyeOffIcon, Trash2Icon, XIcon, CheckSquareIcon } from "lucide-react";
import { Button } from "./ui/button";

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

function ActionButton({ icon, label, onClick, variant = "outline", disabled }: SelectPopupMenuAction) {
  return (
    <Button size="sm" variant={variant} onClick={onClick} disabled={disabled}>
      {icon}
      <span className="ml-1.5">{label}</span>
    </Button>
  );
}

const Divider = () => <div className="h-5 w-px bg-border" />;

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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg">
      {/* Selection group */}
      <span className="text-sm font-medium whitespace-nowrap">
        {selectedCount} selected
      </span>
      <ActionButton
        icon={<CheckSquareIcon className="h-4 w-4" />}
        label={`All (${totalCount})`}
        onClick={onSelectAll}
      />

      {extraActions && extraActions.length > 0 && (
        <>
          <Divider />
          {extraActions.map((action, i) => (
            <ActionButton key={i} {...action} />
          ))}
        </>
      )}

      <Divider />

      {/* State group */}
      <ActionButton
        icon={<EyeOffIcon className="h-4 w-4" />}
        label="Hide"
        onClick={onHide}
      />
      <ActionButton
        icon={<EyeIcon className="h-4 w-4" />}
        label="Show"
        onClick={onShow}
      />
      <ActionButton
        icon={<Trash2Icon className="h-4 w-4" />}
        label="Delete"
        onClick={onDelete}
        variant="destructive"
        disabled={isDeleting}
      />

      {/* Clear — icon-only, ghost */}
      <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
