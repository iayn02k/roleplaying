import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { A } from '../lib/asset'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { APP_NAME, CFG, MIN, cx, fmtCount, fmtDT, now, useNow, useSettings } from '../lib/core'
import { useAuth, useDB, useMe } from '../lib/db'
import { AvatarImg, Btn, Chip, Ico, Modal, toast } from './ui'

/* ---------------- 용어 안내 ---------------- */
export function GlossaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string][] = [
    ['면접권', '면접자로 참여할 때 1장씩 쓰는 이용권이에요. 면접관으로 참여해 피드백까지 마치면 1장을 받아요. (구매·광고로 받기는 MVP에서 제외)'],
    ['노쇼', '예약해 놓고 면접에 오지 않는 것이에요. 경고 2회면 서비스 이용이 제한돼요.'],
    ['타임테이블', '정해진 시간대에만 방이 열려요. 매일 오전 8시에 그날 방이 한 번에 열려요.'],
    ['신뢰도 레벨', '면접을 완주하고 좋아요를 받을수록 올라가요. 다른 사람에게도 공개돼요.'],
    ['GNB', '모든 화면 위쪽에 고정된 메뉴예요. 면접 중에는 숨겨요.'],
    ['MVP', '첫 출시 버전이에요. 꼭 필요한 기능만 담았어요.'],
  ]
  return (
    <Modal open={open} onClose={onClose} title="용어 안내" footer={<Btn onClick={onClose}>알겠어요</Btn>}>
      <dl className="space-y-3">
        {rows.map(([k, v]) => (
          <div key={k}><dt className="font-bold text-ink">{k}</dt><dd className="text-[14px]">{v}</dd></div>
        ))}
      </dl>
    </Modal>
  )
}

