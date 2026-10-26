"use client";

import { CalendarPlus, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cancelarMiTurno } from "@/app/turnos/acciones";
import { Confirmar } from "@/components/comunes/confirmar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import { cn } from "@/lib/utils";

type Props = {
  turnoId: string;
  /** "Vie 24 de oct · 18:30" */
  cuando: string;
  barbero: string;
  /** "Corte + barba · $ 14.000", o null si el turno no tiene servicio. */
  servicio?: string | null;
  sede: string;
  puedeCancelar: boolean;
  /** Link de WhatsApp de la barbería con el mensaje armado. */
  whatsapp: string | null;
  className?: string;
};

/** "Tu próximo turno": en el carnet y en /turnos. */
export function TarjetaMiTurno({
  turnoId,
  cuando,
  barbero,
  servicio,
  sede,
  puedeCancelar,
  whatsapp,
  className,
}: Props) {
  const router = useRouter();
  const { pendiente, ejecutar } = useAccionUnica();
  const [confirmando, setConfirmando] = useState(false);

  const cancelar = () =>
    ejecutar(async () => {
      const r = await cancelarMiTurno(turnoId);
      if (r.ok) {
        toast.success("Listo, cancelamos tu turno.");
        router.refresh();
      } else {
        toast.error(r.error);
        router.refresh();
      }
    });

  return (
    <section
      aria-labelledby="titulo-mi-turno"
      className={cn("rounded-xl border border-oro/40 bg-ebano p-4", className)}
    >
      <p id="titulo-mi-turno" className="etiqueta text-oro">
        Tu próximo turno
      </p>
      <p className="numeros mt-2 font-titulo text-[1.625rem] leading-tight text-marfil">{cuando}</p>
      <p className="mt-1 text-[0.9375rem] text-arena">
        con <span className="text-marfil">{barbero}</span> · {sede}
      </p>
      {servicio ? <p className="numeros mt-1 text-[0.9375rem] text-oro-claro">{servicio}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-12">
          <a href="/turnos/calendario" download>
            <CalendarPlus aria-hidden />
            Agendar
          </a>
        </Button>
        {puedeCancelar ? (
          <Confirmar
            abierto={confirmando}
            onAbiertoChange={setConfirmando}
            disparador={
              <Button variant="outline" className="h-12" disabled={pendiente}>
                <X aria-hidden />
                {pendiente ? "Cancelando…" : "Cancelar"}
              </Button>
            }
            titulo="¿Cancelar tu turno?"
            descripcion={`${cuando} con ${barbero}. El horario queda libre para otro cliente.`}
            textoConfirmar="Sí, cancelar"
            textoCancelar="No, lo mantengo"
            destructiva
            onConfirmar={cancelar}
          />
        ) : (
          // Con 6 horas o menos no se cancela desde la web: lo cancela el
          // barbero y el cliente abona la mitad.
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="h-12">
                <X aria-hidden />
                Cancelar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md p-5 data-[size=default]:max-w-md data-[size=default]:sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-titulo text-2xl font-normal">
                  No podés cancelarlo desde acá
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[0.9375rem] leading-relaxed text-arena">
                  Faltan 6 horas o menos para tu turno. Para cancelarlo tenés que hablar con{" "}
                  <span className="text-marfil">{barbero}</span>, que es quien lo cancela, y vas a
                  tener que <span className="text-marfil">abonar la mitad del corte</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="-mx-5 -mb-5 p-4">
                <AlertDialogCancel variant="outline">Entendido</AlertDialogCancel>
                {whatsapp ? (
                  <AlertDialogAction asChild>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                      <MessageCircle aria-hidden />
                      Hablar por WhatsApp
                    </a>
                  </AlertDialogAction>
                ) : null}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {puedeCancelar ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-arena">
          Podés cancelarlo desde acá hasta 6 horas antes.
        </p>
      ) : (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-arena">
          Faltan 6 horas o menos: para cancelarlo hablá con tu barbero. Se abona la mitad del corte.
        </p>
      )}
    </section>
  );
}
