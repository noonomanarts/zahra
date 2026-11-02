import { verifyAmwalNotification } from "@/lib/amwalpay";
import { applyAmwalTransaction } from "@/lib/orders";

/** AmwalPay cloud notification. Ask AmwalPay to send it to this address. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "invalid body" }, { status: 400 });
  const tx = await verifyAmwalNotification(body);
  if (!tx) return Response.json({ error: "invalid signature" }, { status: 401 });
  const order = await applyAmwalTransaction(tx);
  return Response.json({ ok: true, order: order?.number ?? null, status: order?.status ?? null });
}
