"use client";

/* eslint-disable @next/next/no-img-element -- YouTube thumbnails in the admin */
import { useActionState, useEffect, useId, useState } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Card, FormMessage, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { Tip } from "@/components/admin/motion";
import type { WorkshopFile, WorkshopVideo } from "@/lib/types";
import { saveWorkshopContent, type ContentState } from "../actions";

type Lesson = WorkshopVideo & { key: string };
type Saved = Pick<WorkshopFile, "id" | "name" | "size">;

const MAX_FILE = 25 * 1024 * 1024;
// Server Actions accept 30 MB per request; leave room for the rest of the form
const MAX_REQUEST = 29 * 1024 * 1024;
const TYPES = [".pdf", ".zip", ".jpg", ".jpeg", ".png", ".webp"];
const spring = { type: "spring", stiffness: 500, damping: 40 } as const;

const ytId = (url: string) => url.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/)?.[1] ?? null;
const newKey = () => Math.random().toString(36).slice(2, 10);
const toLessons = (videos: WorkshopVideo[]) => videos.map((v) => ({ ...v, key: newKey() }));
const snapshot = (lessons: Lesson[], files: Saved[]) =>
  JSON.stringify([lessons.map((l) => [l.title.en, l.title.ar, l.url]), files.map((f) => [f.id, f.name])]);

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileTone(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", cls: "bg-rose-50 text-rose-700 ring-rose-100" };
  if (ext === "zip") return { label: "ZIP", cls: "bg-amber-50 text-amber-700 ring-amber-100" };
  return { label: ext.toUpperCase().slice(0, 4) || "FILE", cls: "bg-sky-50 text-sky-700 ring-sky-100" };
}

const iconBtn =
  "grid size-8 place-items-center rounded-lg text-zinc-500 transition outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:pointer-events-none disabled:opacity-30";

