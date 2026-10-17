import { clearInvalidCustomerSession, getCustomer } from "@/lib/customer-auth";

/** Read session state separately so storefront pages can stay static and work offline. */
export async function GET() {
  const customer = await getCustomer();
  if (!customer) await clearInvalidCustomerSession();
  return Response.json(
    { customer: customer ? { name: customer.name, email: customer.email } : null },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
