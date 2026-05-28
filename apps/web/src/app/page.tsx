import { AppShell } from "@/components/shell/app-shell";

export default function Page() {
  return (
    <AppShell>
      <div className="flex flex-1 items-center justify-center">
        <h1 className="font-headline text-4xl font-bold text-text-primary">
          Bienvenido a Template AI
        </h1>
      </div>
    </AppShell>
  );
}
