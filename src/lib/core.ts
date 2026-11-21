import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useState } from 'react'
import type { Layout } from '../types'

export const APP_NAME = 'Roleplaying'
export const APP_TAGLINE = '현직자가 겪은 날카로운 질문으로, 면접자와 면접관을 오가며 연습하는 메타버스 모의면접'

/** 정책 상수 (기획서·IA 주석 기준) */
export const CFG = {
  signupTickets: 1, // 가입 시 지급하는 면접권 (프로토타입 가정: 첫 면접을 해볼 수 있게)
  slotTimes: ['12:00', '19:00', '20:00', '21:00', '22:00'],
  roomsPerSlot: 3, // 시간대마다 방 3개 (검토 중인 안)
  openHour: 8, // 매일 오전 8시에 그날 방이 열려요
  lockBeforeMin: 60, // 면접 1시간 전부터 예약 취소·변경 불가
  waitingOpenMin: 15, // 대기실은 시작 15분 전에 열려요
  noShowLimit: 2, // 경고 2회면 이용 제한
  restrictDays: 7,
  requestPerWeek: 2, // 개설 요청은 1주일에 2회까지
  feedbackMin: 5, // 피드백은 5분 안에
  sitSec: 60, // 면접자가 1분 안에 앉지 않으면 자동 착석
  commentMax: 100,
}

export const MIN = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`

/** 프로토타입용 간단 해시 (실서비스에서는 서버에서 처리) */
export function hashPw(s: string): string {
  let h1 = 0xdeadbeef ^ 7, h2 = 0x41c6ce57 ^ 7
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export const layoutCap = (l: Layout) => {
  const [a, b] = l.split(':').map(Number)
  return { ee: a, er: b }
}

/* ---------------- 시계 + 데모 설정 ---------------- */
export type RematchMode = 'success' | 'fail' | 'random'
interface Settings {
  offset: number // 데모용 시간 이동(ms)
  partMin: number // 면접 한 부 길이(분). 정식은 10
  countdownSec: number
  rematch: RematchMode
  showIA: boolean // IA 라벨(F-코드) 보기
  setOffset: (n: number) => void
  patch: (p: Partial<Settings>) => void
}
export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      offset: 0,
      partMin: 2,
      countdownSec: 5,
      rematch: 'success',
      showIA: false,
      setOffset: (n) => set({ offset: n }),
      patch: (p) => set(p),
    }),
    { name: 'pm-settings' },
  ),
)
export const now = () => Date.now() + useSettings.getState().offset

export function useNow(ms = 1000) {
  const offset = useSettings((s) => s.offset)
  const [t, setT] = useState(() => Date.now() + offset)
  useEffect(() => {
    setT(Date.now() + offset)
    const id = setInterval(() => setT(Date.now() + useSettings.getState().offset), ms)
    return () => clearInterval(id)
  }, [ms, offset])
  return t
}

/* ---------------- 시간 포맷 ---------------- */
const pad = (n: number) => String(n).padStart(2, '0')
export const hhmm = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` }
const WD = ['일', '월', '화', '수', '목', '금', '토']
export const fmtDate = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})` }
export const fmtDT = (t: number) => `${fmtDate(t)} ${hhmm(t)}`
export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
export function fmtCount(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`
}
export function fmtRel(ms: number) {
  const m = Math.round(ms / MIN)
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}시간 ${r}분` : `${h}시간`
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
export const sample = <T,>(arr: T[], seed?: number): T => arr[Math.floor((seed !== undefined ? mulberry(seed)() : Math.random()) * arr.length)]
export function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const seedOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h >>> 0 }
export function shuffle<T>(arr: T[], seed: number): T[] {
  const r = mulberry(seed), a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/* ---------------- 면접방 이름 ---------------- */
const CO = ['카카오', '네이버', '토스', '쿠팡', '당근', '배민', '라인', '삼성전자', '현대자동차', 'CJ']
const KIND = ['공통 질문 면접', '직무 심층 면접', '경험 압박 면접', '실무진 면접', '임원 면접']
const FREE = ['자유 인성 면접', '편하게 인성 면접', '자소서 기반 면접']
export function roomName(r: { id: string; startAt: number; title?: string }): string {
  if (r.title) return r.title
  const h = new Date(r.startAt).getHours()
  const rnd = mulberry(seedOf(r.id))
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
  if (rnd() < 0.34) return `${pick(FREE)} · ${h}시`
  return `${pick(CO)} ${h}시 ${pick(KIND)}`
}
