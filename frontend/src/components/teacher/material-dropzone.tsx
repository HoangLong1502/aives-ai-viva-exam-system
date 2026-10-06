"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FileUpIcon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { cn } from "cn";

const ACCEPT = ".pdf,.docx,.pptx,application/pdf";
const EXTENSIONS = new Set(["pdf", "docx", "pptx"]);

function isAllowedFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (EXTENSIONS.has(ext)) return true;
  return (
    file.type === "application/pdf" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
}

export function MaterialDropzone({
  id: idProp,
  file,
  onFileChange,
  disabled,
  label,
  dropTitle,
  dropHint,
  dropActive,
  invalidTypeMessage,
  selectedLabel,
}: {
  id?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  label: string;
  dropTitle: string;
  dropHint: string;
  dropActive: string;
  invalidTypeMessage: string;
  selectedLabel: (name: string) => string;
}) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (!file && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [file]);

  const pickFile = useCallback(
    (next: File | null) => {
      if (!next) {
        onFileChange(null);
        return;
      }
      if (!isAllowedFile(next)) {
        toast.error(invalidTypeMessage);
        return;
      }
      onFileChange(next);
    },
    [invalidTypeMessage, onFileChange],
  );

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    pickFile(event.target.files?.[0] ?? null);
  }

  function onDragEnter(event: React.DragEvent) {
    event.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function onDragOver(event: React.DragEvent) {
    event.preventDefault();
    if (disabled) return;
    event.dataTransfer.dropEffect = "copy";
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  }

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={dropTitle}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          "relative flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          "hover:border-ring/60 hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          dragging && "border-primary bg-primary/5",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
          !dragging && "border-border",
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={onInputChange}
        />
        {dragging ? (
          <>
            <UploadCloudIcon className="size-8 text-primary" aria-hidden />
            <p className="text-sm font-medium text-primary">{dropActive}</p>
          </>
        ) : (
          <>
            <FileUpIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{dropTitle}</p>
            <FieldDescription className="max-w-sm">{dropHint}</FieldDescription>
            {file ? (
              <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs font-medium">{selectedLabel(file.name)}</p>
            ) : null}
          </>
        )}
      </div>
    </Field>
  );
}
