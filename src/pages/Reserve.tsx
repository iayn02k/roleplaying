import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CFG, DAY, HOUR, MIN, cx, dayKey, fmtDT, fmtDate, hhmm, fmtRel, layoutCap, now, roomName, startOfDay, useNow } from '../lib/core'
import { roomSeats, useDB, useMe } from '../lib/db'
import { Btn, Card, Chip, Empty, F, Field, Ico, Modal, inputCls, toast } from '../components/ui'
import { JOBS } from '../data/questions'
import type { Role, Room } from '../types'

export default function Reserve() {
  const me = useMe()!
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const t = useNow(2000)
  const rooms = useDB((s) => s.rooms)
  const resv = useDB((s) => s.reservations)
  const requests = useDB((s) => s.requests)
  const [filter, setFilter] = useState<'all' | 'ee' | 'er'>('all')
  const [picked, setPicked] = useState<string | null>(sp.get('room'))
  const [confirm, setConfirm] = useState<null | { role: Role; kind: 'ee' | 'er' | 'offer' | 'noticket' }>(null)
  const [done, setDone] = useState<null | { resId: string; role: Role; roomId: string }>(null)
  const [reqOpen, setReqOpen] = useState(false)
  const changeId = sp.get('change')

  const restricted = me.restrictedUntil && me.restrictedUntil > t
  const today = dayKey(t)
  const list = useMemo(() => {
    return Object.values(rooms)
      .filter((r) => !r.cancelled && dayKey(r.startAt) === today && r.startAt > t)
      .map((r) => ({ r, seats: roomSeats({ rooms, reservations: resv }, r.id) }))
      .filter((x) => !x.seats.full)
      .filter((x) => (filter === 'ee' ? x.seats.eeLeft > 0 : filter === 'er' ? x.seats.erLeft > 0 : true))
      .sort((a, b) => a.r.startAt - b.r.startAt)
  }, [rooms, resv, today, t, filter])
  const bySlot = useMemo(() => {
    const m = new Map<number, typeof list>()
    list.forEach((x) => m.set(x.r.startAt, [...(m.get(x.r.startAt) ?? []), x]))
    return [...m.entries()]
  }, [list])

  const pickedRoom = picked ? rooms[picked] : undefined
  const seats = pickedRoom ? roomSeats({ rooms, reservations: resv }, pickedRoom.id) : null
  const locked = pickedRoom ? pickedRoom.startAt - CFG.lockBeforeMin * MIN <= t : false
  const myRes = Object.values(resv).filter((r) => r.userId === me.id && r.status === 'booked')

  const doBook = (role: Role) => {
    if (!pickedRoom) return
    const db = useDB.getState()
    let old = changeId ? db.reservations[changeId] : undefined
    if (old) {
      const c = db.cancel(old.id)
      if (!c.ok) { toast(c.msg ?? '변경할 수 없어요.', 'warn'); setConfirm(null); return }
    }
    const r = db.book(me.id, pickedRoom.id, role)
    if (!r.ok) {
      if (old) db.book(me.id, old.roomId, old.role)
      toast(r.msg ?? '예약하지 못했어요.', 'warn'); setConfirm(null); return
    }
    setConfirm(null)
    setDone({ resId: r.id!, role, roomId: pickedRoom.id })
    if (changeId) { const n = new URLSearchParams(sp); n.delete('change'); setSp(n, { replace: true }) }
  }

  // F-09 역할 선택 → 분기
  const chooseRole = (role: Role) => {
    if (!pickedRoom || !seats) return
    if (restricted) return toast('노쇼 경고로 이용이 제한된 상태예요.', 'warn')
    if (role === 'interviewer') return setConfirm({ role, kind: 'er' })
    // 면접자
    if (me.tickets >= 1 || (changeId && resv[changeId]?.ticketHeld)) return setConfirm({ role, kind: 'ee' })
    if (seats.erLeft > 0) return setConfirm({ role: 'interviewer', kind: 'offer' })
    setConfirm({ role, kind: 'noticket' })
  }

  useEffect(() => { if (picked && !rooms[picked]) setPicked(null) }, [picked, rooms])

  if (done) {
    const room = rooms[done.roomId]
    return (
      <div className="max-w-xl mx-auto animate-rise">
        <F code="F-08 예약 확정" className="mb-3 inline-block" />
        <Card className="p-6 sm:p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-leaf-l text-leaf grid place-items-center"><Ico.check size={34} /></div>
          <h1 className="mt-4 text-[26px] font-extrabold tracking-tight">예약이 확정됐어요</h1>
          <p className="mt-1 font-bold text-ink">{roomName(room)}</p>
          <p className="mt-1 text-ink2">{fmtDT(room.startAt)} · {done.role === 'interviewee' ? '면접자' : '면접관'} 역할 · 면접자 {layoutCap(room.layout).ee} : 면접관 {layoutCap(room.layout).er}</p>
          <ul className="mt-6 text-left text-[14px] text-ink2 space-y-2.5 bg-cream rounded-[28px] p-4 leading-snug">
            <li className="flex gap-2"><Ico.clock size={18} className="shrink-0 mt-0.5" /> 시작 {CFG.waitingOpenMin}분 전에 대기실이 열려요. 들어오면 중간에 나갈 수 없어요.</li>
            <li className="flex gap-2"><Ico.lock size={18} className="shrink-0 mt-0.5" /> 예약 취소·변경은 면접 1시간 전까지만 돼요.</li>
            <li className="flex gap-2"><Ico.bell size={18} className="shrink-0 mt-0.5" /> 면접 1시간 전과 대기실이 열릴 때 알림을 보내드려요.</li>
            {done.role === 'interviewer'
              ? <li className="flex gap-2"><Ico.ticket size={18} className="shrink-0 mt-0.5" /> 면접권은 면접이 끝나고 피드백을 남기면 1장 지급돼요. 1시간 전부터 자소서를 보고 커스텀 질문을 쓸 수 있어요.</li>
              : <li className="flex gap-2"><Ico.ticket size={18} className="shrink-0 mt-0.5" /> 면접권 1장을 사용했어요. 인원이 모자라 면접이 취소되면 돌려받아요.</li>}
            <li className="flex gap-2 text-danger font-semibold"><Ico.x size={18} className="shrink-0 mt-0.5" /> 노쇼 경고가 2회 쌓이면 서비스 이용이 제한돼요.</li>
          </ul>
          <div className="mt-6 flex gap-2 justify-center flex-wrap">
            <Btn v="soft" onClick={() => nav('/lobby')}>로비로</Btn>
            <Btn v="soft" onClick={() => { setDone(null); setPicked(null) }}>방 더 보기</Btn>
            <Btn onClick={() => nav('/records?tab=calendar')}>내 예약 보기</Btn>
          </div>
        </Card>
      </div>
    )
  }

  const reqLeft = CFG.requestPerWeek - requests.filter((q) => q.userId === me.id && q.createdAt > now() - 7 * DAY).length
  const myReq = requests.filter((q) => q.userId === me.id).slice(0, 3)

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <F code="F-06 면접방 예약 창" className="mb-2 inline-block" />
          <h1 className="text-[28px] font-extrabold tracking-tight">면접방 예약</h1>
          <p className="text-ink2 mt-1 text-[15px]">{fmtDate(t)} · 매일 오전 {CFG.openHour}시에 그날 방이 한 번에 열려요. 방 구성은 면접자 : 면접관 = 2:2 / 2:1 / 1:2 / 1:1이에요.</p>
        </div>
        <Chip tone="brand"><Ico.ticket size={14} /> 면접권 {me.tickets}장</Chip>
      </div>

      {changeId && <div className="mt-4 rounded-2xl bg-sky-l text-sky px-4 py-3 text-[14px] font-semibold">예약 변경 중이에요. 새 방을 고르면 기존 예약은 취소돼요.</div>}
      {restricted && <div className="mt-4 rounded-2xl bg-danger-l text-danger px-4 py-3 text-[14px] font-semibold">노쇼 경고가 쌓여 {fmtDT(me.restrictedUntil!)}까지 새로 예약할 수 없어요.</div>}
      {myRes.length > 0 && !changeId && <p className="mt-3 text-[13px] text-ink3">이미 예약한 면접 {myRes.length}건이 있어요. 같은 시간대에는 하나만 예약할 수 있어요.</p>}

      <div className="mt-5 flex gap-2 flex-wrap" role="tablist" aria-label="역할 필터">
        {([['all', '전체'], ['ee', '면접자 자리 있음'], ['er', '면접관 자리 있음']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cx('h-10 px-4 rounded-full text-[14px] font-semibold border', filter === k ? 'bg-espresso text-white border-espresso' : 'bg-paper text-ink2 border-transparent hover:bg-sand')}>{l}</button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {bySlot.length === 0 && (
          <Card><Empty emoji="🕰️" title="지금 예약할 수 있는 방이 없어요" desc="오늘 열린 방이 모두 찼거나 시작 시간이 지났어요. 원하는 시간대를 요청하면 관리자가 방을 열어드려요."
            action={<Btn onClick={() => setReqOpen(true)}>시간대 개설 요청</Btn>} /></Card>
        )}
        {bySlot.map(([at, items]) => (
          <section key={at}>
            <h2 className="flex items-baseline gap-2 font-extrabold text-[20px]">{hhmm(at)} <span className="text-[13px] font-semibold text-ink3">{at - CFG.lockBeforeMin * MIN <= t ? '예약 마감' : `${fmtRel(Math.max(0, at - t))} 뒤 시작`}</span></h2>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {items.map(({ r, seats: s }) => {
                const closed = r.startAt - CFG.lockBeforeMin * MIN <= t
                return (
                  <button key={r.id} disabled={closed} onClick={() => setPicked(r.id)} className={cx('text-left rounded-[28px] bg-paper ring-1 ring-black/[.04] p-5 shadow-soft transition', closed ? 'opacity-50' : 'hover:-translate-y-0.5 hover:ring-brand/40')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[17px] font-extrabold leading-snug tracking-tight">{roomName(r)}</div>
                        <div className="mt-1 text-[13px] text-ink3 font-semibold">{hhmm(r.startAt)} 시작 · 30분{r.createdBy !== 'system' ? ` · ${r.createdBy === 'request' ? '요청으로 열림' : '관리자 개설'}` : ''}</div>
                      </div>
                      <Chip>{r.job}</Chip>
                    </div>
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <SeatPill label="면접자" total={s.cap.ee} n={s.ee.length} tone="brand" />
                      <SeatPill label="면접관" total={s.cap.er} n={s.er.length} tone="warn" />
                      <span className="ml-auto text-[12px] font-bold text-brand">{s.eeLeft + s.erLeft}자리 남음</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <Card className="mt-8 p-5 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="font-bold">원하는 시간대가 없나요?</div>
          <p className="text-[14px] text-ink2">시간대와 직군을 요청하면 관리자가 방을 열고 알림을 보내드려요. (1주일에 {CFG.requestPerWeek}회까지 · 남은 요청 {Math.max(0, reqLeft)}회)</p>
          {myReq.length > 0 && <p className="text-[12px] text-ink3 mt-1.5">내 요청: {myReq.map((q) => `${fmtDT(q.desiredAt)} ${q.status === 'pending' ? '대기 중' : q.status === 'opened' ? '열림' : '반려'}`).join(' · ')}</p>}
        </div>
        <Btn v="soft" onClick={() => setReqOpen(true)}>개설 요청하기</Btn>
      </Card>

      {/* 면접방 선택·상세 + 역할 선택 */}
      <Modal open={!!pickedRoom && !confirm} onClose={() => setPicked(null)} wide title={pickedRoom ? <span>{roomName(pickedRoom)}<span className="block text-[13px] font-semibold text-ink3 mt-0.5">{fmtDT(pickedRoom.startAt)}</span></span> : ''}
        footer={<Btn v="ghost" onClick={() => setPicked(null)}>닫기</Btn>}>
        {pickedRoom && seats && (
          <div className="text-ink">
            <F code="면접방 선택 · 상세 → 역할 선택 (F-09)" className="mb-3 inline-block" />
            <div className="flex gap-2 flex-wrap mb-4"><Chip tone="dark">면접자 {seats.cap.ee} : 면접관 {seats.cap.er}</Chip><Chip>{pickedRoom.job}</Chip><Chip>총 30분 · 1부 공통 → 2부 커스텀 → 3부 자유</Chip></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <RoleCard role="interviewee" left={seats.eeLeft} total={seats.cap.ee} disabled={seats.eeLeft <= 0 || locked}
                desc={`질문을 받고 답변해요. 면접권 1장을 써요 (보유 ${me.tickets}장).`} onPick={() => chooseRole('interviewee')} />
              <RoleCard role="interviewer" left={seats.erLeft} total={seats.cap.er} disabled={seats.erLeft <= 0 || locked}
                desc="질문 카드로 질문하고 키워드 피드백을 남겨요. 끝나면 면접권 1장을 받아요." onPick={() => chooseRole('interviewer')} />
            </div>
            {locked && <p className="mt-3 text-danger text-[14px] font-semibold">시작 1시간 전부터는 새로 예약할 수 없어요.</p>}
            <p className="mt-4 text-[13px] text-ink3">정원이 다 차면 자동으로 확정되고, 예약 리스트에서 사라져요. 면접자 1명 + 면접관 1명만 있어도 면접은 시작해요.</p>
          </div>
        )}
      </Modal>

      {/* 확인 모달들 */}
      <Modal open={confirm?.kind === 'ee'} onClose={() => setConfirm(null)} title="면접자로 예약할까요?"
        footer={<><Btn v="soft" onClick={() => setConfirm(null)}>취소</Btn><Btn onClick={() => doBook('interviewee')}>예약 확정</Btn></>}>
        <ul className="space-y-1.5 text-[14px] list-disc pl-5">
          <li>면접권 1장을 사용해요. (남은 면접권 {changeId && resv[changeId]?.ticketHeld ? me.tickets : me.tickets - 1}장)</li>
          <li>예약 취소·변경은 면접 1시간 전까지만 돼요.</li>
          <li><b>노쇼 경고 2회</b>가 되면 서비스 이용이 제한돼요.</li>
        </ul>
      </Modal>
      <Modal open={confirm?.kind === 'er'} onClose={() => setConfirm(null)} title="면접관으로 예약할까요?"
        footer={<><Btn v="soft" onClick={() => setConfirm(null)}>취소</Btn><Btn onClick={() => doBook('interviewer')}>예약 확정</Btn></>}>
        <ul className="space-y-1.5 text-[14px] list-disc pl-5">
          <li>면접관으로 참여하면 <b>외형이 면접관 시트에서 랜덤으로 바뀌어요.</b></li>
          <li>면접권은 면접이 끝나고 피드백을 남기면 <b>1장 지급 예정</b>이에요. (예약할 땐 안내만)</li>
          <li>시작 1시간 전부터 자소서를 열람하고 커스텀 질문을 쓸 수 있어요.</li>
          <li><b>노쇼 경고 2회</b>가 되면 서비스 이용이 제한돼요.</li>
        </ul>
      </Modal>
      <Modal open={confirm?.kind === 'offer'} onClose={() => setConfirm(null)} title="면접관으로 먼저 참여해 보실래요?"
        footer={<><Btn v="soft" onClick={() => setConfirm(null)}>아니요</Btn><Btn onClick={() => doBook('interviewer')}>참여하고 면접권 받기</Btn></>}>
        면접권이 없어서 면접자로 예약할 수 없어요. 이 방에는 면접관 자리가 있어요. <b>면접관으로 참여하면 면접권 1장이 지급</b>돼요. 참여하면 면접관으로 예약돼요.
      </Modal>
      <Modal open={confirm?.kind === 'noticket'} onClose={() => setConfirm(null)} title="면접권이 없어요"
        footer={<Btn onClick={() => { setConfirm(null); setPicked(null) }}>예약 창으로 돌아가기</Btn>}>
        면접자로 참여하려면 면접권 1장이 필요해요. 이 방은 면접관 자리가 부족해서 면접관 참여 제안도 드릴 수 없어요. <b>면접관으로 먼저 참여해 주세요.</b> 다른 방에서 면접관 자리를 찾아볼까요? (구매·광고로 받기는 MVP에서 제외돼요.)
      </Modal>

      <RequestModal open={reqOpen} onClose={() => setReqOpen(false)} left={reqLeft} />
    </div>
  )
}

function SeatPill({ label, total, n, tone }: { label: string; total: number; n: number; tone: 'brand' | 'warn' }) {
  const on = tone === 'brand' ? 'bg-brand' : 'bg-warn'
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-cream pl-3 pr-3.5 h-9 text-[13px] font-bold">
      {label}
      <span className="flex gap-1" aria-label={`${n}/${total}명`}>
        {Array.from({ length: total }).map((_, i) => <span key={i} className={cx('h-3 w-3 rounded-full', i < n ? on : 'border-2 border-ink3/40')} />)}
      </span>
      <span className="text-ink3 font-semibold">{n}/{total}</span>
    </span>
  )
}

function RoleCard({ role, left, total, desc, disabled, onPick }: { role: Role; left: number; total: number; desc: string; disabled: boolean; onPick: () => void }) {
  const ee = role === 'interviewee'
  return (
    <button disabled={disabled} onClick={onPick} className={cx('text-left rounded-[28px] border-2 p-4 transition disabled:opacity-45', ee ? 'border-brand/20 bg-brand-l/60 hover:border-brand' : 'border-warn/20 bg-warn-l/60 hover:border-warn')}>
      <div className="flex items-center justify-between"><span className="text-[18px] font-extrabold">{ee ? '면접자로 참여' : '면접관으로 참여'}</span><Chip tone={left > 0 ? (ee ? 'brand' : 'warn') : 'neutral'}>{left > 0 ? `${left}자리 남음` : '마감'}</Chip></div>
      <p className="mt-1.5 text-[14px] text-ink2">{desc}</p>
      <p className="mt-2 text-[12px] text-ink3">정원 {total}명</p>
    </button>
  )
}

function RequestModal({ open, onClose, left }: { open: boolean; onClose: () => void; left: number }) {
  const me = useMe()!
  const t = useNow(5000)
  const [day, setDay] = useState(0)
  const [hour, setHour] = useState(20)
  const [job, setJob] = useState<string>('전체')
  const base = startOfDay(t)
  const days = Array.from({ length: 7 }, (_, i) => base + i * DAY)
  const at = days[day] + hour * HOUR
  const past = at - CFG.lockBeforeMin * MIN <= t
  return (
    <Modal open={open} onClose={onClose} title="면접방 개설 요청"
      footer={<><Btn v="soft" onClick={onClose}>닫기</Btn><Btn disabled={past || left <= 0} onClick={() => {
        const r = useDB.getState().request(me.id, at, job)
        if (!r.ok) return toast(r.msg ?? '요청하지 못했어요.', 'warn')
        toast('요청했어요. 관리자가 방을 열면 알림을 보내드려요.', 'ok'); onClose()
      }}>요청 보내기</Btn></>}>
      <div className="space-y-4 text-ink">
        <p className="text-[14px] text-ink2">원하는 시간대가 없으면 요청할 수 있어요. 1주일에 {CFG.requestPerWeek}회까지 (남은 {Math.max(0, left)}회). 관리자가 방을 열면 알림이 와요.</p>
        <Field label="날짜">
          <select className={inputCls} value={day} onChange={(e) => setDay(+e.target.value)}>{days.map((d, i) => <option key={d} value={i}>{fmtDate(d)}{i === 0 ? ' · 오늘' : ''}</option>)}</select>
        </Field>
        <Field label="시간대">
          <select className={inputCls} value={hour} onChange={(e) => setHour(+e.target.value)}>{Array.from({ length: 15 }, (_, i) => 9 + i).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>
        </Field>
        <Field label="직군"><select className={inputCls} value={job} onChange={(e) => setJob(e.target.value)}>{['전체', ...JOBS].map((j) => <option key={j}>{j}</option>)}</select></Field>
        {past && <p className="text-[13px] text-danger font-semibold">시작 1시간 전이 지난 시간대는 요청할 수 없어요.</p>}
      </div>
    </Modal>
  )
}

export type { Room }
