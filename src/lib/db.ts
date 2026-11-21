import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AvatarId, Feedback, InterviewRecord, Layout, Notice, OpenRequest, Reservation, Resume, Role, Room, User, CustomQuestion,
} from '../types'
import { CFG, DAY, HOUR, MIN, dayKey, fmtDT, hashPw, hhmm, layoutCap, now, startOfDay, uid, useSettings } from './core'
import { BADGE_DEFS } from '../data/questions'

const AVATARS: AvatarId[] = ['boy', 'girl', 'man']

/* ---------------- 시드: 다른 참가자(봇) ---------------- */
interface BotSeed { id: string; nickname: string; avatar: AvatarId; resume: Resume | null }
const BOTS: BotSeed[] = [
  { id: 'bot-toast', nickname: '새벽의토스트', avatar: 'girl', resume: { job: '기획·PM', intro: '문제를 정의하는 일에 흥미가 많은 신입 PM 지망생입니다.', career: '교내 창업 동아리에서 서비스 기획과 사용자 인터뷰 20건을 진행했어요.' } },
  { id: 'bot-owl', nickname: '야근하는부엉이', avatar: 'man', resume: { job: '개발', intro: '작은 기능도 끝까지 책임지고 배포하는 개발자입니다.', career: '팀 프로젝트에서 React로 예약 서비스를 만들고 운영했어요.' } },
  { id: 'bot-mango', nickname: '망고푸딩', avatar: 'girl', resume: null },
  { id: 'bot-coffee', nickname: '아아한잔', avatar: 'boy', resume: { job: '마케팅', intro: '데이터로 설득하는 마케터가 되고 싶어요.', career: '인스타 계정을 6개월간 운영하며 팔로워를 4배로 키웠어요.' } },
  { id: 'bot-pine', nickname: '솔방울', avatar: 'man', resume: { job: '디자인', intro: '사용성이 좋은 화면을 만들고 싶은 디자이너입니다.', career: '앱 리디자인 프로젝트 3건, 사용성 테스트 경험이 있어요.' } },
  { id: 'bot-cloud', nickname: '구름빵', avatar: 'boy', resume: null },
  { id: 'bot-moon', nickname: '달토끼', avatar: 'girl', resume: { job: '데이터', intro: '숫자 뒤의 이야기를 찾는 분석가를 꿈꿔요.', career: '공모전에서 SQL과 Python으로 고객 이탈 분석을 했어요.' } },
  { id: 'bot-sun', nickname: '해바라기씨', avatar: 'man', resume: { job: '영업·CS', intro: '사람 이야기를 끝까지 듣는 걸 잘해요.', career: '카페와 콜센터에서 2년간 고객 응대를 했어요.' } },
]
const botUser = (b: BotSeed): User => ({
  id: b.id, bot: true, email: `${b.id}@bot.local`, pw: '', nickname: b.nickname, avatar: b.avatar, resume: b.resume,
  tickets: 3, warnings: 0, restrictedUntil: null, level: 1 + (b.nickname.length % 3), likes: b.nickname.length, badges: [], createdAt: 0,
})

export const roomIdFor = (t: number, i: number) => `room-${dayKey(t)}-${hhmm(t).replace(':', '')}-${i}`

/* ---------------- 스토어 ---------------- */
interface DB {
  users: Record<string, User>
  rooms: Record<string, Room>
  reservations: Record<string, Reservation>
  requests: OpenRequest[]
  notices: Notice[]
  records: InterviewRecord[]
  feedbacks: Feedback[]
  sent: Record<string, true> // 알림/지급 중복 방지
  seededDays: Record<string, true>

