"use client";

import { AlertTriangle, Camera, CameraOff, CheckCircle2, Keyboard, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Escaner de puerta.
 *
 * Lectura de QR con `BarcodeDetector`, la API nativa del navegador: en Chrome
 * de Android (el caso real del personal de puerta) funciona sin cargar ninguna
 * libreria. Donde no exista, se usa la entrada manual del codigo, que recorre
 * exactamente el mismo endpoint. Preferir lo nativo evita meter ~50 KB de
 * JavaScript en un telefono con mala señal en la puerta de una discoteca.
 *
 * El veredicto lo decide SIEMPRE el servidor. Esta pantalla solo lo pinta:
 *   verde   = ingreso autorizado
 *   rojo    = invalida o ya utilizada
 *   amarillo= requiere revision del personal
 */
type ScanResult = {
  result: string;
  detail: string;
  kind?: string;
  label?: string;
  holder?: string;
  event?: string;
};

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

const GREEN = ["granted"];
const YELLOW = ["review"];

export function Scanner({ venueId, venueName }: { venueId: string; venueName: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastTokenRef = useRef<string>("");

  const [cameraOn, setCameraOn] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ granted: 0, denied: 0 });

  useEffect(() => {
    const available =
      typeof window !== "undefined" &&
      "BarcodeDetector" in window &&
      typeof navigator.mediaDevices?.getUserMedia === "function";
    setSupported(available);
  }, []);

  const validate = useCallback(
    async (token: string) => {
      if (!token || busy) return;
      setBusy(true);
      try {
        const response = await fetch("/api/puerta/validar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, venueId, device: "navegador" }),
        });
        const body = (await response.json()) as ScanResult & { error?: string };

        if (body.error) {
          setResult({ result: "review", detail: body.error });
        } else {
          setResult(body);
          setCounts((prev) =>
            body.result === "granted"
              ? { ...prev, granted: prev.granted + 1 }
              : { ...prev, denied: prev.denied + 1 },
          );
        }
        // Vibracion corta/larga segun el veredicto: en la puerta no siempre se
        // puede mirar la pantalla.
        if (typeof navigator.vibrate === "function") {
          navigator.vibrate(body.result === "granted" ? 60 : [80, 60, 80]);
        }
      } catch {
        setResult({ result: "review", detail: "Sin conexion. Reintenta." });
      } finally {
        setBusy(false);
      }
    },
    [busy, venueId],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const Detector = (window as unknown as { BarcodeDetector: new (o: object) => BarcodeDetectorLike })
        .BarcodeDetector;
      detectorRef.current = new Detector({ formats: ["qr_code"] });
      setCameraOn(true);
    } catch (error) {
      setCameraError(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Permiso de camara denegado. Puedes escribir el codigo a mano."
          : "No se pudo abrir la camara. Usa la entrada manual.",
      );
      setCameraOn(false);
    }
  }, []);

  // Bucle de deteccion mientras la camara esta encendida.
  useEffect(() => {
    if (!cameraOn) return;
    let active = true;

    const loop = async () => {
      while (active) {
        try {
          if (videoRef.current && detectorRef.current && videoRef.current.readyState >= 2) {
            const codes = await detectorRef.current.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value && value !== lastTokenRef.current) {
              lastTokenRef.current = value;
              await validate(value);
              // Pausa para no revalidar el mismo QR en bucle.
              await new Promise((r) => setTimeout(r, 2500));
              lastTokenRef.current = "";
            }
          }
        } catch {
          // Un fotograma ilegible no es un error: se reintenta.
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    };

    void loop();
    return () => {
      active = false;
    };
  }, [cameraOn, validate]);

  useEffect(() => stopCamera, [stopCamera]);

  const tone = result
    ? GREEN.includes(result.result)
      ? "green"
      : YELLOW.includes(result.result)
        ? "yellow"
        : "red"
    : null;

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------------- veredicto */}
      {result ? (
        <div
          role="status"
          aria-live="assertive"
          className={`rounded-2xl border p-6 text-center ${
            tone === "green"
              ? "border-emerald-400/40 bg-emerald-500/15"
              : tone === "yellow"
                ? "border-amber-400/40 bg-amber-400/15"
                : "border-red-500/40 bg-red-500/15"
          }`}
        >
          {tone === "green" ? (
            <CheckCircle2 className="mx-auto size-14 text-emerald-400" />
          ) : tone === "yellow" ? (
            <AlertTriangle className="mx-auto size-14 text-amber-400" />
          ) : (
            <XCircle className="mx-auto size-14 text-red-400" />
          )}

          <p className="text-display mt-3 text-2xl">
            {tone === "green" ? "INGRESO AUTORIZADO" : tone === "yellow" ? "REVISAR" : "NO VALIDA"}
          </p>
          <p className="mt-1 text-sm">{result.detail}</p>

          {result.label || result.holder ? (
            <p className="mt-3 text-xs text-white/70">
              {result.label}
              {result.holder ? ` · ${result.holder}` : ""}
            </p>
          ) : null}

          <Button variant="secondary" size="sm" className="mt-4" onClick={() => setResult(null)}>
            Siguiente persona
          </Button>
        </div>
      ) : null}

      {/* ----------------------------------------------------------- camara */}
      <div className="surface overflow-hidden">
        <div className="relative aspect-square bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`size-full object-cover ${cameraOn ? "" : "hidden"}`}
          />
          {!cameraOn ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Camera className="size-10 text-muted" />
              <p className="text-sm text-muted">
                {supported === false
                  ? "Este navegador no puede leer QR con la camara. Usa la entrada manual."
                  : "Enciende la camara para escanear."}
              </p>
              {supported ? (
                <Button onClick={startCamera} disabled={busy}>
                  <Camera className="size-4" />
                  Encender camara
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-lime/70" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-3 right-3"
                onClick={stopCamera}
              >
                <CameraOff className="size-4" />
                Apagar
              </Button>
            </>
          )}
        </div>

        {cameraError ? (
          <p className="border-t border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
            {cameraError}
          </p>
        ) : null}
      </div>

      {/* ----------------------------------------------------------- manual */}
      <form
        className="surface space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void validate(manual.trim());
          setManual("");
        }}
      >
        <label htmlFor="codigo" className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
          <Keyboard className="size-3.5" />
          Entrada manual del codigo
        </label>
        <Input
          id="codigo"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="GETIN1...."
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" full variant="secondary" disabled={busy || manual.trim().length < 10}>
          {busy ? "Validando..." : "Validar codigo"}
        </Button>
      </form>

      <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3 text-xs">
        <span className="text-muted">Esta sesion en {venueName}</span>
        <span>
          <strong className="text-emerald-400">{counts.granted}</strong> autorizados ·{" "}
          <strong className="text-red-400">{counts.denied}</strong> rechazados
        </span>
      </div>
    </div>
  );
}
