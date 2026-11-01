"use client";

/**
 * Animated admin controls built on Animate UI primitives (Radix UI + Motion).
 * They work inside plain Server Action forms: Switch and Checkbox post `name=on` / their value like native inputs.
 */
import { useId, useState } from "react";
import { AlertDialog, Checkbox, Switch, Tooltip } from "@animate-ui/react/primitives/radix-ui";
import { CountingNumber } from "@animate-ui/react/primitives/texts/counting-number";
import { Highlight, HighlightItem } from "@animate-ui/react/primitives/effects/highlight";
import { Icon } from "./icons";

const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

/** On/off setting with label and optional description. */
export function ToggleField({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onCheckedChange,
}: {
  name?: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-zinc-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{description}</span>}
      </label>
      <Switch.Root
        // Radix resets to the value it was mounted with when the form resets after a save; remounting
        // when the saved value changes keeps that reset point equal to what is stored.
        key={String(defaultChecked)}
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-zinc-200 p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 data-[state=checked]:bg-zinc-900"
      >
        <Switch.Thumb
          transition={spring}
          className="block size-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5"
        />
      </Switch.Root>
    </div>
  );
}

/** Checkbox for lists (categories, tags): posts `name=value` when checked. */
export function CheckItem({ name, value, label, defaultChecked }: { name: string; value: string | number; label: string; defaultChecked?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50">
      <Checkbox.Root
        key={String(defaultChecked)}
        id={id}
        name={name}
        value={String(value)}
        defaultChecked={defaultChecked}
        className="grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-zinc-300 bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand data-[state=checked]:border-zinc-900 data-[state=checked]:bg-zinc-900"
      >
        <Checkbox.Indicator className="text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5 10 17 19 7" />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

/**
 * A destructive action that asks first. The confirm button submits the form with id `form`
 * (the dialog is portalled, so it can't sit inside the form itself).
 */
export function ConfirmAction({
  form,
  trigger,
  title,
  description,
  confirm,
  cancel,
  className,
}: {
  form: string;
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  cancel: string;
  className: string;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className={className}>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
          <div className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
              <Icon name="alert" size={20} />
            </span>
            <div className="min-w-0">
              <AlertDialog.Title className="font-sans text-base font-semibold text-zinc-900">{title}</AlertDialog.Title>
              <AlertDialog.Description className="mt-1.5 text-sm leading-relaxed text-zinc-500">{description}</AlertDialog.Description>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2">{cancel}</AlertDialog.Cancel>
            <AlertDialog.Action type="submit" form={form} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition outline-none hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
              {confirm}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** Tooltip for icon-only buttons. */
export function Tip({ label, children, side = "top" }: { label: string; children: React.ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side={side} sideOffset={6} className="z-50 rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
            {label}
            <Tooltip.Arrow className="fill-zinc-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/** A number that counts up when it comes into view. */
export function Count({ value, decimals = 0, prefix, suffix }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  return (
    // only the digits are forced left-to-right; the currency label follows the page direction
    <span className="tabular-nums">
      {prefix}
      <bdi dir="ltr">
        <CountingNumber number={value} decimalPlaces={decimals} thousandSeparator="," transition={{ stiffness: 90, damping: 30 }} inView inViewOnce />
      </bdi>
      {suffix}
    </span>
  );
}

/** Row of links (filters, periods) with a pill that slides to the current or hovered one. */
export function SlidingTabs({ items, value, ariaLabel }: { items: { value: string; label: string; href: string; count?: number }[]; value: string; ariaLabel: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <nav aria-label={ariaLabel} className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex w-max gap-0.5 rounded-xl bg-zinc-200/60 p-1 text-sm ring-1 ring-inset ring-zinc-200/70" onMouseLeave={() => setHovered(null)}>
        <Highlight controlledItems value={hovered ?? value} transition={spring} className="inset-0 rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80">
          {items.map((item) => (
            <HighlightItem key={item.value} value={item.value}>
              <a
                href={item.href}
                aria-current={item.value === value ? "page" : undefined}
                onMouseEnter={() => setHovered(item.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors ${item.value === value ? "font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {item.label}
                {item.count !== undefined && item.count > 0 && (
                  <span className="rounded-full bg-zinc-200/80 px-1.5 text-[11px] font-semibold text-zinc-600">{item.count}</span>
                )}
              </a>
            </HighlightItem>
          ))}
        </Highlight>
      </div>
    </nav>
  );
}
