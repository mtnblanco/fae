import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoCarnet() {
  return (
    <div className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Cargando tu carnet">
      <Skeleton className="aspect-[1/1.18] w-full rounded-[1.375rem] min-[400px]:aspect-[1/1.05]" />
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="mt-6 h-8 w-40" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
