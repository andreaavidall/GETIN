import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { getSession } from "@/lib/auth/session";
import { defaultLandingPath } from "@/lib/domain/permissions";
import { publicEnv } from "@/lib/env";

import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "GETIN · La noche empieza aqui",
    template: "%s · GETIN",
  },
  description:
    "Descubre los mejores eventos de Lima, asegura tu entrada y reserva tu mesa en un solo lugar. GET IN. GO OUT.",
  applicationName: "GETIN",
  keywords: ["discotecas Lima", "eventos Lima", "entradas", "mesas VIP", "fiestas", "nightlife"],
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "GETIN",
    title: "GETIN · La noche empieza aqui",
    description:
      "Entradas, mesas VIP y listas de invitados para la noche de Lima, sin intermediarios informales.",
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="es-PE" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh bg-ink font-sans text-paper">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-lime focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Saltar al contenido
        </a>

        <Navbar
          session={
            session
              ? {
                  name: session.user.fullName,
                  landing: defaultLandingPath(session.actor),
                }
              : null
          }
        />

        <main id="contenido">{children}</main>

        <Footer />

        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "#181818",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
            },
          }}
        />
      </body>
    </html>
  );
}