  register: (email: string, pw: string, nickname: string) => { ok: boolean; msg?: string; id?: string }
  login: (email: string, pw: string) => { ok: boolean; msg?: string; id?: string }
  patchUser: (id: string, p: Partial<User>) => void
  changePw: (id: string, oldPw: string, newPw: string) => { ok: boolean; msg?: string }
  ensureRooms: () => void
  addRoom: (p: { startAt: number; layout: Layout; job: string; createdBy: Room['createdBy']; note?: string }) => Room
  book: (userId: string, roomId: string, role: Role) => { ok: boolean; code?: string; msg?: string; id?: string }
  cancel: (resId: string, force?: boolean) => { ok: boolean; msg?: string }
  patchRes: (id: string, p: Partial<Reservation>) => void
  addBotTo: (roomId: string, role: Role) => void
  request: (userId: string, desiredAt: number, job: string) => { ok: boolean; msg?: string }
  openRequest: (id: string, layout: Layout) => void
  rejectRequest: (id: string) => void
  notify: (userId: string, text: string, link?: string, kind?: Notice['kind']) => void
  readAll: (userId: string) => void
  scan: (userId: string) => void
  setCustom: (roomId: string, ee: string, list: CustomQuestion[]) => void
  finishCustom: (roomId: string, er: string) => void
  saveRecord: (r: InterviewRecord) => void
  submitFeedback: (roomId: string, from: string, items: Omit<Feedback, 'id' | 'roomId' | 'from' | 'at'>[]) => void
  grantTicket: (userId: string, key: string) => boolean
  recompute: (userId: string) => void
  resetAll: () => void
}

const empty = () => ({ users: {}, rooms: {}, reservations: {}, requests: [], notices: [], records: [], feedbacks: [], sent: {}, seededDays: {} })

