"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** El escáner (cámara + WebAssembly) se carga solo en el navegador y solo en esta página. */
export const EscanerDinamico = dynamic(() => import("./escaner").then((m) => m.Escaner), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto aspect-square w-full max-w-md rounded-2xl" />,
});
