import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoTurnos() {
  return (
    <div className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Cargando turnos">
      <Skeleton className="h-10 w-48" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-[3.75rem] shrink-0 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
