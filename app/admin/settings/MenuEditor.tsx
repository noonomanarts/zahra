"use client";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { LangTag, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import type { L, MenuItem } from "@/lib/types";

const EMPTY: MenuItem = { label: { en: "", ar: "" }, href: "/" };

function LabelInputs({ value, onChange }: { value: L; onChange: (v: L) => void }) {
  const { t } = useAdminI18n();
  return (
    <>
      {(["en", "ar"] as const).map((lang) => (
        <div key={lang} className="relative min-w-36 flex-1">
          <input
            value={value[lang]}
            dir={lang === "ar" ? "rtl" : "ltr"}
            lang={lang}
            aria-label={`${t.settings.label} (${lang})`}
            placeholder={t.settings.label}
            onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
            className={`${inputCls} pe-10`}
          />
          <LangTag lang={lang} />
        </div>
      ))}
    </>
  );
}

function Row({ item, onChange, onRemove, onMove, nested }: { item: MenuItem; onChange: (m: MenuItem) => void; onRemove: () => void; onMove: (d: -1 | 1) => void; nested?: boolean }) {
  const { t } = useAdminI18n();
  return (
    <div className={nested ? "ms-6 border-s-2 border-zinc-100 ps-3" : ""}>
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        <LabelInputs value={item.label} onChange={(label) => onChange({ ...item, label })} />
        <input
          value={item.href}
          dir="ltr"
          aria-label={t.settings.link}
          placeholder="/about-us"
          onChange={(e) => onChange({ ...item, href: e.target.value })}
          className={`${inputCls} w-44 font-mono text-xs`}
        />
        <div className="flex gap-1 text-sm">
          <button type="button" onClick={() => onMove(-1)} className="rounded px-2 py-1 hover:bg-zinc-100" aria-label="↑">↑</button>
          <button type="button" onClick={() => onMove(1)} className="rounded px-2 py-1 hover:bg-zinc-100" aria-label="↓">↓</button>
          <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-red-700 hover:bg-red-50">{t.common.delete}</button>
        </div>
      </div>
      {!nested && (
        <>
          {item.children?.map((c, i) => (
            <Row
              key={i}
              nested
              item={c}
              onChange={(m) => onChange({ ...item, children: item.children!.map((x, j) => (j === i ? m : x)) })}
              onRemove={() => onChange({ ...item, children: item.children!.filter((_, j) => j !== i) })}
              onMove={(d) => onChange({ ...item, children: move(item.children!, i, d) })}
            />
          ))}
          <button type="button" onClick={() => onChange({ ...item, children: [...(item.children ?? []), structuredClone(EMPTY)] })} className="ms-6 mb-2 text-xs text-zinc-500 hover:text-zinc-900">
            + {t.settings.addSubItem}
          </button>
        </>
      )}
    </div>
  );
}

function move<T>(list: T[], i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Editable list of menu items (one level of sub-items). */
export function MenuItems({ items, onChange }: { items: MenuItem[]; onChange: (items: MenuItem[]) => void }) {
  const { t } = useAdminI18n();
  return (
    <div>
      {items.map((item, i) => (
        <Row
          key={i}
          item={item}
          onChange={(m) => onChange(items.map((x, j) => (j === i ? m : x)))}
          onRemove={() => onChange(items.filter((_, j) => j !== i))}
          onMove={(d) => onChange(move(items, i, d))}
        />
      ))}
      <button type="button" onClick={() => onChange([...items, structuredClone(EMPTY)])} className={`${btnSecondaryCls} mt-2`}>
        {t.settings.addItem}
      </button>
    </div>
  );
}

export { LabelInputs };
