import Link from "next/link";

import { AccountTabs } from "@/components/layout/account-tabs";
import { requireSession } from "@/lib/auth/guards";
import { manageableVenueIds } from "@/lib/domain/permissions";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("/cuenta");
  // Solo quien manda en el local ve el enlace al panel: a la puerta le
  // ofreciamos un enlace que ahora la redirige al escaner.
  const manages = manageableVenueIds(session.actor).length > 0;

  return (
    <div className="container py-8">
      <header className="mb-6">
        <h1 className="text-display text-3xl">Mi cuenta</h1>
        <p className="mt-1 text-sm text-muted">
          {session.user.fullName ?? session.user.email}
          {manages ? (
            <>
              {" · "}
              <Link href="/club/dashboard" className="text-lime hover:underline">
                Ir al panel de mi local
              </Link>
            </>
          ) : null}
          {session.user.role === "superadmin" ? (
            <>
              {" · "}
              <Link href="/admin" className="text-lime hover:underline">
                Panel GETIN
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <AccountTabs />

      <div className="mt-6">{children}</div>
    </div>
  );
}