export const useDB = create<DB>()(
  persist(
    (set, get) => ({
      ...empty(),

      register: (email, pw, nickname) => {
        const { users } = get()
        const e = email.trim().toLowerCase(), n = nickname.trim()
        if (!/^\S+@\S+\.\S+$/.test(e)) return { ok: false, msg: '이메일 형식을 확인해 주세요.' }
        if (pw.length < 6) return { ok: false, msg: '비밀번호는 6자 이상으로 해주세요.' }
        if (n.length < 2 || n.length > 10) return { ok: false, msg: '닉네임은 2~10자로 정해 주세요. (가입 후 변경할 수 없어요)' }
        if (Object.values(users).some((u) => u.email === e)) return { ok: false, msg: '이미 가입된 이메일이에요.' }
        if (Object.values(users).some((u) => u.nickname === n)) return { ok: false, msg: '이미 사용 중인 닉네임이에요.' }
        const id = uid('u')
        const u: User = { id, email: e, pw: hashPw(pw), nickname: n, avatar: 'boy', resume: null, tickets: CFG.signupTickets, warnings: 0, restrictedUntil: null, level: 1, likes: 0, badges: [], createdAt: now() }
        set({ users: { ...users, [id]: u } })
        get().notify(id, `가입을 환영해요! 면접권 ${CFG.signupTickets}장을 드렸어요.`, '/lobby', 'ok')
        return { ok: true, id }
      },
      login: (email, pw) => {
        const u = Object.values(get().users).find((x) => !x.bot && x.email === email.trim().toLowerCase())
        if (!u || u.pw !== hashPw(pw)) return { ok: false, msg: '이메일 또는 비밀번호가 맞지 않아요.' }
        return { ok: true, id: u.id }
      },
      patchUser: (id, p) => set((s) => (s.users[id] ? { users: { ...s.users, [id]: { ...s.users[id], ...p } } } : s)),
      changePw: (id, oldPw, newPw) => {
        const u = get().users[id]
        if (!u || u.pw !== hashPw(oldPw)) return { ok: false, msg: '현재 비밀번호가 맞지 않아요.' }
        if (newPw.length < 6) return { ok: false, msg: '새 비밀번호는 6자 이상이어야 해요.' }
        get().patchUser(id, { pw: hashPw(newPw) })
        return { ok: true }
      },

      /* 방: 매일 오전 8시에 그날 방이 열려요 (프로토타입은 접속 시점에 보장) */
      ensureRooms: () => {
        const s = get()
        const t = now()
        const dk = dayKey(t)
        const users = { ...s.users }
        let changed = false
        for (const b of BOTS) if (!users[b.id]) { users[b.id] = botUser(b); changed = true }
        const rooms = { ...s.rooms }, reservations = { ...s.reservations }
        const day0 = startOfDay(t)
        if (!s.seededDays[dk]) {
          const layouts: Layout[] = ['2:2', '1:1', '2:1', '1:2']
          CFG.slotTimes.forEach((tm, si) => {
            const [h, m] = tm.split(':').map(Number)
            const at = day0 + h * HOUR + m * MIN
            for (let i = 0; i < CFG.roomsPerSlot; i++) {
              const id = roomIdFor(at, i)
              if (rooms[id]) continue
              const layout = layouts[(si + i) % layouts.length]
              rooms[id] = { id, startAt: at, layout, job: i === 0 ? '전체' : ['개발', '디자인', '기획·PM', '마케팅'][(si + i) % 4], createdBy: 'system', custom: {}, customDone: {} }
              // 일부 방은 다른 참가자가 먼저 예약해 둔 상태로 시작
              const pattern = (si + i) % 3
              const cap = layoutCap(layout)
              const add = (role: Role, n: number, offset: number) => {
                for (let k = 0; k < n; k++) {
                  const bot = BOTS[(si * 3 + i + offset + k) % BOTS.length]
                  const rid = uid('r')
                  reservations[rid] = { id: rid, roomId: id, userId: bot.id, role, status: 'booked', record: false, attended: false, createdAt: now(), ticketHeld: false, skin: role === 'interviewer' ? AVATARS[(si + i + k + 1) % 3] : undefined }
                }
              }
              if (pattern === 0) { add('interviewee', Math.min(1, cap.ee), 0); add('interviewer', Math.min(1, cap.er), 3) }
              if (pattern === 1) { add('interviewer', cap.er, 1) }
              if (pattern === 2) { add('interviewee', cap.ee > 1 ? cap.ee - 1 : cap.ee, 2) }
            }
          })
          changed = true
        }
        // 예약 가능한 방이 너무 적으면 관리자가 곧 시작하는 시간대를 더 열어요 (데모 편의)
        const bookable = Object.values(rooms).filter((r) => !r.cancelled && r.startAt - CFG.lockBeforeMin * MIN > t && dayKey(r.startAt) === dk)
        if (bookable.length < 4) {
          const base = Math.ceil((t + CFG.lockBeforeMin * MIN + 5 * MIN) / (10 * MIN)) * 10 * MIN
          ;(['2:2', '1:1', '2:1', '1:2'] as Layout[]).forEach((layout, i) => {
            const at = base + i * 30 * MIN
            if (dayKey(at) !== dk) return
            const id = `room-extra-${at}`
            if (rooms[id]) return
            rooms[id] = { id, startAt: at, layout, job: '전체', createdBy: 'admin', custom: {}, customDone: {} }
            if (i === 0) {
              const rid = uid('r')
              reservations[rid] = { id: rid, roomId: id, userId: BOTS[1].id, role: 'interviewer', status: 'booked', record: false, attended: false, createdAt: now(), ticketHeld: false, skin: 'man' }
            }
            changed = true
          })
        }
        if (changed) set({ users, rooms, reservations, seededDays: { ...s.seededDays, [dk]: true } })
      },
      addRoom: ({ startAt, layout, job, createdBy, note }) => {
        const id = `room-x-${startAt}-${Math.random().toString(36).slice(2, 6)}`
        const room: Room = { id, startAt, layout, job, createdBy, note, custom: {}, customDone: {} }
        set((s) => ({ rooms: { ...s.rooms, [id]: room } }))
        return room
      },

      book: (userId, roomId, role) => {
        const s = get(), u = s.users[userId], room = s.rooms[roomId]
        if (!u || !room || room.cancelled) return { ok: false, code: 'gone', msg: '방 정보를 찾을 수 없어요.' }
        const t = now()
        if (u.restrictedUntil && u.restrictedUntil > t) return { ok: false, code: 'restricted', msg: `노쇼 경고가 쌓여 ${fmtDT(u.restrictedUntil)}까지 예약할 수 없어요.` }
        if (room.startAt - CFG.lockBeforeMin * MIN <= t) return { ok: false, code: 'time', msg: '시작 1시간 전부터는 새로 예약할 수 없어요.' }
        const mine = Object.values(s.reservations).filter((r) => r.userId === userId && r.status === 'booked')
        if (mine.some((r) => r.roomId === roomId)) return { ok: false, code: 'dup', msg: '이미 이 방을 예약했어요.' }
        if (mine.some((r) => s.rooms[r.roomId]?.startAt === room.startAt)) return { ok: false, code: 'dup', msg: '같은 시간대에 이미 예약한 면접이 있어요.' }
        const cap = layoutCap(room.layout)
        const taken = Object.values(s.reservations).filter((r) => r.roomId === roomId && r.status === 'booked')
        const have = taken.filter((r) => r.role === role).length
        if (have >= (role === 'interviewee' ? cap.ee : cap.er)) return { ok: false, code: 'full', msg: '이 역할은 자리가 다 찼어요.' }
        if (role === 'interviewee' && u.tickets < 1) return { ok: false, code: 'no_ticket', msg: '면접권이 없어요.' }
        const id = uid('r')
        const r: Reservation = {
          id, roomId, userId, role, status: 'booked', record: false, attended: false, createdAt: t, ticketHeld: role === 'interviewee',
          skin: role === 'interviewer' ? AVATARS[Math.floor(Math.random() * 3)] : undefined,
        }
        set({
          reservations: { ...s.reservations, [id]: r },
          users: role === 'interviewee' ? { ...s.users, [userId]: { ...u, tickets: u.tickets - 1 } } : s.users,
        })
        get().notify(userId, `${fmtDT(room.startAt)} ${role === 'interviewee' ? '면접자로' : '면접관으로'} 예약했어요.`, '/records?tab=calendar', 'ok')
        return { ok: true, id }
      },
      cancel: (resId, force) => {
        const s = get(), r = s.reservations[resId]
        if (!r || r.status !== 'booked') return { ok: false, msg: '취소할 수 없는 예약이에요.' }
        const room = s.rooms[r.roomId]
        if (!force && room && room.startAt - CFG.lockBeforeMin * MIN <= now()) return { ok: false, msg: '면접 1시간 전부터는 예약 취소·변경이 안 돼요.' }
        const u = s.users[r.userId]
        set({
          reservations: { ...s.reservations, [resId]: { ...r, status: 'cancelled' } },
          users: r.ticketHeld && u ? { ...s.users, [u.id]: { ...u, tickets: u.tickets + 1 } } : s.users,
        })
        return { ok: true }
      },
      patchRes: (id, p) => set((s) => (s.reservations[id] ? { reservations: { ...s.reservations, [id]: { ...s.reservations[id], ...p } } } : s)),
      addBotTo: (roomId, role) => {
        const s = get()
        const used = new Set(Object.values(s.reservations).filter((r) => r.roomId === roomId && r.status === 'booked').map((r) => r.userId))
        const bot = BOTS.find((b) => !used.has(b.id)) ?? BOTS[0]
        const rid = uid('r')
        set({ reservations: { ...s.reservations, [rid]: { id: rid, roomId, userId: bot.id, role, status: 'booked', record: false, attended: true, createdAt: now(), ticketHeld: false, skin: role === 'interviewer' ? AVATARS[Math.floor(Math.random() * 3)] : undefined } } })
      },

      request: (userId, desiredAt, job) => {
        const s = get(), t = now()
        const recent = s.requests.filter((q) => q.userId === userId && q.createdAt > t - 7 * DAY)
        if (recent.length >= CFG.requestPerWeek) return { ok: false, msg: `개설 요청은 1주일에 ${CFG.requestPerWeek}회까지 할 수 있어요.` }
        const q: OpenRequest = { id: uid('q'), userId, desiredAt, job, status: 'pending', createdAt: t }
        set({ requests: [q, ...s.requests] })
        return { ok: true }
      },
      openRequest: (id, layout) => {
        const s = get(), q = s.requests.find((x) => x.id === id)
        if (!q || q.status !== 'pending') return
        const room = get().addRoom({ startAt: q.desiredAt, layout, job: q.job, createdBy: 'request', note: '개설 요청으로 열린 방' })
        set((st) => ({ requests: st.requests.map((x) => (x.id === id ? { ...x, status: 'opened', roomId: room.id } : x)) }))
        get().notify(q.userId, `요청하신 ${fmtDT(q.desiredAt)} 면접방이 열렸어요. 지금 예약해 보세요!`, `/reserve?room=${room.id}`, 'ok')
      },
      rejectRequest: (id) => set((s) => ({ requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)) })),

      notify: (userId, text, link, kind = 'info') =>
        set((s) => ({ notices: [{ id: uid('n'), userId, text, at: now(), read: false, link, kind }, ...s.notices].slice(0, 120) })),
      readAll: (userId) => set((s) => ({ notices: s.notices.map((n) => (n.userId === userId ? { ...n, read: true } : n)) })),

      /* 면접 1시간 전 / 대기실 오픈 알림, 노쇼 처리 */
      scan: (userId) => {
        const s = get(), t = now()
        const sent = { ...s.sent }
        let sentChanged = false
        for (const r of Object.values(s.reservations)) {
          if (r.userId !== userId || r.status !== 'booked') continue
          const room = s.rooms[r.roomId]
          if (!room) continue
          const k60 = `${r.id}:t60`, k15 = `${r.id}:t15`, kns = `${r.id}:ns`
          if (t >= room.startAt - 60 * MIN && t < room.startAt && !sent[k60]) {
            sent[k60] = true; sentChanged = true
            get().notify(userId, r.role === 'interviewer'
              ? '면접 1시간 전이에요. 예약 취소·변경은 이제 안 돼요. 자소서를 열람하고 커스텀 질문을 써볼까요?'
              : '면접 1시간 전이에요. 예약 취소·변경은 이제 안 돼요. 곧 대기실이 열려요.', `/waiting/${r.id}`, 'warn')
          }
          if (t >= room.startAt - CFG.waitingOpenMin * MIN && t < room.startAt + 5 * MIN && !sent[k15]) {
            sent[k15] = true; sentChanged = true
            get().notify(userId, '대기실이 열렸어요! 들어오면 중간에 나갈 수 없어요.', `/waiting/${r.id}`, 'ok')
          }
          if (t > room.startAt + 6 * MIN && !r.attended && !sent[kns]) {
            sent[kns] = true; sentChanged = true
            const u = get().users[userId]
            if (u) {
              const w = u.warnings + 1
              get().patchUser(userId, { warnings: w, restrictedUntil: w >= CFG.noShowLimit ? t + CFG.restrictDays * DAY : u.restrictedUntil })
              get().patchRes(r.id, { status: 'noshow' })
              get().notify(userId, w >= CFG.noShowLimit ? `노쇼 경고 ${w}회로 ${CFG.restrictDays}일간 예약이 제한돼요.` : `노쇼 경고 ${w}회가 쌓였어요. ${CFG.noShowLimit}회가 되면 이용이 제한돼요.`, '/me', 'warn')
            }
          }
        }
        if (sentChanged) set({ sent })
      },

      setCustom: (roomId, ee, list) => set((s) => (s.rooms[roomId] ? { rooms: { ...s.rooms, [roomId]: { ...s.rooms[roomId], custom: { ...s.rooms[roomId].custom, [ee]: list } } } } : s)),
      finishCustom: (roomId, er) => set((s) => (s.rooms[roomId] ? { rooms: { ...s.rooms, [roomId]: { ...s.rooms[roomId], customDone: { ...s.rooms[roomId].customDone, [er]: true } } } } : s)),

      saveRecord: (r) => set((s) => (s.records.some((x) => x.roomId === r.roomId && x.userId === r.userId) ? s : { records: [r, ...s.records] })),
      submitFeedback: (roomId, from, items) =>
        set((s) => {
          const rest = s.feedbacks.filter((f) => !(f.roomId === roomId && f.from === from && items.some((i) => i.to === f.to && i.kind === f.kind)))
          const add = items.map((i) => ({ ...i, id: uid('f'), roomId, from, at: now() }))
          return { feedbacks: [...add, ...rest] }
        }),
      grantTicket: (userId, key) => {
        const s = get()
        if (s.sent[key]) return false
        const u = s.users[userId]
        if (!u) return false
        set({ sent: { ...s.sent, [key]: true }, users: { ...s.users, [userId]: { ...u, tickets: u.tickets + 1 } } })
        return true
      },
      recompute: (userId) => {
        const s = get(), u = s.users[userId]
        if (!u) return
        const recs = s.records.filter((r) => r.userId === userId)
        const ee = recs.filter((r) => r.role === 'interviewee').length, er = recs.filter((r) => r.role === 'interviewer').length
        const likes = s.feedbacks.filter((f) => f.to === userId && f.kind === 'like' && f.like).length
        const kws = s.feedbacks.filter((f) => f.to === userId && f.kind === 'keywords').flatMap((f) => f.keywords ?? [])
        const ids = new Set<string>()
        if (ee >= 1) ids.add('first')
        if (er >= 1) ids.add('judge')
        if (ee >= 1 && er >= 1) ids.add('both')
        if (likes >= 3) ids.add('liked')
        if (kws.includes('초고속 답변러')) ids.add('fast')
        if (kws.includes('얼리 어답터')) ids.add('early')
        if (ee + er >= 3) ids.add('steady')
        const badges = BADGE_DEFS.filter((b) => ids.has(b.id)).map((b) => b.id)
        const level = 1 + Math.floor((ee + er + likes) / 3)
        const prev = u.badges
        get().patchUser(userId, { likes, badges, level })
        for (const b of badges) if (!prev.includes(b)) get().notify(userId, `새 뱃지를 받았어요: ${BADGE_DEFS.find((d) => d.id === b)?.name}`, '/me', 'ok')
      },
      resetAll: () => set({ ...empty() }),
    }),
    { name: 'pm-db', version: 1 },
  ),
)

