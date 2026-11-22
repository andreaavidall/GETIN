import "server-only";

import { serverEnv } from "@/lib/env";
import { CulqiPaymentProvider } from "@/lib/payments/culqi-provider";
import { TestPaymentProvider } from "@/lib/payments/test-provider";
import type { PaymentProvider } from "@/lib/payments/types";

let instance: PaymentProvider | null = null;

/**
 * Devuelve el proveedor de pagos activo según PAYMENTS_PROVIDER.
 * Por defecto es el adaptador de pruebas, que no cobra dinero real.
 */
export function getPaymentProvider(): PaymentProvider {
  if (instance) return instance;
  const env = serverEnv();

  instance =
    env.PAYMENTS_PROVIDER === "culqi"
      ? new CulqiPaymentProvider(env.CULQI_PUBLIC_KEY, env.CULQI_SECRET_KEY, env.CULQI_WEBHOOK_SECRET)
      : new TestPaymentProvider(env.PAYMENTS_TEST_WEBHOOK_SECRET);

  return instance;
}

/** Para los tests: permite inyectar un doble. */
export function __setPaymentProvider(provider: PaymentProvider | null): void {
  instance = provider;
}

export * from "@/lib/payments/types";
