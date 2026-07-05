"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SaveContent } from "./SaveContent";
import { useWizard } from "@/lib/wizard";

function SavePageInner() {
  const { state, setStep, reset } = useWizard();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <SaveContent
      state={state}
      setStep={setStep}
      reset={reset}
      searchParams={searchParams}
      router={router}
    />
  );
}

export default function SavePage() {
  return (
    <Suspense fallback={null}>
      <SavePageInner />
    </Suspense>
  );
}
