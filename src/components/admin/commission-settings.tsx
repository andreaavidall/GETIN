"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { setDefaultCommissionAction, setVenueCommissionAction } from "@/lib/actions/admin";

export function CommissionSettings({
  defaultPercent,
  venues,
}: {
  defaultPercent: number;
  venues: { id: string; name: string; percent: number | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [globalValue, setGlobalValue] = useState(String(defaultPercent));
  const [perVenue, setPerVenue] = useState<Record<string, string>>(
    Object.fromEntries(venues.map((v) => [v.id, v.percent === null ? "" : String(v.percent)])),
  );

  function saveGlobal() {
    startTransition(async () => {
      const result = await setDefaultCommissionAction({ percent: Number(globalValue) });
      if (!result.ok) {
        toast.error("No se pudo guardar", { description: result.error });
        return;
      }
      toast.success("Comisión por defecto actualizada");
      router.refresh();
    });
  }

  function saveVenue(venueId: string) {
    const raw = perVenue[venueId]?.trim() ?? "";
    startTransition(async () => {
      const result = await setVenueCommissionAction(venueId, raw === "" ? null : Number(raw));
      if (!result.ok) {
        toast.error("No se pudo guardar", { description: result.error });
        return;
      }
      toast.success("Comisión del local actualizada");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <Field
          label="Comisión por defecto (%)"
          htmlFor="comision-global"
          hint="Se aplica a los locales que no tengan una comisión propia. Afecta solo a las ordenes nuevas: las ya creadas conservan la que tenian."
        >
          <div className="flex gap-2">
            <Input
              id="comision-global"
              type="number"
              min={0}
              max={100}
              step="0.25"
              value={globalValue}
              onChange={(e) => setGlobalValue(e.target.value)}
              className="max-w-[140px]"
            />
            <Button onClick={saveGlobal} disabled={pending}>
              Guardar
            </Button>
          </div>
        </Field>
      </div>

      {venues.length > 0 ? (
        <div className="surface overflow-hidden">
          <h3 className="border-b border-white/10 p-5 font-display text-base font-semibold">
            Comisión por local
          </h3>
          <ul className="divide-y divide-white/5">
            {venues.map((venue) => (
              <li key={venue.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm">{venue.name}</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.25"
                    placeholder={`Por defecto (${defaultPercent}%)`}
                    value={perVenue[venue.id] ?? ""}
                    onChange={(e) =>
                      setPerVenue((prev) => ({ ...prev, [venue.id]: e.target.value }))
                    }
                    className="w-[180px]"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => saveVenue(venue.id)}
                  >
                    Guardar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        GETIN cobra esta comisión como cargo por servicio al comprador. El reparto efectivo del
        dinero entre GETIN y el local depende del proveedor de pagos y del acuerdo comercial: la
        plataforma registra el desglose por operación, pero no asume que la division sea automática.
      </p>
    </div>
  );
}
