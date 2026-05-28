"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, CheckCircle2, Trash2, X } from "lucide-react";

interface FileDropzoneProps {
  onFileAccepted: (file: { name: string; size: number; type: string }, fileObject: File) => void;
  onFileRemoved: () => void;
  acceptedFile?: { name: string; size: number; type: string } | null;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
];

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

type DropzoneState = "idle" | "dragover" | "uploaded" | "error";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "image/jpeg": "JPG",
  };
  return map[mimeType] ?? mimeType;
}

export function FileDropzone({ onFileAccepted, onFileRemoved, acceptedFile }: FileDropzoneProps) {
  const [dragover, setDragover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DropzoneState>(acceptedFile ? "uploaded" : "idle");

  const validateAndAccept = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Formato no soportado. Usá PDF, DOCX o JPG.");
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setError("El archivo supera el límite de 25 MB.");
        return;
      }

      const fileData = {
        name: file.name,
        size: file.size,
        type: file.type,
      };

      setState("uploaded");
      onFileAccepted(fileData, file);
    },
    [onFileAccepted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragover(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        validateAndAccept(file);
      }
    },
    [validateAndAccept]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        validateAndAccept(file);
      }
    },
    [validateAndAccept]
  );

  const handleRemove = useCallback(() => {
    setState("idle");
    setError(null);
    onFileRemoved();
  }, [onFileRemoved]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragover(true);
  };

  const handleDragLeave = () => {
    setDragover(false);
  };

  const isUploaded = state === "uploaded" && acceptedFile;

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      {!isUploaded && (
        <div
          role="button"
          tabIndex={0}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById("file-input")?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              document.getElementById("file-input")?.click();
            }
          }}
          className={`group relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
            dragover
              ? "border-accent bg-accent/5"
              : error
              ? "border-danger/50 bg-danger/5"
              : "border-border bg-surface hover:border-text-secondary hover:bg-surface/80"
          }`}
        >
          <input
            id="file-input"
            type="file"
            accept={[...ACCEPTED_TYPES].join(",")}
            onChange={handleInputChange}
            className="hidden"
          />

          <div
            className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-background transition-transform duration-300 ${
              dragover ? "scale-110 border-2 border-accent" : ""
            }`}
          >
            <Upload className="h-8 w-8 text-text-secondary" />
          </div>

          <h3 className="mb-2 font-headline text-xl text-text-primary">
            {dragover ? "Solotá el archivo" : "Arrastrá tu archivo aquí o hacé clic para buscar"}
          </h3>

          <p className="mx-auto mb-8 max-w-xs font-body text-text-secondary">
            Formatos compatibles para análisis inteligente de contratos.
          </p>

          <div className="flex gap-2">
            <span className="rounded border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase text-text-secondary">
              PDF
            </span>
            <span className="rounded border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase text-text-secondary">
              DOCX
            </span>
            <span className="rounded border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase text-text-secondary">
              JPG
            </span>
          </div>

          {error && (
            <p className="mt-4 text-sm font-medium text-danger">{error}</p>
          )}
        </div>
      )}

      {/* Uploaded file card */}
      {isUploaded && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-accent/10 text-accent">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="font-label text-sm font-semibold text-text-primary">
                {acceptedFile!.name}
              </p>
              <p className="font-label text-xs text-text-secondary">
                {formatBytes(acceptedFile!.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-bold uppercase tracking-wider text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Listo
            </span>
            <button
              onClick={handleRemove}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-disabled transition-colors hover:bg-danger/10 hover:text-danger"
              aria-label="Remover archivo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}