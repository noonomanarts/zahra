"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, isolateHistory, redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { editableMarkdown } from "@/lib/markdown-editing";
import { renderRichContent, storeMarkdown } from "@/lib/rich-content";
import { markdownCommand, type MarkdownCommand } from "@/lib/markdown-command";
import type { Locale } from "@/lib/i18n/config";
import { useAdminI18n } from "./AdminI18n";

const labels = {
  en: { write: "Write", preview: "Preview", empty: "Nothing to preview yet.", loading: "Loading editor…", error: "Preview unavailable. Your text is preserved; return to Write to continue.", fallback: "The advanced editor could not load. You can still edit the Markdown below.", hint: "Markdown supported · Ctrl/⌘ B bold · Ctrl/⌘ I italic · Ctrl/⌘ K link", placeholder: "Write your content here…", words: "words", heading: "Heading", bold: "Bold", italic: "Italic", quote: "Quote", bullet: "Bulleted list", numbered: "Numbered list", task: "Task list", link: "Link", image: "Image URL", code: "Code block", table: "Table", undo: "Undo", redo: "Redo", help: "Formatting guide", guide: "## Heading · **bold** · _italic_ · [link](https://example.com) · - [ ] task. Images use an existing image URL; files are not uploaded here. Raw HTML is displayed as text." },
  ar: { write: "كتابة", preview: "معاينة", empty: "لا يوجد محتوى للمعاينة بعد.", loading: "جارٍ تحميل المحرر…", error: "تعذرت المعاينة. النص محفوظ؛ ارجع إلى الكتابة للمتابعة.", fallback: "تعذر تحميل المحرر المتقدم. يمكنك تحرير Markdown أدناه.", hint: "يدعم Markdown · Ctrl/⌘ B عريض · Ctrl/⌘ I مائل · Ctrl/⌘ K رابط", placeholder: "اكتب المحتوى هنا…", words: "كلمة", heading: "عنوان", bold: "عريض", italic: "مائل", quote: "اقتباس", bullet: "قائمة نقطية", numbered: "قائمة مرقمة", task: "قائمة مهام", link: "رابط", image: "رابط صورة", code: "كتلة كود", table: "جدول", undo: "تراجع", redo: "إعادة", help: "دليل التنسيق", guide: "## عنوان · **عريض** · _مائل_ · [رابط](https://example.com) · - [ ] مهمة. تستخدم الصور رابط صورة موجودة؛ لا يتم رفع ملفات هنا. تُعرض وسوم HTML كنص." },
};
const tools: [MarkdownCommand, string][] = [["heading","H₂"],["bold","B"],["italic","I"],["quote","❝"],["bullet","• ≡"],["numbered","1. ≡"],["task","☑"],["link","↗"],["image","▧"],["code","</>"],["table","▦"]];

