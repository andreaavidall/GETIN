"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { publishEventAction } from "@/lib/actions/club";

export function EventPublishToggle({
  venueId,
  eventId,
  published,
}: {
  venueId: string;
  eventId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={published ? "outline" : "primary"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await publishEventAction(venueId, eventId, !published);
          if (!result.ok) {
            toast.error("No se pudo cambiar el estado", { description: result.error });
            return;
          }
          toast.success(published ? "Evento despublicado" : "Evento publicado");
          router.refresh();
        })
      }
    >
      {pending ? "Guardando..." : published ? "Despublicar" : "Publicar"}
    </Button>
  );
}
