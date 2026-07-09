"use client";

import { useParams, useRouter } from "next/navigation";
import { PreviewPageContent } from "@/components/preview/PreviewPageContent";

export default function PreviewPage() {
  const params = useParams();
  const router = useRouter();
  return <PreviewPageContent caseId={params.caseId as string} router={router} />;
}
