import { useSyncExternalStore } from 'react'
import type { Role } from '../types'
import { now, uid } from './core'

/**
 * 면접방 실시간 상태 버스.
 * 같은 브라우저의 탭끼리 BroadcastChannel + localStorage로 이벤트를 주고받아요.
 * (다른 기기와 연결하려면 이 인터페이스 뒤에 WebRTC/서버 전송을 붙이면 돼요.)
 */
export interface Ev { id: string; t: number; by: string; type: string; d?: any }

class Bus {
  events: Ev[] = []
  private subs = new Set<() => void>()
  private bc: BroadcastChannel | null = null
  private key: string
  roomId: string
  constructor(roomId: string) {
    this.roomId = roomId
    this.key = `pm-sess-${roomId}`
    try { this.events = JSON.parse(localStorage.getItem(this.key) || '[]') } catch { this.events = [] }
    try {
      this.bc = new BroadcastChannel(this.key)
      this.bc.onmessage = (m) => this.merge([m.data as Ev], false)
    } catch { /* ignore */ }
    window.addEventListener('storage', (e) => {
      if (e.key === this.key && e.newValue) { try { this.merge(JSON.parse(e.newValue) as Ev[], false) } catch { /* ignore */ } }
    })
  }
  private merge(evs: Ev[], persist: boolean) {
    const seen = new Set(this.events.map((e) => e.id))
    const add = evs.filter((e) => !seen.has(e.id))
    if (!add.length) return
    this.events = [...this.events, ...add].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1))
    if (persist) { try { localStorage.setItem(this.key, JSON.stringify(this.events.slice(-600))) } catch { /* ignore */ } }
    this.subs.forEach((f) => f())
  }
  emit(by: string, type: string, d?: any) {
    const ev: Ev = { id: uid('e'), t: now(), by, type, d }
    this.merge([ev], true)
    try { this.bc?.postMessage(ev) } catch { /* ignore */ }
    return ev
  }
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f) } }
  snapshot = () => this.events
  clear() { this.events = []; try { localStorage.removeItem(this.key) } catch { /* ignore */ } this.subs.forEach((f) => f()) }
}

const buses = new Map<string, Bus>()
export function getBus(roomId: string): Bus {
  let b = buses.get(roomId)
  if (!b) { b = new Bus(roomId); buses.set(roomId, b) }
  return b
}
export function useBusEvents(roomId: string): Ev[] {
  const b = getBus(roomId)
  return useSyncExternalStore(b.subscribe, b.snapshot)
}

/* ---------------- 파생 상태 ---------------- */
export interface Ask {
  id: string; t: number; by: string; to: string
  qid?: string; text: string; intent: string; direction: string
  kind: 'common' | 'custom' | 'free' | 'followup'; part: 1 | 2 | 3; tag?: string
}
export interface Live { at: number; partMs: number; hasCustom: boolean }
export interface Derived {
  hb: Record<string, { t: number; role: Role; where: string }>
  gate?: boolean
  recruitAt?: number
  rematch?: boolean
  cdAt?: number
  cdLen: number
  sat: Record<string, number>
  live?: Live
  asks: Ask[]
  answers: Record<string, string>
  speaking: Record<string, { on: boolean; t: number }>
  ended?: number
  entered?: number
}

export function derive(events: Ev[]): Derived {
  const d: Derived = { hb: {}, cdLen: 5, sat: {}, asks: [], answers: {}, speaking: {} }
  for (const e of events) {
    switch (e.type) {
      case 'hb': d.hb[e.by] = { t: e.t, role: e.d.role, where: e.d.where }; break
      case 'gate': d.gate = e.d.ok; break
      case 'recruit': d.recruitAt = e.t; break
      case 'rematch': d.rematch = e.d.ok; break
      case 'cd': d.cdAt = e.t; d.cdLen = e.d.len; break
      case 'enter': d.entered = e.t; break
      case 'sit': d.sat[e.by] = e.t; break
      case 'live': d.live = e.d; break
      case 'ask': d.asks.push({ ...e.d, t: e.t, by: e.by }); break
      case 'ans': d.answers[e.d.askId] = e.d.mode === 'set' ? e.d.text : joinText(d.answers[e.d.askId], e.d.text); break
      case 'spk': d.speaking[e.by] = { on: e.d.on, t: e.t }; break
      case 'end': d.ended = e.t; break
    }
  }
  return d
}
const joinText = (a: string | undefined, b: string) => (a ? (a.endsWith(' ') ? a + b : a + ' ' + b) : b).trim()

/** 면접 진행 부 계산: 커스텀 질문이 없으면 2부는 건너뛰고 1부를 두 배로 */
export function phaseAt(live: Live, t: number) {
  const P = live.partMs
  const durs = live.hasCustom ? [P, P, P] : [2 * P, 0, P]
  const el = t - live.at
  const total = durs.reduce((a, b) => a + b, 0)
  if (el >= total) return { part: 0 as const, remain: 0, partRemain: 0, elapsed: el, total, durs }
  let acc = 0
  for (let i = 0; i < 3; i++) {
    if (durs[i] === 0) continue
    if (el < acc + durs[i]) return { part: (i + 1) as 1 | 2 | 3, remain: total - el, partRemain: acc + durs[i] - el, elapsed: el, total, durs }
    acc += durs[i]
  }
  return { part: 0 as const, remain: 0, partRemain: 0, elapsed: el, total, durs }
}

export const PART_NAME = { 1: '1부 · 공통 질문', 2: '2부 · 커스텀 질문', 3: '3부 · 자유 질문' } as const