/* ---------------- 알림 벨 ---------------- */
function Bell() {
  const me = useMe()
  const notices = useDB((s) => s.notices)
  const readAll = useDB((s) => s.readAll)
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const mine = notices.filter((n) => n.userId === me?.id)
  const unread = mine.filter((n) => !n.read).length
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', f)
    return () => document.removeEventListener('mousedown', f)
  }, [open])
  if (!me) return null
  return (
    <div ref={ref} className="relative">
      <button aria-label={`알림 ${unread}개`} onClick={() => { setOpen(!open); if (!open && unread) setTimeout(() => readAll(me.id), 900) }} className="relative h-10 w-10 rounded-full grid place-items-center text-ink2 hover:bg-sand">
        <Ico.bell />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] font-bold grid place-items-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,360px)] max-h-[70dvh] overflow-y-auto rounded-[28px] bg-paper border border-line shadow-soft animate-pop p-2">
          <div className="px-3 py-2 text-[13px] font-bold text-ink2">알림</div>
          {mine.length === 0 && <div className="px-3 py-8 text-center text-[14px] text-ink3">아직 알림이 없어요.</div>}
          {mine.slice(0, 20).map((n) => (
            <button key={n.id} onClick={() => { setOpen(false); if (n.link) nav(n.link) }} className={cx('w-full text-left rounded-2xl px-3 py-2.5 hover:bg-sand flex gap-2.5', !n.read && 'bg-brand-l/40')}>
              <span className={cx('mt-1.5 h-2 w-2 rounded-full shrink-0', n.kind === 'warn' ? 'bg-warn' : n.kind === 'ok' ? 'bg-leaf' : 'bg-sky')} />
              <span className="min-w-0">
                <span className="block text-[14px] text-ink leading-snug">{n.text}</span>
                <span className="block text-[12px] text-ink3 mt-0.5">{fmtDT(n.at)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- 다음 면접 배너 ---------------- */
export function useNextRes() {
  const me = useMe()
  const res = useDB((s) => s.reservations)
  const rooms = useDB((s) => s.rooms)
  const t = useNow(1000)
  return useMemo(() => {
    if (!me) return null
    const list = Object.values(res).filter((r) => r.userId === me.id && r.status === 'booked' && rooms[r.roomId])
      .map((r) => ({ r, room: rooms[r.roomId] }))
      .filter((x) => x.room.startAt + 40 * MIN > t)
      .sort((a, b) => a.room.startAt - b.room.startAt)
    return list[0] ?? null
  }, [me, res, rooms, Math.floor(t / 1000)]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function NextBanner() {
  const n = useNextRes()
  const t = useNow(1000)
  const nav = useNavigate()
  if (!n) return null
  const left = n.room.startAt - t
  const open = left <= CFG.waitingOpenMin * MIN
  return (
    <div className={cx('w-full px-3 sm:px-6 lg:px-10 pt-3')}>
      <div className={cx('rounded-2xl border px-4 py-2.5 flex items-center gap-3 flex-wrap', open ? 'bg-leaf-l border-leaf/30' : 'bg-paper border-line')}>
        <Ico.clock className={open ? 'text-leaf-d' : 'text-ink2'} />
        <div className="text-[14px] min-w-0 flex-1">
          <b>{fmtDT(n.room.startAt)}</b> {n.r.role === 'interviewee' ? '면접자로' : '면접관으로'} 예약됨 ·{' '}
          {left > 0 ? <span className="tabular-nums">{fmtCount(left)} 남음</span> : <span className="text-leaf-d font-bold">지금 시작해요</span>}
          {!open && <span className="text-ink3"> · 대기실은 시작 {CFG.waitingOpenMin}분 전에 열려요</span>}
        </div>
        <Btn size="sm" v={open ? 'leaf' : 'soft'} onClick={() => nav(open ? `/waiting/${n.r.id}` : '/records?tab=calendar')}>{open ? '대기실 입장' : '예약 보기'}</Btn>
      </div>
    </div>
  )
}

/* ---------------- GNB ---------------- */
const NAV = [
  { to: '/lobby', label: '로비', icon: Ico.home, n: 1 },
  { to: '/records', label: '면접 기록', icon: Ico.doc, n: 2 },
  { to: '/me', label: '마이페이지', icon: Ico.user, n: 3 },
]
export function GNB() {
  const me = useMe()
  const nav = useNavigate()
  const guest = useAuth((s) => s.guest)
  const [help, setHelp] = useState(false)
  const loc = useLocation()
  return (
    <>
      <header className="sticky top-0 z-40 px-3 pt-3 pb-1">
        <div className="w-full h-14 pl-4 pr-2 rounded-full bg-white/90 backdrop-blur ring-1 ring-black/[.04] shadow-soft flex items-center gap-2">
          <Link to="/lobby" className="flex items-center gap-2 font-extrabold text-[18px] tracking-tight mr-2">
            <img src={A('favicon.svg')} alt="" className="h-8 w-8 shrink-0" />
            <span className="max-sm:hidden">{APP_NAME}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="주 메뉴">
            {NAV.map((i) => (
              <NavLink key={i.to} to={i.to} className={({ isActive }) => cx('h-10 px-4 rounded-full grid place-items-center text-[14px] font-semibold', isActive ? 'bg-espresso text-white' : 'text-ink2 hover:bg-sand')}>{i.label}</NavLink>
            ))}
          </nav>
          <div className="flex-1" />
          {me ? (
            <>
              <Chip tone="brand" className="max-sm:hidden"><Ico.ticket size={14} /> 면접권 {me.tickets}장</Chip>
              <Btn size="sm" v="primary" className="max-md:hidden" onClick={() => nav('/reserve')}>면접방 예약</Btn>
              <button aria-label="용어 안내" onClick={() => setHelp(true)} className="h-10 w-10 rounded-full grid place-items-center text-ink2 hover:bg-sand"><Ico.help /></button>
              <Bell />
              <Link to="/me" aria-label="마이페이지" className="rounded-full"><AvatarImg id={me.avatar} size={40} bg="#e3eaff" circle /></Link>
            </>
          ) : (
            <>
              {guest && <Chip tone="sky">둘러보는 중</Chip>}
              <button aria-label="용어 안내" onClick={() => setHelp(true)} className="h-10 w-10 rounded-full grid place-items-center text-ink2 hover:bg-sand"><Ico.help /></button>
              <Btn size="sm" v="ghost" onClick={() => nav('/auth?mode=login&next=' + encodeURIComponent(loc.pathname))}>로그인</Btn>
              <Btn size="sm" onClick={() => nav('/auth?mode=signup')}>시작하기</Btn>
            </>
          )}
        </div>
      </header>
      <GlossaryModal open={help} onClose={() => setHelp(false)} />
    </>
  )
}

export function BottomNav() {
  const nav = useNavigate()
  const me = useMe()
  return (
    <nav aria-label="주 메뉴" className="md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none safe-b px-3 pb-2">
      <div className="pointer-events-auto grid grid-cols-4 h-16 px-2 rounded-full bg-white/95 backdrop-blur ring-1 ring-black/[.05] shadow-soft">
        {NAV.slice(0, 1).map((i) => <TabLink key={i.to} to={i.to} label={i.label} Icon={i.icon} />)}
        <button onClick={() => nav(me ? '/reserve' : '/auth?mode=login&next=/reserve')} className="grid place-items-center -mt-5" aria-label="면접방 예약">
          <span className="h-14 w-14 rounded-full bg-brand text-white grid place-items-center shadow-glow border-4 border-cream"><Ico.cal size={24} /></span>
        </button>
        {NAV.slice(1).map((i) => <TabLink key={i.to} to={i.to} label={i.label.replace('마이페이지', 'MY')} Icon={i.icon} />)}
      </div>
    </nav>
  )
}
function TabLink({ to, label, Icon }: { to: string; label: string; Icon: (p: { className?: string }) => ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => cx('grid place-items-center content-center gap-0.5 text-[11px] font-bold', isActive ? 'text-brand' : 'text-ink3')}>
      <Icon /> {label}
    </NavLink>
  )
}

export function AppLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <GNB />
      <NextBanner />
      <main className={cx('flex-1 w-full px-3 sm:px-6 lg:px-10 py-5 pb-28 md:pb-10')}>{children}</main>
      <BottomNav />
    </div>
  )
}

/* ---------------- 데모 컨트롤 (프로토타입 전용) ---------------- */
export function DemoPanel() {
  const [open, setOpen] = useState(false)
  const s = useSettings()
  const me = useMe()
  const res = useDB((st) => st.reservations)
  const rooms = useDB((st) => st.rooms)
  const loc = useLocation()
  const nav = useNavigate()
  const t = useNow(1000)
  const next = useMemo(() => {
    if (!me) return null
    return Object.values(res).filter((r) => r.userId === me.id && r.status === 'booked' && rooms[r.roomId])
      .map((r) => ({ r, room: rooms[r.roomId] })).sort((a, b) => a.room.startAt - b.room.startAt)[0] ?? null
  }, [me, res, rooms])
  const jump = (beforeMs: number) => {
    if (!next) { toast('먼저 면접방을 예약해 주세요.', 'warn'); return }
    s.setOffset(next.room.startAt - beforeMs - Date.now())
    toast(`시간을 이동했어요: ${fmtDT(now())}`, 'ok')
  }
  const hide = loc.pathname === '/' || loc.pathname.startsWith('/interview')
  const stateLabel = s.offset ? `가상 시각 ${fmtDT(t)}` : '실제 시각'
  if (hide && !open) return (
    <button onClick={() => setOpen(true)} aria-label="데모 컨트롤" className="fixed z-[60] right-3 bottom-3 h-10 w-10 rounded-full bg-espresso/80 text-cream grid place-items-center shadow-soft opacity-60 hover:opacity-100">
      <Ico.gear size={18} />
    </button>
  )
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="데모 컨트롤 열기" className="fixed z-[60] right-3 bottom-[88px] md:bottom-4 h-11 pl-3 pr-4 rounded-full bg-espresso text-white text-[13px] font-bold shadow-soft flex items-center gap-1.5">
          <Ico.gear size={16} /> 데모
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} wide title={<span className="flex items-center gap-2">데모 컨트롤 <Chip tone="sky">프로토타입 전용</Chip></span>}
        footer={<Btn onClick={() => setOpen(false)}>닫기</Btn>}>
        <div className="space-y-5 text-ink">
          <section>
            <h4 className="font-bold mb-1.5">시간 이동 <span className="font-normal text-ink3 text-[13px]">· {stateLabel}</span></h4>
            <p className="text-[13px] text-ink2 mb-2">실제로 기다리지 않고 내 다음 예약{next ? `(${fmtDT(next.room.startAt)})` : ''} 기준으로 시각을 옮겨요.</p>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" v="soft" onClick={() => jump(61 * MIN)}>1시간 전</Btn>
              <Btn size="sm" v="soft" onClick={() => jump(14 * MIN + 50_000)}>대기실 오픈(15분 전)</Btn>
              <Btn size="sm" v="soft" onClick={() => jump(20_000)}>시작 20초 전</Btn>
              <Btn size="sm" v="ghost" onClick={() => { s.setOffset(0); toast('실제 시각으로 돌아왔어요.') }}>실제 시각으로</Btn>
              <Btn size="sm" v="ghost" onClick={() => s.setOffset(s.offset + 10 * MIN)}>+10분</Btn>
              <Btn size="sm" v="ghost" onClick={() => s.setOffset(s.offset + 60 * MIN)}>+1시간</Btn>
            </div>
          </section>
          <section>
            <h4 className="font-bold mb-1.5">면접 진행 속도</h4>
            <p className="text-[13px] text-ink2 mb-2">정식은 한 부 10분(총 30분)이에요. 시험할 땐 짧게 줄여요.</p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 5, 10].map((m) => <Btn key={m} size="sm" v={s.partMin === m ? 'dark' : 'soft'} onClick={() => s.patch({ partMin: m })}>한 부 {m}분{m === 10 ? ' (정식)' : ''}</Btn>)}
            </div>
          </section>
          <section>
            <h4 className="font-bold mb-1.5">인원 미달 → 재매칭 결과</h4>
            <div className="flex flex-wrap gap-2">
              {(['success', 'fail', 'random'] as const).map((m) => <Btn key={m} size="sm" v={s.rematch === m ? 'dark' : 'soft'} onClick={() => s.patch({ rematch: m })}>{{ success: '성공', fail: '실패', random: '랜덤' }[m]}</Btn>)}
            </div>
            {next && (
              <label className="mt-3 flex items-center gap-2 text-[14px]">
                <input type="checkbox" checked={!!next.room.botNoShow} onChange={(e) => useDB.setState((st) => ({ rooms: { ...st.rooms, [next.room.id]: { ...next.room, botNoShow: e.target.checked } } }))} className="h-5 w-5 accent-[#c24e1a]" />
                내 다음 방의 상대 참가자가 노쇼해요 (인원 미달 시험)
              </label>
            )}
          </section>
          <section>
            <h4 className="font-bold mb-1.5">보기</h4>
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={s.showIA} onChange={(e) => s.patch({ showIA: e.target.checked })} className="h-5 w-5 accent-[#c24e1a]" />
              IA 라벨(F-코드) 표시
            </label>
          </section>
          <section>
            <h4 className="font-bold mb-1.5">바로가기</h4>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" v="soft" onClick={() => { setOpen(false); nav('/admin') }}>관리자 페이지</Btn>
              <Btn size="sm" v="soft" onClick={() => { setOpen(false); nav('/reserve') }}>면접방 예약</Btn>
              <Btn size="sm" v="danger" onClick={() => {
                if (confirm('가입 정보·예약·기록을 모두 지우고 처음 상태로 돌릴까요?')) {
                  useDB.getState().resetAll(); useAuth.getState().signOut(); s.setOffset(0)
                  try { Object.keys(localStorage).filter((k) => k.startsWith('pm-sess-')).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
                  setOpen(false); nav('/')
                }
              }}>데이터 초기화</Btn>
            </div>
          </section>
        </div>
      </Modal>
    </>
  )
}
