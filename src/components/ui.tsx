import { create } from 'zustand'
import { A } from '../lib/asset'
import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { cx, useSettings } from '../lib/core'
import type { AvatarId } from '../types'

/* ---------------- 버튼 ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { v?: 'primary' | 'leaf' | 'ghost' | 'soft' | 'dark' | 'danger'; size?: 'sm' | 'md' | 'lg'; full?: boolean }
export function Btn({ v = 'primary', size = 'md', full, className, ...p }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition active:scale-[.97] disabled:opacity-45 disabled:pointer-events-none select-none whitespace-nowrap'
  const sz = { sm: 'h-9 px-3.5 text-[13px]', md: 'h-11 px-5 text-[15px]', lg: 'h-14 px-7 text-[17px]' }[size]
  const cl = {
    primary: 'bg-brand text-white shadow-glow hover:bg-brand-d',
    leaf: 'bg-leaf text-white hover:bg-leaf-d',
    dark: 'bg-espresso text-white hover:bg-black',
    ghost: 'bg-transparent text-ink2 hover:bg-sand',
    soft: 'bg-white text-ink border border-line hover:bg-sand',
    danger: 'bg-danger text-white hover:opacity-90',
  }[v]
  return <button {...p} className={cx(base, sz, cl, full && 'w-full', className)} />
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return <div onClick={onClick} className={cx('bg-paper border border-white/80 ring-1 ring-black/[.03] rounded-[28px] shadow-soft', className)}>{children}</div>
}

export function Chip({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'brand' | 'leaf' | 'sky' | 'warn' | 'danger' | 'dark'; children: ReactNode; className?: string }) {
  const t = {
    neutral: 'bg-sand text-ink2', brand: 'bg-brand-l text-brand-d', leaf: 'bg-leaf-l text-leaf-d', sky: 'bg-sky-l text-sky',
    warn: 'bg-warn-l text-warn', danger: 'bg-danger-l text-danger', dark: 'bg-espresso text-white',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none', t, className)}>{children}</span>
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-ink2 mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-[12px] text-ink3 mt-1.5">{hint}</span>}
      {error && <span role="alert" className="block text-[12px] text-danger mt-1.5">{error}</span>}
    </label>
  )
}
export const inputCls = 'w-full h-12 rounded-full border border-line bg-white px-5 text-[15px] placeholder:text-ink3 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none'
export const areaCls = 'w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] placeholder:text-ink3 focus:border-brand outline-none resize-none'

/* ---------------- IA 라벨 ---------------- */
export function F({ code, className }: { code: string; className?: string }) {
  const on = useSettings((s) => s.showIA)
  if (!on) return null
  return <span className={cx('fcode', className)}>{code}</span>
}

/* ---------------- 아바타 ---------------- */
export function AvatarImg({ id, view = 'front', size = 56, className, bg, circle }: { id: AvatarId; view?: 'front' | 'back' | 'left' | 'right'; size?: number; className?: string; bg?: string; circle?: boolean }) {
  return (
    <span className={cx('inline-flex items-end justify-center overflow-hidden shrink-0', className)} style={{ width: size, height: size, background: bg, borderRadius: circle ? size : size / 4 }}>
      <img src={A(`sprites/${id}_${view}.png`)} alt="" draggable={false} style={{ height: size * 0.94, width: 'auto', objectFit: 'contain' }} />
    </span>
  )
}
export const AVATAR_NAME: Record<AvatarId, string> = { boy: '단정한 신입', girl: '묶음머리 지원자', man: '콧수염 선배' }

