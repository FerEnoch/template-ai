import { useState } from "react";
import Link from "next/link";
import { FileText, Calendar, Tag, Trash2, Loader2 } from "lucide-react";
import type { Template } from "@template-ai/contracts";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface TemplateCardProps {
  readonly template: Template;
  readonly onClick?: (template: Template) => void;
  readonly onDelete?: (id: string) => void;
  readonly onDeleteError?: () => void;
}

const statusConfig: Record<
  Template["status"],
  { label: string; className: string }
> = {
  published: {
    label: "Publicada",
    className:
      "bg-success/10 text-success border border-success/20",
  },
  draft: {
    label: "Borrador",
    className:
      "bg-accent/10 text-accent border border-accent/20",
  },
  archived: {
    label: "Archivada",
    className:
      "bg-neutral/10 text-neutral border border-border",
  },
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TemplateCard({
  template,
  onClick,
  onDelete,
  onDeleteError,
}: TemplateCardProps) {
  const status = statusConfig[template.status];
  const entityCount = template.entities.length;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteError(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (isDeleting) return;
    setIsDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar la plantilla");
      }

      setIsDialogOpen(false);
      onDelete?.(template.id);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Error al eliminar la plantilla"
      );
      onDeleteError?.();
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = template.status !== "archived";

  return (
    <>
      <Link
        href={`/biblioteca/${template.id}`}
        onClick={() => onClick?.(template)}
        className="group relative block w-full rounded-xl border border-border bg-surface p-5 text-left shadow-sm transition-all duration-150 hover:border-accent/30 hover:shadow-md active:scale-[0.99]"
      >
        {canDelete && (
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            title="Eliminar plantilla"
            aria-label="Eliminar plantilla"
            className="absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-md p-1.5 text-danger opacity-0 transition-all duration-150 hover:bg-danger/10 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        )}

        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="font-headline text-base font-semibold leading-tight text-text-primary group-hover:text-accent">
                {template.name}
              </h3>
              {template.description && (
                <p className="mt-0.5 line-clamp-1 font-body text-sm text-text-secondary">
                  {template.description}
                </p>
              )}
            </div>
          </div>
          <span
            className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        {deleteError && (
          <div className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs font-bold text-danger">
            {deleteError}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-border pt-3 font-label text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            {template.category}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(template.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {entityCount} {entityCount === 1 ? "campo" : "campos"}
          </span>
        </div>
      </Link>

      <ConfirmDeleteDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        templateName={template.name}
      />
    </>
  );
}