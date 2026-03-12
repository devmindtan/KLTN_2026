/** Các helper component dùng chung trong trang Sandbox */
import React from "react"

// ─── SectionTitle ──────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground mb-3 mt-6 first:mt-0 flex items-center gap-2">
      <span className="h-px flex-1 bg-border" />
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </h3>
  )
}

// ─── DemoRow ───────────────────────────────────────────────────────────────────
export function DemoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

// ─── PropRow ───────────────────────────────────────────────────────────────────
interface PropRowData {
  prop: string
  type: string
  defaultVal?: string
  desc: string
  required?: boolean
}

// ─── PropTable ─────────────────────────────────────────────────────────────────
/** Bảng mô tả props của component – dùng trong Sandbox library tabs */
export function PropTable({ rows }: { rows: PropRowData[] }) {
  return (
    <div className="rounded-md border overflow-hidden text-xs">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32">Prop</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40">Type</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">Default</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mô tả</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.prop} className={i % 2 === 0 ? "" : "bg-muted/20"}>
              <td className="px-3 py-2 font-mono text-primary font-medium">
                {r.prop}{r.required && <span className="text-destructive ml-0.5">*</span>}
              </td>
              <td className="px-3 py-2 font-mono text-violet-600 dark:text-violet-400">{r.type}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.defaultVal ?? "—"}</td>
              <td className="px-3 py-2 text-foreground/80">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── CodeBlock ─────────────────────────────────────────────────────────────────
/** Hiển thị code snippet dạng pre/code với nền muted */
export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-md bg-muted/60 border px-4 py-3 text-[11px] leading-relaxed font-mono overflow-x-auto text-foreground/90 whitespace-pre-wrap">
      {children}
    </pre>
  )
}

// ─── ComponentName ─────────────────────────────────────────────────────────────
/** Label tiêu đề tên component với đường dẫn import */
export function ComponentName({ name, path }: { name: string; path: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <h2 className="text-base font-semibold">{name}</h2>
      <span className="text-[11px] font-mono text-muted-foreground">{path}</span>
    </div>
  )
}
