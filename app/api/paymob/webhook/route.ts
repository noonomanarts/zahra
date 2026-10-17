import { applyPaymobTransaction } from "@/lib/orders";
import { verifyProcessedCallback } from "@/lib/paymob";

/** Paymob "transaction processed" callback. Configure it as the notification URL in the Paymob dashboard. */
export async function POST(request: Request) {
  const hmac = new URL(request.url).searchParams.get("hmac") ?? "";
  const body = await request.json().catch(() => null);
  if (!body?.obj || (body.type && body.type !== "TRANSACTION")) {
    return Response.json({ ok: true, ignored: true });
  }

  const tx = verifyProcessedCallback(body.obj, hmac);
  if (!tx) return Response.json({ error: "invalid signature" }, { status: 401 });

  const order = await applyPaymobTransaction(tx);
  return Response.json({ ok: true, order: order?.number ?? null, status: order?.status ?? null });
}
