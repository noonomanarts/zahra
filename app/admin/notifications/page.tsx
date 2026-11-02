import type { Metadata } from "next";
import { listNotifications, unreadCount } from "@/lib/admin-notifications";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { NOTIFICATION_GROUPS, kindsFor } from "@/lib/notification-kinds";
import { permissionList } from "@/lib/permissions";
import { PageTitle, Pagination, btnSecondaryCls } from "@/components/admin/ui";
import { SlidingTabs } from "@/components/admin/motion";
import { markAllRead } from "./actions";
import NotificationList from "./NotificationList";

export const metadata: Metadata = { title: "Notifications" };

const PER_PAGE = 30;

export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  const admin = await requireAdmin();
  const { t } = await getAdminT();
  const n = t.notifications;
  const { filter: rawFilter = "all", page: rawPage } = (await searchParams) as { filter?: string; page?: string };
  const mine = kindsFor(permissionList(admin.permissions));
  // only the groups this person has anything in
  const groups = (Object.entries(NOTIFICATION_GROUPS) as [string, readonly string[]][]).filter(([, kinds]) => kinds.some((k) => (mine as string[]).includes(k)));
  const filter = rawFilter === "unread" || groups.some(([g]) => g === rawFilter) ? rawFilter : "all";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const [unread, { items, total }] = await Promise.all([
    unreadCount(admin),
    listNotifications(admin, {
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
      unreadOnly: filter === "unread",
      kinds: filter === "all" || filter === "unread" ? undefined : groups.find(([g]) => g === filter)?.[1],
    }),
  ]);
  const href = (f: string, p = 1) => {
    const params = new URLSearchParams();
    if (f !== "all") params.set("filter", f);
    if (p > 1) params.set("page", String(p));
    const query = params.toString();
    return query ? `/admin/notifications?${query}` : "/admin/notifications";
  };

  return (
    <>
      <PageTitle title={n.title} description={n.subtitle} actions={unread > 0 ? <form action={markAllRead}><button className={btnSecondaryCls}>{n.markAll}</button></form> : undefined} />
      <div className="mb-4">
        <SlidingTabs
          ariaLabel={n.title}
          value={filter}
          items={[
            { value: "all", label: n.all, href: href("all") },
            { value: "unread", label: n.unread, href: href("unread"), count: unread },
            ...groups.map(([g]) => ({ value: g, label: n.groups[g], href: href(g) })),
          ]}
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        {items.length ? <NotificationList items={items} /> : <p className="p-10 text-center text-sm text-zinc-500">{n.empty}</p>}
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} perPage={PER_PAGE} href={(p) => href(filter, p)} labels={t.pagination} />
      </div>
    </>
  );
}
