import { AlertTriangle } from "lucide-react";

/**
 * Envoltura de las paginas legales.
 *
 * El aviso de borrador es deliberado y no debe quitarse hasta que un abogado
 * peruano revise los textos: publicar condiciones sin revisar expone al negocio
 * y al usuario.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-display text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-2 text-xs text-muted">Ultima actualizacion: {updated}</p>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <p className="text-sm text-amber-100/90">
          <strong className="font-semibold">Borrador sujeto a revision legal.</strong> Este texto es
          un punto de partida redactado por el equipo de producto, no asesoria juridica. Antes de
          operar comercialmente debe revisarlo un abogado con conocimiento de la normativa peruana
          (Codigo de Proteccion y Defensa del Consumidor, Ley 29733 de Proteccion de Datos
          Personales y normas de comercio electronico).
        </p>
      </div>

      <div className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-white/80 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-paper [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </div>
  );
}
