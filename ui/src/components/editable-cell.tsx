import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  className?: string;
  type?: "text" | "number" | "time";
  allowEmpty?: boolean;
}

export function EditableCell({
  value,
  onSave,
  disabled = false,
  className,
  type = "text",
  allowEmpty = false,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value && (trimmed.length > 0 || allowEmpty)) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
  }, [allowEmpty, draft, value, onSave]);

  if (disabled) {
    return <span className="text-sm text-muted-foreground">{value}</span>;
  }

  if (!editing) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
        className={`h-auto min-h-8 w-full justify-between border-dashed px-2 py-1 text-left text-sm font-normal ${className ?? ""}`}
      >
        <span>{value || <span className="text-muted-foreground italic">empty</span>}</span>
        <span className="ml-3 shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Edit
        </span>
      </Button>
    );
  }

  return (
    <Input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="h-7 w-full text-sm"
    />
  );
}
