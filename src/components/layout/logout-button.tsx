"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await signOutAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.push("/");
          router.refresh();
        })
      }
    >
      <LogOut className="size-4" />
      {pending ? "Cerrando..." : "Cerrar sesion"}
    </Button>
  );
}
