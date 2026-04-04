import { useCallback, useEffect, useRef, useState } from "react";

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
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`cursor-pointer rounded px-1 py-0.5 text-left text-sm hover:bg-secondary ${className ?? ""}`}
      >
        {value || <span className="text-muted-foreground italic">empty</span>}
      </button>
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
