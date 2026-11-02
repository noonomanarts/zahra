"use client";

import { useEffect, useRef, useState } from "react";
import { slugify } from "@/lib/format";
import { useAdminI18n } from "./AdminI18n";
import { Icon } from "./icons";
import { Tip } from "./motion";
import { inputCls } from "./ui";

/**
 * Slug field that is generated from the title input `source` of the same form.
 * New items follow the title while it is typed; typing in the slug itself stops that, and the button
 * links it to the title again. Existing items keep their slug (published links stay valid) until the
 * button regenerates it.
 */
export default function SlugInput({
  source = "name_en",
  defaultValue = "",
  prefix,
  className = "",
  ariaLabel,
}: {
  source?: string;
  defaultValue?: string;
  /** shown as a live URL preview, e.g. "/products/" */
  prefix?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const { t } = useAdminI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [linked, setLinked] = useState(!defaultValue);
  const linkedRef = useRef(linked);
  useEffect(() => {
    linkedRef.current = linked;
  }, [linked]);

  useEffect(() => {
    const form = ref.current?.form;
    const input = form?.elements.namedItem(source) as HTMLInputElement | null;
    if (!form || !input) return;
    const follow = () => {
      if (linkedRef.current) setValue(slugify(input.value));
    };
    // React resets the form after a successful save; start over from the stored value
    const reset = () => {
      setValue(defaultValue);
      setLinked(!defaultValue);
    };
    input.addEventListener("input", follow);
    form.addEventListener("reset", reset);
    return () => {
      input.removeEventListener("input", follow);
      form.removeEventListener("reset", reset);
    };
  }, [source, defaultValue]);

  const regenerate = () => {
    const input = ref.current?.form?.elements.namedItem(source) as HTMLInputElement | null;
    setValue(slugify(input?.value ?? ""));
    setLinked(true);
  };

  return (
    <div className={className}>
      <div className="relative" dir="ltr">
        <input
          ref={ref}
          name="slug"
          dir="ltr"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setLinked(false);
          }}
          onBlur={() => setValue((v) => slugify(v))}
          placeholder={t.common.slugPlaceholder}
          aria-label={ariaLabel}
          spellCheck={false}
          autoComplete="off"
          className={`${inputCls} pe-10 font-mono text-xs`}
        />
        <Tip label={linked ? t.common.slugLinked : t.common.slugRegenerate}>
          <button
            type="button"
            onClick={regenerate}
            aria-label={t.common.slugRegenerate}
            aria-pressed={linked}
            className={`absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md transition outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
              linked ? "bg-brand-soft text-brand-ink" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
            }`}
          >
            <Icon name={linked ? "link" : "refresh"} size={15} />
          </button>
        </Tip>
      </div>
      {prefix && (
        <p className="mt-1.5 truncate font-mono text-[11px] text-zinc-500" dir="ltr">
          {prefix}
          <span className="text-zinc-800">{value || "…"}</span>
        </p>
      )}
    </div>
  );
}
