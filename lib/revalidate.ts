import "server-only";
import { revalidatePath } from "next/cache";

/** Content is shared across the whole storefront (menus, product grids, …), so refresh every page. */
export function revalidateSite() {
  revalidatePath("/", "layout");
}
