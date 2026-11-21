import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CFG, MIN, cx, fmtDT, fmtDate, hhmm, roomName, layoutCap, now, startOfDay, useNow, DAY } from '../lib/core'
import { useDB, useMe } from '../lib/db'
import { AvatarImg, Btn, Card, Chip, Empty, F, Ico, Modal, toast } from '../components/ui'
import { BADGE_DEFS, KEYWORDS } from '../data/questions'
import { PART_NAME } from '../lib/session'
import { idbGet, type RecBlob } from '../lib/media'
import { QAList } from './Feedback'
import type { InterviewRecord, QA, Reservation } from '../types'

const TABS = [
  { id: 'list', label: '기록 목록' },
  { id: 'calendar', label: '예약한 면접' },
  { id: 'keywords', label: '받은 키워드·뱃지' },
  { id: 'judged', label: '면접관 참여 기록' },
  { id: 'cards', label: '질문카드 보관함' },
] as const
type TabId = (typeof TABS)[number]['id']

export default function Records() {
  const [sp, setSp] = useSearchParams()
  const tab = (TABS.find((x) => x.id === sp.get('tab'))?.id ?? 'list') as TabId
  return (
    <div>
      <F code="메뉴 2 · 면접 기록" className="mb-2 inline-block" />
      <h1 className="text-[28px] font-extrabold tracking-tight">면접 기록</h1>
      <p className="text-ink2 mt-1 text-[15px]">면접자·면접관으로 참여한 기록이 모두 쌓여요. 면접관 참여는 날짜와 좋아요 수로만 보여요.</p>
      <div className="mt-5 -mx-4 px-4 overflow-x-auto"><div className="flex gap-2 w-max" role="tablist">
        {TABS.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setSp({ tab: x.id })} className={cx('h-10 px-4 rounded-full text-[14px] font-bold border whitespace-nowrap', tab === x.id ? 'bg-espresso text-white border-espresso' : 'bg-paper text-ink2 border-line hover:bg-sand')}>{x.label}</button>)}
      </div></div>
      <div className="mt-5">
        {tab === 'list' && <ListTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'keywords' && <KeywordsTab />}
        {tab === 'judged' && <JudgedTab />}
        {tab === 'cards' && <CardsTab />}
      </div>
    </div>
  )
}

/* ---------------- 기록 목록 ---------------- */
function ListTab() {
  const me = useMe()!
  const nav = useNavigate()
  const records = useDB((s) => s.records).filter((r) => r.userId === me.id)
  const feedbacks = useDB((s) => s.feedbacks)
  const [open, setOpen] = useState<InterviewRecord | null>(null)
  if (!records.length) return <Card><Empty emoji="📝" title="아직 면접 기록이 없어요" desc="첫 면접을 마치면 질문과 내 답변, 받은 키워드가 이곳에 쌓여요." action={<Btn onClick={() => nav('/reserve')}>면접방 예약하기</Btn>} /></Card>
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {records.map((r) => {
          const ee = r.role === 'interviewee'
          const kws = feedbacks.filter((f) => f.roomId === r.roomId && f.to === me.id && f.kind === 'keywords').flatMap((f) => f.keywords ?? [])
          const likes = feedbacks.filter((f) => f.roomId === r.roomId && f.to === me.id && f.kind === 'like' && f.like).length
          return (
            <Card key={r.id} className={cx('p-4', ee && 'cursor-pointer hover:border-brand')} onClick={() => ee && setOpen(r)}>
              <div className="flex items-center gap-2"><Chip tone={ee ? 'leaf' : 'brand'}>{ee ? '면접자' : '면접관'}</Chip><Chip>면접자 {layoutCap(r.layout).ee} : 면접관 {layoutCap(r.layout).er}</Chip></div>
              <div className="mt-2 font-extrabold text-[17px]">{fmtDT(r.startAt)}</div>
              {ee ? (
                <>
                  <p className="text-[13px] text-ink2 mt-1">받은 질문 {r.qa.length}개 · 답변 {r.qa.filter((q) => q.answer.trim()).length}개</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{kws.length ? kws.slice(0, 4).map((k) => <Chip key={k} tone={KEYWORDS.find((x) => x.k === k)?.tone === 'improve' ? 'warn' : 'leaf'}>{k}</Chip>) : <span className="text-[12px] text-ink3">받은 키워드가 아직 없어요</span>}</div>
                </>
              ) : <p className="mt-1 text-[14px] text-ink2 flex items-center gap-1.5"><Ico.thumb size={16} /> 좋아요 {likes}개</p>}
            </Card>
          )
        })}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} wide title="면접 기록" footer={<Btn onClick={() => setOpen(null)}>닫기</Btn>}>
        {open && <div className="-mx-2"><QAList rec={open} /></div>}
      </Modal>
    </>
  )
}