/* 다른 탭과 동기화 (같은 브라우저의 탭 2개로 사람 대 사람 면접을 시험해 볼 수 있어요) */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'pm-db') void useDB.persist.rehydrate()
    if (e.key === 'pm-settings') void useSettings.persist.rehydrate()
  })
}

/* ---------------- 현재 사용자 (탭마다 따로) ---------------- */
interface Auth { uid: string | null; guest: boolean; signIn: (id: string) => void; signOut: () => void; browse: () => void }
const SS = { get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }, set: (k: string, v: string | null) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v) } catch { /* ignore */ } } }
export const useAuth = create<Auth>((set) => ({
  uid: SS.get('pm-uid'),
  guest: SS.get('pm-guest') === '1',
  signIn: (id) => { SS.set('pm-uid', id); SS.set('pm-guest', null); set({ uid: id, guest: false }) },
  signOut: () => { SS.set('pm-uid', null); SS.set('pm-guest', null); set({ uid: null, guest: false }) },
  browse: () => { SS.set('pm-guest', '1'); set({ guest: true }) },
}))
export function useMe() {
  const id = useAuth((s) => s.uid)
  return useDB((s) => (id ? s.users[id] : undefined))
}

/* ---------------- 조회 헬퍼 ---------------- */
export function roomSeats(db: Pick<DB, 'reservations' | 'rooms'>, roomId: string) {
  const room = db.rooms[roomId]
  const cap = layoutCap(room.layout)
  const list = Object.values(db.reservations).filter((r) => r.roomId === roomId && r.status === 'booked')
  const ee = list.filter((r) => r.role === 'interviewee'), er = list.filter((r) => r.role === 'interviewer')
  return { cap, ee, er, full: ee.length >= cap.ee && er.length >= cap.er, eeLeft: cap.ee - ee.length, erLeft: cap.er - er.length }
}
