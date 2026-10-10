import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoClientes() {
  return (
    <div className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Cargando clientes">
      <div className="flex items-end justify-between">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-11 w-36" />
      </div>
      <Skeleton className="h-12 rounded-lg" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-cuero">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-cuero px-4 py-3.5 last:border-0"
          >
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 grid-cols-1 gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
