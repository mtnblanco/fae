import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoPanel() {
  return (
    <div className="grid grid-cols-1 gap-8" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-10 w-2/3 max-w-sm" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid grid-cols-1 gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
