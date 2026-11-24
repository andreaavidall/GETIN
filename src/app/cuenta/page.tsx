import { Mail, Phone, ShieldCheck, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LogoutButton } from "@/components/layout/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Mi perfil", robots: { index: false } };

const ROLE_LABEL: Record<string, string> = {
  client: "Cliente",
  club_admin: "Administrador de discoteca",
  door_staff: "Personal de puerta",
  superadmin: "Equipo GETIN",
};

export default async function ProfilePage() {
  const session = await requireSession("/cuenta");
  const { user } = session;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="surface p-5">
        <h2 className="text-display mb-4 text-lg">Datos de la cuenta</h2>
        <dl className="space-y-3 text-sm">
          <Row icon={User} label="Nombre" value={user.fullName ?? "Sin completar"} />
          <Row icon={Mail} label="Correo" value={user.email} />
          <Row icon={Phone} label="Teléfono" value={user.phone ?? "Sin completar"} />
          <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-3">
            <dt className="flex items-center gap-2 text-muted">
              <ShieldCheck className="size-4" />
              Rol
            </dt>
            <dd>
              <Badge variant={user.role === "client" ? "neutral" : "lime"}>
                {ROLE_LABEL[user.role] ?? user.role}
              </Badge>
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-xs text-muted">
          Para corregir cualquier dato de tu cuenta, escríbenos desde{" "}
          <Link href="/cuenta/soporte" className="text-lime hover:underline">
            Soporte
          </Link>
          .
        </p>

        <div className="mt-5">
          <LogoutButton />
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="text-display mb-4 text-lg">Tus datos personales</h2>
        <p className="text-sm text-muted">
          GETIN trata tus datos para gestionar tus compras y tu acceso a los eventos, conforme a la
          Ley 29733 de Protección de Datos Personales. Puedes ejercer tus derechos de acceso,
          rectificación, cancelación y oposición escribiendo a{" "}
          <a href="mailto:privacidad@getin.pe" className="text-lime hover:underline">
            privacidad@getin.pe
          </a>
          .
        </p>
        <p className="mt-3 text-sm text-muted">
          Tu código QR no contiene datos personales: es un identificador aleatorio firmado que solo
          sirve para validar tu ingreso.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/legal/privacidad">Leer la política de privacidad</Link>
        </Button>
      </section>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-muted">
        <Icon className="size-4" />
        {label}
      </dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}
