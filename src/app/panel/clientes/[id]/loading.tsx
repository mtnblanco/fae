import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoCliente() {
  return (
    <div
      className="mx-auto grid max-w-3xl grid-cols-1 gap-8"
      aria-busy="true"
      aria-label="Cargando cliente"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="grid flex-1 grid-cols-1 gap-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
