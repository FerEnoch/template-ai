export function Footer() {
  return (
    <footer className="flex w-full shrink-0 items-center justify-between border-t border-border px-6 py-3 font-label text-xs text-text-secondary">
      <span className="font-headline text-sm font-semibold text-text-disabled">
        template-ai
      </span>
      <span>© 2024 template-ai. Todos los derechos reservados.</span>
      <div className="flex gap-4">
        <a
          href="#"
          className="transition-colors hover:text-text-primary hover:underline"
        >
          Privacidad
        </a>
        <a
          href="#"
          className="transition-colors hover:text-text-primary hover:underline"
        >
          Términos
        </a>
        <a
          href="#"
          className="transition-colors hover:text-text-primary hover:underline"
        >
          Seguridad
        </a>
      </div>
    </footer>
  );
}