/* ---------------- 예약한 면접 캘린더 ---------------- */
function CalendarTab() {
  const me = useMe()!
  const nav = useNavigate()
  const t = useNow(2000)
  const resv = useDB((s) => s.reservations)
  const rooms = useDB((s) => s.rooms)
  const cancel = useDB((s) => s.cancel)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const mine = useMemo(() => Object.values(resv).filter((r) => r.userId === me.id && rooms[r.roomId]).sort((a, b) => rooms[a.roomId].startAt - rooms[b.roomId].startAt), [resv, rooms, me.id])
  const upcoming = mine.filter((r) => r.status === 'booked' && rooms[r.roomId].startAt + 40 * MIN > t)
  const past = mine.filter((r) => !upcoming.includes(r)).reverse()
  const d0 = new Date(t)
  const first = new Date(d0.getFullYear(), d0.getMonth(), 1)
  const days = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: first.getDay() }, () => 0).concat(Array.from({ length: days }, (_, i) => i + 1))
  const byDay = (d: number) => upcoming.filter((r) => new Date(rooms[r.roomId].startAt).getDate() === d && new Date(rooms[r.roomId].startAt).getMonth() === d0.getMonth())
  const target = cancelId ? resv[cancelId] : null
  const tRoom = target ? rooms[target.roomId] : null
  const lockedNow = tRoom ? tRoom.startAt - CFG.lockBeforeMin * MIN <= t : false
  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-5">
      <Card className="p-4 h-fit">
        <div className="font-bold mb-3">{d0.getFullYear()}년 {d0.getMonth() + 1}월</div>
        <div className="grid grid-cols-7 text-center text-[12px] text-ink3 font-semibold mb-1">{['일', '월', '화', '수', '목', '금', '토'].map((d) => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const n = d ? byDay(d).length : 0
            return <div key={i} className={cx('aspect-square rounded-xl grid place-items-center text-[13px] relative', !d && 'opacity-0', d === d0.getDate() && 'bg-brand text-white font-bold', n > 0 && d !== d0.getDate() && 'bg-leaf-l text-leaf-d font-bold')}>{d || ''}{n > 0 && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current" />}</div>
          })}
        </div>
        <p className="text-[12px] text-ink3 mt-3">예약 수정·취소는 면접 1시간 전까지만 돼요.</p>
      </Card>
      <div className="space-y-3">
        <h2 className="font-bold text-[17px]">다가오는 면접</h2>
        {upcoming.length === 0 && <Card><Empty emoji="📅" title="예약한 면접이 없어요" action={<Btn onClick={() => nav('/reserve')}>면접방 예약하기</Btn>} /></Card>}
        {upcoming.map((r) => {
          const room = rooms[r.roomId]
          const locked = room.startAt - CFG.lockBeforeMin * MIN <= t
          const open = room.startAt - CFG.waitingOpenMin * MIN <= t
          return (
            <Card key={r.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap"><Chip tone={r.role === 'interviewee' ? 'leaf' : 'brand'}>{r.role === 'interviewee' ? '면접자' : '면접관'}</Chip><Chip>면접자 {layoutCap(room.layout).ee} : 면접관 {layoutCap(room.layout).er}</Chip>{locked && <Chip tone="warn"><Ico.lock size={12} /> 변경 불가</Chip>}</div>
              <div className="mt-2 font-extrabold text-[18px]">{roomName(room)}</div><div className="text-[13px] text-ink3 font-semibold">{fmtDT(room.startAt)}</div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {open || (r.role === 'interviewer' && locked) ? <Btn size="sm" v="leaf" onClick={() => nav(`/waiting/${r.id}`)}>{open ? '대기실 입장' : '자소서 · 질문 준비'}</Btn> : null}
                <Btn size="sm" v="soft" onClick={() => (locked ? toast('면접 1시간 전부터는 변경할 수 없어요.', 'warn') : nav(`/reserve?change=${r.id}`))}>변경</Btn>
                <Btn size="sm" v="ghost" onClick={() => setCancelId(r.id)}>취소</Btn>
              </div>
            </Card>
          )
        })}
        {past.length > 0 && <h2 className="font-bold text-[17px] pt-3">지난 예약</h2>}
        {past.slice(0, 8).map((r) => <PastRow key={r.id} r={r} start={rooms[r.roomId].startAt} />)}
      </div>

      <Modal open={!!target} onClose={() => setCancelId(null)} title={lockedNow ? '지금은 취소할 수 없어요' : '예약을 취소할까요?'}
        footer={lockedNow ? <Btn onClick={() => setCancelId(null)}>알겠어요</Btn> : <><Btn v="soft" onClick={() => setCancelId(null)}>유지할게요</Btn><Btn v="danger" onClick={() => { const c = cancel(target!.id); if (c.ok) toast('예약을 취소했어요.' + (target!.ticketHeld ? ' 면접권을 돌려드렸어요.' : ''), 'ok'); else toast(c.msg ?? '취소하지 못했어요.', 'warn'); setCancelId(null) }}>예약 취소</Btn></>}>
        {tRoom && (lockedNow
          ? '면접 1시간 전부터는 예약 취소·변경이 안 돼요. 참석하지 못하면 노쇼로 처리되고 경고가 쌓여요.'
          : <>{fmtDT(tRoom.startAt)} {target!.role === 'interviewee' ? '면접자' : '면접관'} 역할 예약을 취소해요. {target!.ticketHeld && '사용한 면접권 1장은 돌려드려요.'}</>)}
      </Modal>
    </div>
  )
}
function PastRow({ r, start }: { r: Reservation; start: number }) {
  const label = { done: ['완료', 'leaf'], cancelled: ['취소됨', 'neutral'], noshow: ['노쇼', 'danger'], booked: ['지남', 'neutral'] }[r.status] as [string, 'leaf' | 'neutral' | 'danger']
  return <div className="rounded-2xl border border-line bg-paper px-4 py-3 flex items-center gap-3 text-[14px]"><Chip tone={label[1]}>{label[0]}</Chip><span className="flex-1">{fmtDT(start)} · {r.role === 'interviewee' ? '면접자' : '면접관'}</span></div>
}

