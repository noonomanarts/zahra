"use client";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { Card, inputCls } from "@/components/admin/ui";

export type SavedFile = { id: string; name: string; size: number };

const size = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(Math.round(bytes / 1024), 1)} KB`);

/** The files a buyer gets after paying. Stored privately: there is no public address for them. */
export default function DigitalFiles({ files, onChange }: { files: SavedFile[]; onChange: (files: SavedFile[]) => void }) {
  const { t } = useAdminI18n();
  const p = t.products;
  return (
    <Card title={p.filesTitle} description={p.filesHint}>
      <input type="hidden" name="digitalFiles" value={JSON.stringify(files.map(({ id, name }) => ({ id, name })))} />
      {files.length > 0 ? (
        <ul className="mb-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200/80">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-2.5">
              <Icon name="file" size={18} className="shrink-0 text-zinc-400" />
              <input aria-label={p.fileName} value={f.name} maxLength={120} dir="auto" onChange={(e) => onChange(files.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))} className={`${inputCls} min-w-0 flex-1 py-1.5`} />
              <span className="shrink-0 text-xs text-zinc-500" dir="ltr">{size(f.size)}</span>
              <button type="button" onClick={() => onChange(files.filter((x) => x.id !== f.id))} aria-label={p.removeFile} title={p.removeFile} className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-50 hover:text-red-600"><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">{p.noFile}</p>
      )}
      <input type="file" name="newDigitalFiles" multiple accept=".pdf,.zip,application/pdf,application/zip" className="block w-full text-sm text-zinc-600 file:me-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white" />
    </Card>
  );
}
