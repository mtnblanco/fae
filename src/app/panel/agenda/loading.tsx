import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoAgenda() {
  return (
    <div className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Cargando la agenda">
      <Skeleton className="h-10 w-40" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-[3.75rem] shrink-0 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="ml-[4rem] h-14 rounded-lg" />
      ))}
    </div>
  );
}