export default function MarkdownEditor({ label, name, value, defaultValue = "", onChange, lang = "en", rows = 6 }: {
  label: string; name?: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; lang?: Locale; rows?: number;
}) {
  const { lang: panelLang } = useAdminI18n();
  const t = labels[panelLang];
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  const [initial] = useState(value ?? defaultValue);
  const last = useRef(initial);
  const baseline = useRef({ source: initial, markdown: editableMarkdown(initial) });
  const [source, setSource] = useState(value ?? defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [help, setHelp] = useState(false);
  const text = useMemo(() => editableMarkdown(source), [source]);
  const preview = useMemo(() => {
    try { return { html: renderRichContent(source, lang, true), error: false }; }
    catch { return { html: "", error: true }; }
  }, [source, lang]);
  useEffect(() => { change.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const emit = (doc: string) => {
      const next = doc === baseline.current.markdown ? baseline.current.source : storeMarkdown(doc);
      last.current = next;
      setSource(next);
      change.current?.(next);
    };
    const format = (view: EditorView, command: MarkdownCommand) => {
      const { from, to } = view.state.selection.main;
      const edit = markdownCommand(view.state.doc.toString(), from, to, command);
      view.dispatch({ changes: { from: edit.from, to: edit.to, insert: edit.insert }, selection: { anchor: edit.anchor, head: edit.head }, annotations: [isolateHistory.of("full"), Transaction.userEvent.of("input.toolbar")] });
      return true;
    };
    try {
      const view = new EditorView({ parent: host.current, state: EditorState.create({ doc: baseline.current.markdown, extensions: [
        history(), drawSelection(), markdown(), syntaxHighlighting(defaultHighlightStyle), EditorView.lineWrapping,
        placeholder(labels[panelLang].placeholder),
        EditorView.contentAttributes.of({ "aria-label": label, "aria-multiline": "true", lang, dir: lang === "ar" ? "rtl" : "ltr", spellcheck: "true" }),
        EditorView.theme({ "&": { fontSize: "14px" }, ".cm-content": { minHeight: `${Math.max(5, rows) * 1.6}em`, padding: "16px", fontFamily: lang === "ar" ? "inherit" : "ui-monospace, monospace", lineHeight: "1.7" }, ".cm-scroller": { overflow: "auto", maxHeight: "560px" }, "&.cm-focused": { outline: "none" }, ".cm-line": { padding: "0" }, ".cm-placeholder": { color: "#71717a" } }),
        keymap.of([{ key: "Mod-b", run: v => format(v, "bold") }, { key: "Mod-i", run: v => format(v, "italic") }, { key: "Mod-k", run: v => format(v, "link") }, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of(update => { if (update.docChanged && update.transactions.some(tr => tr.annotation(Transaction.userEvent))) emit(update.state.doc.toString()); }),
      ] }) });
      editor.current = view;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- third-party editor initialization state
      setReady(true);
      return () => { view.destroy(); editor.current = null; };
    } catch { setFailed(true); }
  // Each instance belongs to one language field; prop updates below do not recreate its history.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value === undefined || value === last.current) return;
    last.current = value;
    baseline.current = { source: value, markdown: editableMarkdown(value) };
    setSource(value);
    const view = editor.current;
    if (view && view.state.doc.toString() !== baseline.current.markdown) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: baseline.current.markdown }, annotations: Transaction.addToHistory.of(false) });
  }, [value]);

  function command(kind: MarkdownCommand | "undo" | "redo") {
    const view = editor.current;
    if (!view) return;
    if (kind === "undo") undo(view);
    else if (kind === "redo") redo(view);
    else {
      const { from, to } = view.state.selection.main;
      const edit = markdownCommand(view.state.doc.toString(), from, to, kind);
      view.dispatch({ changes: { from: edit.from, to: edit.to, insert: edit.insert }, selection: { anchor: edit.anchor, head: edit.head }, annotations: [isolateHistory.of("full"), Transaction.userEvent.of("input.toolbar")] });
    }
    view.focus();
  }
  const button = "grid h-8 min-w-8 place-items-center rounded px-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40";
  return (
    <div className="min-w-0" data-markdown-editor={name ?? label}>
      <div className="mb-2 flex items-center justify-between gap-2"><span id={`${id}-label`} className="text-sm font-medium text-zinc-700">{label}</span><span className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 uppercase">{lang}</span></div>
      <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
        {name && <input type="hidden" name={name} value={source} />}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-2 pt-2">
          <div role="tablist" aria-label={label} className="flex self-end gap-1">
            {(["write", "preview"] as const).map(mode => <button key={mode} type="button" role="tab" id={`${id}-${mode}-tab`} aria-selected={tab === mode} aria-controls={`${id}-${mode}`} tabIndex={tab === mode ? 0 : -1} onKeyDown={e => { if (["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? "write" : e.key === "End" ? "preview" : tab === "write" ? "preview" : "write"; setTab(next); document.getElementById(`${id}-${next}-tab`)?.focus(); } }} onClick={() => setTab(mode)} className={`rounded-t-lg px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${tab === mode ? "-mb-px border border-b-white border-zinc-200 bg-white text-zinc-950" : "text-zinc-500 hover:text-zinc-900"}`}>{t[mode]}</button>)}
          </div>
          {tab === "write" && <div role="group" aria-label={t.help} className="flex flex-wrap items-center gap-0.5 pb-2" dir="ltr">
            {tools.map(([kind, icon]) => <button key={kind} type="button" disabled={!ready} className={button} title={t[kind]} aria-label={t[kind]} onMouseDown={e => e.preventDefault()} onClick={() => command(kind)}>{icon}</button>)}
            <span aria-hidden="true" className="mx-1 h-4 border-l border-zinc-300" />
            <button type="button" disabled={!ready} className={button} title={t.undo} aria-label={t.undo} onMouseDown={e => e.preventDefault()} onClick={() => command("undo")}>↶</button>
            <button type="button" disabled={!ready} className={button} title={t.redo} aria-label={t.redo} onMouseDown={e => e.preventDefault()} onClick={() => command("redo")}>↷</button>
          </div>}
        </div>
        <div id={`${id}-write`} role="tabpanel" aria-labelledby={`${id}-write-tab`} hidden={tab !== "write"}>
          {!ready && !failed && <p role="status" className="p-4 text-sm text-zinc-500">{t.loading}</p>}
          <div ref={host} dir={lang === "ar" ? "rtl" : "ltr"} />
          {failed && <><p role="alert" className="p-3 text-sm text-amber-800">{t.fallback}</p><textarea aria-label={label} rows={rows} dir={lang === "ar" ? "rtl" : "ltr"} value={text} onChange={e => { const next = storeMarkdown(e.target.value); last.current = next; setSource(next); change.current?.(next); }} className="w-full p-4 font-mono text-sm" /></>}
        </div>
        <div id={`${id}-preview`} role="tabpanel" aria-labelledby={`${id}-preview-tab`} hidden={tab !== "preview"} tabIndex={0} dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-40 overflow-x-auto p-4">
          {preview.error ? <p role="alert" className="text-sm text-red-700">{t.error}</p> : text.trim() ? <div className="prose-zahra markdown-content" dangerouslySetInnerHTML={{ __html: preview.html }} /> : <p className="py-8 text-center text-sm text-zinc-400">{t.empty}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500"><button type="button" onClick={() => setHelp(!help)} aria-expanded={help} aria-controls={`${id}-help`} className="rounded text-start hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-brand">{t.hint}</button><span>{text.trim() ? text.trim().split(/\s+/).length : 0} {t.words}</span></div>
        {help && <p id={`${id}-help`} className="border-t border-zinc-100 bg-zinc-50 p-3 text-xs leading-6 text-zinc-600">{t.guide}</p>}
      </div>
    </div>
  );
}