export default function WorkshopContent({ id, videos, files: initialFiles }: { id: number; videos: WorkshopVideo[]; files: Saved[] }) {
  const { t } = useAdminI18n();
  const w = t.workshops;
  const [state, formAction, saving] = useActionState<ContentState, FormData>(saveWorkshopContent, {});
  const [lessons, setLessons] = useState<Lesson[]>(() => toLessons(videos));
  const [files, setFiles] = useState<Saved[]>(initialFiles);
  const [pending, setPending] = useState<File[]>([]);
  const [rejected, setRejected] = useState<string | null>(null);
  const [baseline, setBaseline] = useState(() => snapshot(lessons, initialFiles));
  const [over, setOver] = useState(false);
  const inputId = useId();

  // after a successful save the server returns the stored files; that becomes the new clean state
  const [seen, setSeen] = useState(state.at);
  if (state.at !== seen) {
    setSeen(state.at);
    if (state.files) {
      const next = state.files.map(({ id, name, size }) => ({ id, name, size }));
      setFiles(next);
      setPending([]);
      setBaseline(snapshot(lessons, next));
    }
  }

  const pendingBytes = pending.reduce((sum, f) => sum + f.size, 0);
  const tooBig = pendingBytes > MAX_REQUEST;
  const dirty = pending.length > 0 || snapshot(lessons, files) !== baseline;
  const invalid = lessons.some((l) => (l.url || l.title.en || l.title.ar) && !ytId(l.url));

  // warn before leaving the page with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (key: string, patch: Partial<WorkshopVideo>) => setLessons((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const move = <T,>(list: T[], i: number, dir: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return next;
  };
  const addLesson = () => setLessons((l) => [...l, { key: newKey(), title: { en: "", ar: "" }, url: "" }]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const bad: string[] = [];
    const ok = [...list].filter((f) => {
      const fine = TYPES.some((ext) => f.name.toLowerCase().endsWith(ext)) && f.size > 0 && f.size <= MAX_FILE;
      if (!fine) bad.push(f.name);
      return fine;
    });
    setRejected(bad.length ? bad.map((n) => w.errors.file(n)).join(" ") : null);
    setPending((prev) => [...prev, ...ok.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
  };

  const submit = (formData: FormData) => {
    for (const f of pending) formData.append("newFiles", f);
    formAction(formData);
  };

  return (
    <form action={submit}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="videos" value={JSON.stringify(lessons.map(({ title, url }) => ({ title, url })))} />
      <input type="hidden" name="files" value={JSON.stringify(files.map(({ id, name }) => ({ id, name })))} />

      <div className="grid items-start gap-6 2xl:grid-cols-[1fr_400px]">
        <Card
          title={`${w.lessons} (${lessons.length})`}
          description={w.lessonsDesc}
          actions={
            lessons.length > 0 && (
              <button type="button" onClick={addLesson} className={btnSecondaryCls}>
                <Icon name="plus" size={16} /> {w.addLesson}
              </button>
            )
          }
        >
          {lessons.length ? (
            <Reorder.Group as="ol" axis="y" values={lessons} onReorder={setLessons} className="space-y-3">
              <AnimatePresence initial={false}>
                {lessons.map((lesson, i) => (
                  <LessonRow
                    key={lesson.key}
                    lesson={lesson}
                    index={i}
                    total={lessons.length}
                    onChange={(patch) => update(lesson.key, patch)}
                    onMove={(dir) => setLessons((l) => move(l, i, dir))}
                    onRemove={() => setLessons((l) => l.filter((x) => x.key !== lesson.key))}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>
          ) : (
            <button
              type="button"
              onClick={addLesson}
              className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center transition hover:border-zinc-400 hover:bg-zinc-50"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon name="video" size={22} /></span>
              <span className="text-sm text-zinc-500">{w.noLessons}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900"><Icon name="plus" size={15} /> {w.addLesson}</span>
            </button>
          )}
        </Card>

        <Card title={`${w.files} (${files.length + pending.length})`} description={w.filesDesc}>
          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-900 ${
              over ? "border-brand bg-brand-soft/60" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <motion.span animate={over ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }} transition={spring} className="grid size-11 place-items-center rounded-xl bg-zinc-900 text-white shadow-sm">
              <Icon name="upload" size={20} />
            </motion.span>
            <span className="text-sm font-medium text-zinc-800">{w.drop}</span>
            <span className="text-xs text-zinc-500">{w.dropHint}</span>
            <input
              id={inputId}
              type="file"
              multiple
              accept=".pdf,.zip,image/jpeg,image/png,image/webp,application/pdf,application/zip"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>
          {rejected && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{rejected}</p>}

          {files.length + pending.length > 0 ? (
            <ul className="mt-4 space-y-2">
              <AnimatePresence initial={false}>
                {files.map((f, i) => (
                  <motion.li
                    key={f.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={spring}
                    className="rounded-xl border border-zinc-200 bg-white p-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileBadge name={f.name} />
                      <input
                        value={f.name}
                        onChange={(e) => setFiles((l) => l.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))}
                        aria-label={w.fileName}
                        title={w.fileName}
                        dir="auto"
                        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-900 transition outline-none hover:border-zinc-200 focus:border-zinc-300 focus:bg-white"
                      />
                      <span className="shrink-0 text-xs text-zinc-400 tabular-nums" dir="ltr">{formatSize(f.size)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-end gap-0.5 border-t border-zinc-100 pt-1.5">
                      <Tip label={w.download}>
                        <a href={`/api/workshops/${id}/files/${f.id}`} aria-label={w.download} className={iconBtn}><Icon name="download" size={16} /></a>
                      </Tip>
                      <Tip label={w.moveUp}>
                        <button type="button" disabled={i === 0} onClick={() => setFiles((l) => move(l, i, -1))} aria-label={w.moveUp} className={iconBtn}><span aria-hidden="true">↑</span></button>
                      </Tip>
                      <Tip label={w.moveDown}>
                        <button type="button" disabled={i === files.length - 1} onClick={() => setFiles((l) => move(l, i, 1))} aria-label={w.moveDown} className={iconBtn}><span aria-hidden="true">↓</span></button>
                      </Tip>
                      <Tip label={w.removeFile}>
                        <button type="button" onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))} aria-label={w.removeFile} className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}><Icon name="trash" size={16} /></button>
                      </Tip>
                    </div>
                  </motion.li>
                ))}
                {pending.map((f) => (
                  <motion.li
                    key={`${f.name}-${f.size}`}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={spring}
                    className="flex items-center gap-2.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-2.5"
                  >
                    <FileBadge name={f.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-900" dir="auto">{f.name}</span>
                      <span className="block text-xs text-emerald-700">{w.pendingFile} · <bdi dir="ltr">{formatSize(f.size)}</bdi></span>
                    </span>
                    <Tip label={w.removeFile}>
                      <button type="button" onClick={() => setPending((l) => l.filter((x) => x !== f))} aria-label={w.removeFile} className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}><Icon name="close" size={16} /></button>
                    </Tip>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="mt-4 text-center text-sm text-zinc-500">{w.noFiles}</p>
          )}
          {tooBig && <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{w.tooBig}</p>}
        </Card>
      </div>

      {/* save bar: always in reach at the bottom of the screen */}
      <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white/95 px-4 py-3 shadow-lg shadow-zinc-900/5 backdrop-blur">
        <div className="min-w-0 text-sm" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={saving ? "saving" : dirty ? "dirty" : (state.error ?? state.ok ?? "idle")} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              {saving ? (
                <span className="text-zinc-500">{t.common.saving}</span>
              ) : dirty ? (
                <span className="flex items-center gap-2 font-medium text-zinc-700">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
                  </span>
                  {w.unsaved}
                  {state.error && <span className="font-normal text-red-700">· {state.error}</span>}
                </span>
              ) : state.ok || state.error ? (
                <FormMessage state={state} />
              ) : (
                <span className="text-zinc-500">{`${w.lessonsCount(lessons.length)} · ${w.filesCount(files.length)}`}</span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <button disabled={saving || !dirty || tooBig || invalid} className={btnCls}>
          <Icon name="check" size={16} /> {saving ? t.common.saving : w.save}
        </button>
      </div>
    </form>
  );
}

function FileBadge({ name }: { name: string }) {
  const tone = fileTone(name);
  return <span className={`grid h-9 w-10 shrink-0 place-items-center rounded-lg text-[10px] font-bold tracking-wide ring-1 ring-inset ${tone.cls}`}>{tone.label}</span>;
}

function LessonRow({
  lesson,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  lesson: Lesson;
  index: number;
  total: number;
  onChange: (patch: Partial<WorkshopVideo>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useAdminI18n();
  const w = t.workshops;
  const controls = useDragControls();
  const id = ytId(lesson.url);
  const invalid = !!lesson.url && !id;

  return (
    <Reorder.Item
      value={lesson}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={spring}
      whileDrag={{ scale: 1.015, boxShadow: "0 18px 40px -12px rgba(16,16,16,0.25)" }}
      className="relative rounded-xl border border-zinc-200 bg-white"
    >
      <div className="flex gap-3 p-3">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          aria-label={w.drag}
          title={w.drag}
          className="-my-1 -ms-1 grid w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-zinc-300 transition hover:bg-zinc-50 hover:text-zinc-600 active:cursor-grabbing"
        >
          <Icon name="grip" size={18} strokeWidth={3} />
        </button>

        <a
          href={id ? `https://www.youtube.com/watch?v=${id}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={id ? w.openVideo : undefined}
          className="group relative hidden aspect-video w-36 shrink-0 self-start overflow-hidden rounded-lg bg-zinc-100 sm:block"
        >
          {id ? (
            <>
              <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="size-full object-cover" loading="lazy" />
              <span className="absolute inset-0 grid place-items-center bg-black/10 transition group-hover:bg-black/30">
                <span className="grid size-8 place-items-center rounded-full bg-white/95 text-red-600 shadow transition group-hover:scale-110">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5L7 4.5Z" /></svg>
                </span>
              </span>
            </>
          ) : (
            <span className="grid size-full place-items-center text-zinc-300"><Icon name="video" size={24} /></span>
          )}
          <span className="absolute start-1.5 top-1.5 grid size-5 place-items-center rounded-md bg-zinc-900/80 text-[11px] font-semibold text-white">{index + 1}</span>
        </a>

        <div className="grid min-w-0 flex-1 gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="relative" dir="ltr">
              <input value={lesson.title.en} onChange={(e) => onChange({ title: { ...lesson.title, en: e.target.value } })} placeholder={w.lessonTitle} aria-label={`${w.lessonTitle} (EN)`} dir="ltr" lang="en" className={`${inputCls} pe-10`} />
              <span className="pointer-events-none absolute end-2 top-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-500">EN</span>
            </div>
            <div className="relative" dir="rtl">
              <input value={lesson.title.ar} onChange={(e) => onChange({ title: { ...lesson.title, ar: e.target.value } })} placeholder={w.lessonTitle} aria-label={`${w.lessonTitle} (AR)`} dir="rtl" lang="ar" className={`${inputCls} pe-10`} />
              <span className="pointer-events-none absolute end-2 top-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-500">AR</span>
            </div>
          </div>
          <div className="relative" dir="ltr">
            <span className={`pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 ${id ? "text-red-600" : "text-zinc-400"}`}><Icon name="video" size={16} /></span>
            <input
              value={lesson.url}
              onChange={(e) => onChange({ url: e.target.value.trim() })}
              placeholder="https://youtu.be/…"
              aria-label={w.youtube}
              aria-invalid={invalid}
              dir="ltr"
              className={`${inputCls} ps-9 font-mono text-xs aria-[invalid=true]:border-red-400`}
            />
          </div>
          {invalid && <span className="text-xs text-red-700">{w.invalidVideo}</span>}
        </div>

        <div className="flex shrink-0 flex-col gap-0.5">
          <Tip label={w.moveUp} side="left">
            <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={w.moveUp} className={iconBtn}><span aria-hidden="true">↑</span></button>
          </Tip>
          <Tip label={w.moveDown} side="left">
            <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={w.moveDown} className={iconBtn}><span aria-hidden="true">↓</span></button>
          </Tip>
          <Tip label={w.removeLesson} side="left">
            <button type="button" onClick={onRemove} aria-label={w.removeLesson} className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}><Icon name="trash" size={16} /></button>
          </Tip>
        </div>
      </div>
    </Reorder.Item>
  );
}