/* ---------------- 받은 키워드 · 뱃지 · 피드백 ---------------- */
function KeywordsTab() {
  const me = useMe()!
  const feedbacks = useDB((s) => s.feedbacks).filter((f) => f.to === me.id && f.kind === 'keywords')
  const users = useDB((s) => s.users)
  const rooms = useDB((s) => s.rooms)
  const counts = useMemo(() => { const m = new Map<string, number>(); feedbacks.flatMap((f) => f.keywords ?? []).forEach((k) => m.set(k, (m.get(k) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]) }, [feedbacks])
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-bold text-[17px]">뱃지</h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_DEFS.map((b) => { const has = me.badges.includes(b.id); return (
            <div key={b.id} className={cx('rounded-2xl border p-3 text-center', has ? 'bg-brand-l/50 border-brand/30' : 'bg-sand/60 border-line opacity-60')}>
              <div className={cx('text-3xl', !has && 'grayscale')}>{b.emoji}</div><div className="mt-1 text-[14px] font-bold">{b.name}</div><div className="text-[11.5px] text-ink2 leading-snug mt-0.5">{b.desc}</div>
            </div>) })}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-bold text-[17px]">받은 키워드</h2>
        {counts.length === 0 ? <p className="mt-3 text-[14px] text-ink2 bg-sand rounded-xl px-3 py-3">아직 받은 키워드가 없어요. 면접자로 면접을 마치면 면접관이 남긴 키워드가 쌓여요.</p> :
          <div className="mt-3 flex flex-wrap gap-2">{counts.map(([k, n]) => <Chip key={k} tone={KEYWORDS.find((x) => x.k === k)?.tone === 'improve' ? 'warn' : 'leaf'} className="!text-[14px] !py-2">{k} <b>×{n}</b></Chip>)}</div>}
      </Card>
      {feedbacks.length > 0 && (
        <Card className="p-5">
          <h2 className="font-bold text-[17px]">한 줄 평</h2>
          <p className="text-[12px] text-ink3">나만 볼 수 있어요.</p>
          <div className="mt-3 space-y-2.5">
            {feedbacks.filter((f) => f.comment).map((f) => (
              <div key={f.id} className="rounded-2xl bg-sand p-3.5 text-[14px]"><div className="flex items-center gap-2 text-[12px] text-ink3 mb-1"><AvatarImg id={users[f.from]?.avatar ?? 'boy'} size={24} />{users[f.from]?.nickname} · {rooms[f.roomId] ? fmtDate(rooms[f.roomId].startAt) : ''}</div>“{f.comment}”</div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ---------------- 면접관 참여 기록 ---------------- */
function JudgedTab() {
  const me = useMe()!
  const nav = useNavigate()
  const records = useDB((s) => s.records).filter((r) => r.userId === me.id && r.role === 'interviewer')
  const feedbacks = useDB((s) => s.feedbacks)
  if (!records.length) return <Card><Empty emoji="🪑" title="아직 면접관으로 참여한 기록이 없어요" desc="면접관으로 참여하면 질문의 의도가 보이고, 끝나면 면접권 1장을 받아요." action={<Btn onClick={() => nav('/reserve')}>면접관으로 예약하기</Btn>} /></Card>
  const total = feedbacks.filter((f) => f.to === me.id && f.kind === 'like' && f.like).length
  return (
    <div className="space-y-3">
      <Card className="p-4 flex items-center gap-3"><div className="h-11 w-11 rounded-2xl bg-brand-l text-brand grid place-items-center"><Ico.thumb /></div><div><div className="text-[12px] text-ink2 font-semibold">받은 좋아요 합계</div><div className="text-[22px] font-extrabold leading-none">{total}개</div></div></Card>
      {records.map((r) => (
        <div key={r.id} className="rounded-2xl border border-line bg-paper px-4 py-3 flex items-center gap-3"><Chip tone="brand">면접관</Chip><span className="flex-1 text-[15px] font-semibold">{fmtDate(r.startAt)}</span><span className="flex items-center gap-1 text-[14px] text-ink2"><Ico.thumb size={16} /> {feedbacks.filter((f) => f.roomId === r.roomId && f.to === me.id && f.kind === 'like' && f.like).length}</span></div>
      ))}
    </div>
  )
}

/* ---------------- 질문카드 보관함 (F-10) ---------------- */
type Card2 = QA & { rec: InterviewRecord }
function CardsTab() {
  const me = useMe()!
  const nav = useNavigate()
  const records = useDB((s) => s.records).filter((r) => r.userId === me.id && r.role === 'interviewee')
  const [tag, setTag] = useState('전체')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const cards: Card2[] = useMemo(() => records.flatMap((r) => r.qa.map((x) => ({ ...x, rec: r }))), [records])
  const tags = ['전체', ...Array.from(new Set(cards.map((c) => c.tag).filter(Boolean) as string[]))]
  const shown = cards.filter((c) => (tag === '전체' || c.tag === tag) && (!q || c.text.includes(q)))
  return (
    <div>
      <F code="F-10 질문카드 보관함" className="mb-2 inline-block" />
      {cards.length === 0 ? <Card><Empty emoji="🗂️" title="보관함이 비어 있어요" desc="면접자로 받은 질문이 카드로 쌓여요. 질문 의도 → 내 답변 → 모범 답변 방향 순서로 복습해요." action={<Btn onClick={() => nav('/reserve')}>면접 예약하기</Btn>} /></Card> : (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            {tags.map((t) => <button key={t} onClick={() => setTag(t)} className={cx('h-9 px-3.5 rounded-full text-[13px] font-bold border', tag === t ? 'bg-espresso text-white border-espresso' : 'bg-paper border-line text-ink2')}>{t}</button>)}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="질문 검색" className="h-9 rounded-full border border-line bg-white px-4 text-[13px] ml-auto w-40" aria-label="질문 검색" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {shown.map((c) => (
              <Card key={c.rec.id + c.id} className={cx('overflow-hidden', openId === c.rec.id + c.id && 'md:col-span-2')}>
                <button className="w-full text-left p-4" onClick={() => setOpenId(openId === c.rec.id + c.id ? null : c.rec.id + c.id)} aria-expanded={openId === c.rec.id + c.id}>
                  <div className="flex gap-1.5 mb-1.5 flex-wrap">{c.tag && <Chip tone={c.tag === '압박' ? 'danger' : c.tag === '황당' ? 'warn' : 'neutral'}>{c.tag}</Chip>}<Chip>{PART_NAME[c.part]}</Chip><Chip>{fmtDate(c.rec.startAt)}</Chip></div>
                  <div className="font-bold text-[16px] leading-snug">{c.text}</div>
                </button>
                {openId === c.rec.id + c.id && <VaultDetail c={c} />}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
function VaultDetail({ c }: { c: Card2 }) {
  const [url, setUrl] = useState<string | null>(null)
  const [mark, setMark] = useState<number | null>(null)
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (!c.rec.hasRecording) return
    let u: string | null = null
    idbGet<RecBlob>(`${c.rec.roomId}:${c.rec.userId}`).then((r) => { if (!r) return; u = URL.createObjectURL(r.blob); setUrl(u); setMark(r.marks.find((m) => m.qid === c.id)?.t ?? null) })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [c])
  return (
    <div className="px-4 pb-4 grid gap-2.5 text-[14px]">
      <div className="rounded-xl bg-sky-l/60 p-3"><b className="text-sky">① 질문 의도</b><p className="mt-0.5">{c.intent}</p></div>
      <div className="rounded-xl bg-sand p-3"><b className="text-ink2">② 내 답변</b>
        <p className="mt-0.5 whitespace-pre-wrap">{c.answer || <span className="text-ink3">기록된 답변이 없어요.</span>}</p>
        {url && <div className="mt-2 flex items-center gap-2"><audio ref={ref} controls src={url} className="flex-1 h-10" onLoadedMetadata={() => { if (mark !== null && ref.current) ref.current.currentTime = mark }} />{mark !== null && <Btn size="sm" v="soft" onClick={() => { if (ref.current) { ref.current.currentTime = mark; void ref.current.play() } }}>이 질문부터</Btn>}</div>}
      </div>
      <div className="rounded-xl bg-leaf-l/70 p-3"><b className="text-leaf-d">③ 모범 답변 방향</b><p className="mt-0.5">{c.direction}</p></div>
    </div>
  )
}

export { now, startOfDay, hhmm, DAY }
