/** Request status → admin badge colour. */
export const REQUEST_BADGE: Record<string, string> = {
  new: "pending",
  quoted: "warning",
  accepted: "paid",
  "in-progress": "processing",
  completed: "completed",
  cancelled: "cancelled",
};