/* ---------------- 토스트 ---------------- */
interface ToastT { id: number; text: string; kind: 'info' | 'ok' | 'warn' }
export const useToasts = create<{ list: ToastT[]; push: (text: string, kind?: ToastT['kind']) => void; drop: (id: number) => void }>((set) => ({
  list: [],
  push: (text, kind = 'info') => {
    const id = Math.random()
    set((s) => ({ list: [...s.list, { id, text, kind }].slice(-4) }))
    setTimeout(() => set((s) => ({ list: s.list.filter((t) => t.id !== id) })), 4200)
  },
  drop: (id) => set((s) => ({ list: s.list.filter((t) => t.id !== id) })),
}))
export const toast = (text: string, kind: ToastT['kind'] = 'info') => useToasts.getState().push(text, kind)
export function Toasts() {
  const list = useToasts((s) => s.list)
  return (
    <div aria-live="polite" className="fixed z-[100] left-0 right-0 top-3 flex flex-col items-center gap-2 pointer-events-none px-4">
      {list.map((t) => (
        <div key={t.id} className={cx('animate-pop pointer-events-auto max-w-[92vw] rounded-2xl px-4 py-3 text-[14px] font-semibold shadow-soft border',
          t.kind === 'ok' && 'bg-leaf-l text-leaf-d border-leaf/30', t.kind === 'warn' && 'bg-warn-l text-warn border-warn/30', t.kind === 'info' && 'bg-paper text-ink border-line')}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

/* ---------------- 모달 / 바텀시트 ---------------- */
export function Modal({ open, onClose, title, children, footer, dismissible = true, wide }: {
  open: boolean; onClose?: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; dismissible?: boolean; wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && dismissible) onClose?.() }
    window.addEventListener('keydown', k)
    return () => { window.removeEventListener('keydown', k); prev?.focus?.() }
  }, [open, dismissible, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-espresso/40 backdrop-blur-sm" onClick={() => dismissible && onClose?.()} />
      <div ref={ref} tabIndex={-1} className={cx('relative bg-paper w-full sm:rounded-[32px] rounded-t-[32px] shadow-soft animate-rise outline-none max-h-[88dvh] flex flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" />
        {title && <div className="px-6 pt-5 pb-1 text-[19px] font-bold leading-snug">{title}</div>}
        <div className="px-6 py-4 overflow-y-auto text-[15px] text-ink2 leading-relaxed">{children}</div>
        {footer && <div className="px-6 pb-6 pt-1 flex gap-2 justify-end flex-wrap safe-b">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------- 아이콘 ---------------- */
const I = (d: ReactNode, s = 22) => (p: { className?: string; size?: number }) => (
  <svg width={p.size ?? s} height={p.size ?? s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>{d}</svg>
)
export const Ico = {
  home: I(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>),
  doc: I(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  user: I(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-5 5-7 8-7s7 2 8 7" /></>),
  bell: I(<><path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4z" /><path d="M10 21h4" /></>),
  mic: I(<><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  micOff: I(<><path d="M3 3l18 18" /><path d="M9 9v2a3 3 0 0 0 5 2M15 9V6a3 3 0 0 0-6-.5" /><path d="M5 11a7 7 0 0 0 11 5.6M19 11a7 7 0 0 1-.6 2.8M12 18v3" /></>),
  clock: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  check: I(<path d="M5 12l5 5 9-10" />),
  x: I(<path d="M6 6l12 12M18 6L6 18" />),
  arrow: I(<path d="M5 12h14M13 6l6 6-6 6" />),
  back: I(<path d="M19 12H5M11 6l-6 6 6 6" />),
  ticket: I(<><path d="M3 8a2 2 0 0 0 0 8v2h18v-2a2 2 0 0 1 0-8V6H3z" /><path d="M14 6v12" strokeDasharray="2 3" /></>),
  thumb: I(<><path d="M7 11v9H3v-9z" /><path d="M7 11l4-8c2 0 3 1 3 3v3h5a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2H7" /></>),
  lock: I(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  cal: I(<><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>),
  help: I(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></>),
  play: I(<path d="M7 4l13 8-13 8z" fill="currentColor" />),
  star: I(<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z" />),
  gear: I(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>),
  box: I(<><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></>),
}

export function Empty({ emoji = '🪑', title, desc, action }: { emoji?: string; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="text-5xl mb-3" aria-hidden>{emoji}</div>
      <div className="text-[17px] font-bold">{title}</div>
      {desc && <p className="text-ink2 text-[14px] mt-1.5 leading-relaxed">{desc}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function Meter({ level, className }: { level: number; className?: string }) {
  const bars = 14
  return (
    <div className={cx('flex items-end gap-[3px] h-8', className)} role="meter" aria-valuenow={Math.round(level * 100)} aria-label="마이크 입력 크기">
      {Array.from({ length: bars }).map((_, i) => {
        const on = level * bars > i
        return <span key={i} className={cx('w-[7px] rounded-full transition-all', on ? (i > 10 ? 'bg-danger' : i > 6 ? 'bg-warn' : 'bg-leaf') : 'bg-line')} style={{ height: 8 + i * 1.7 }} />
      })}
    </div>
  )
}
