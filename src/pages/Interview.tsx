import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { MIN, cx, fmtCount, hhmm, now, seedOf, shuffle, uid, useNow, useSettings } from '../lib/core'
import { useDB, useMe } from '../lib/db'
import { AvatarImg, Btn, Chip, F, Ico, Meter, Modal, areaCls, toast } from '../components/ui'
import { COMMON_QUESTIONS, CUSTOM_TEMPLATES, FOLLOWUPS, FREE_SUGGESTIONS } from '../data/questions'
import { createSTT, idbPut, speak, startRecording, stopSpeak, sttSupported, useMic, type Recorder } from '../lib/media'
import { PART_NAME, derive, getBus, phaseAt, useBusEvents, type Ask } from '../lib/session'
import type { AvatarId, CustomQuestion, InterviewRecord, QA, Question, Reservation, Role, User } from '../types'
import type { Person } from '../three/InterviewScene'

const Scene = lazy(() => import('../three/InterviewScene'))

const BOT_ANSWERS = [
  '네, 먼저 결론부터 말씀드리면 그렇게 생각해요. 이유는 두 가지인데, 첫째로 직접 경험해 본 일이 있어서고, 둘째로 그때 배운 점이 지금까지 이어지고 있기 때문이에요.',
  '당시에 팀에서 제가 맡은 역할은 자료를 정리하고 일정을 관리하는 일이었어요. 어려운 순간도 있었지만, 중간에 상황을 공유하고 우선순위를 다시 잡아서 마감까지 마무리했어요.',
  '솔직히 말씀드리면 처음엔 많이 서툴렀어요. 그런데 피드백을 받고 방식을 바꿔 보면서 조금씩 나아졌고, 지금은 같은 상황이 오면 더 차분하게 대응할 수 있다고 생각해요.',
  '제가 가장 중요하게 생각하는 건 함께 일하는 사람에 대한 존중이에요. 의견이 달라도 근거를 듣고, 합의한 방향으로 같이 움직이는 걸 중요하게 여겨요.',
]

export default function Interview() {
  const { roomId } = useParams()
  const me = useMe()!
  const room = useDB((s) => (roomId ? s.rooms[roomId] : undefined))
  const resv = useDB((s) => s.reservations)
  const users = useDB((s) => s.users)
  const myRes = useMemo(() => Object.values(resv).find((r) => r.roomId === roomId && r.userId === me.id && (r.status === 'booked' || r.status === 'done')), [resv, roomId, me.id])
  if (!room || !myRes) return <Navigate to="/lobby" replace />
  return <Live key={room.id} roomId={room.id} me={me} myRes={myRes} resAll={resv} users={users} />
}

interface LiveProps { roomId: string; me: User; myRes: Reservation; resAll: Record<string, Reservation>; users: Record<string, User> }

function Live({ roomId, me, myRes, resAll, users }: LiveProps) {
  const nav = useNavigate()
  const room = useDB((s) => s.rooms[roomId])!
  const settings = useSettings()
  const bus = getBus(roomId)
  const events = useBusEvents(roomId)
  const D = useMemo(() => derive(events), [events])
  const t = useNow(250)
  const myRole = myRes.role

  /* ---- 참가자 ---- */
  const parts = useMemo(() => {
    const list = Object.values(resAll).filter((r) => r.roomId === roomId && (r.status === 'booked' || r.status === 'done'))
    const ee = list.filter((r) => r.role === 'interviewee'), er = list.filter((r) => r.role === 'interviewer')
    return { ee, er, all: list }
  }, [resAll, roomId])
  const humanOf = (r: Reservation) => !users[r.userId]?.bot
  const present = (r: Reservation) => {
    const u = users[r.userId]
    if (!u) return false
    if (u.bot) return !room.botNoShow || !!r.attended
    if (r.userId === me.id) return true
    const hb = D.hb[r.userId]
    return !!hb && t - hb.t < 9000
  }
  // 리더: 현재 접속한 사람 중 가장 앞 userId (봇 구동·단계 전환 담당)
  const humansHere = parts.all.filter((r) => humanOf(r) && present(r)).map((r) => r.userId).sort()
  const leader = humansHere[0] === me.id

  /* ---- 존재 신호 ---- */
  useEffect(() => {
    const send = () => bus.emit(me.id, 'hb', { role: myRole, where: 'interview' })
    send()
    const id = setInterval(send, 3000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { useDB.getState().patchRes(myRes.id, { attended: true }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- 1) 인원 확인 (게이트) ---- */
  const [gateAt] = useState(() => Math.max(now(), room.startAt) + 2500)
  const eePresent = parts.ee.filter(present), erPresent = parts.er.filter(present)
  useEffect(() => {
    if (!leader || D.gate !== undefined || t < gateAt) return
    bus.emit(me.id, 'gate', { ok: eePresent.length >= 1 && erPresent.length >= 1 })
  }, [t, leader, D.gate]) // eslint-disable-line react-hooks/exhaustive-deps

  // 재매칭
  const [recruiting, setRecruiting] = useState(false)
  useEffect(() => {
    if (D.gate !== false || D.rematch !== undefined) return
    if (D.recruitAt && leader) {
      const wait = 12_000
      if (t - D.recruitAt > wait) {
        const mode = settings.rematch
        const okk = mode === 'success' || (mode === 'random' && Math.random() < 0.5)
        if (okk) {
          const needRole: Role = eePresent.length < 1 ? 'interviewee' : 'interviewer'
          useDB.getState().addBotTo(roomId, needRole)
          bus.emit(me.id, 'rematch', { ok: true })
          bus.emit(me.id, 'gate', { ok: true })
        } else bus.emit(me.id, 'rematch', { ok: false })
      }
    }
  }, [t, D.gate, D.recruitAt, D.rematch, leader]) // eslint-disable-line react-hooks/exhaustive-deps

  // 취소 처리
  const cancelled = useRef(false)
  useEffect(() => {
    if (D.rematch === false && !cancelled.current) {
      cancelled.current = true
      const db = useDB.getState()
      db.cancel(myRes.id, true)
      db.notify(me.id, '인원이 모자라 면접이 취소됐어요.' + (myRole === 'interviewee' ? ' 면접권 1장을 돌려드렸어요.' : ''), '/lobby', 'warn')
    }
  }, [D.rematch]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- 2) 카운트다운 → 입장 → 착석 → 라이브 ---- */
  useEffect(() => {
    if (D.gate && !D.cdAt && leader) bus.emit(me.id, 'cd', { len: settings.countdownSec })
  }, [D.gate, D.cdAt, leader]) // eslint-disable-line react-hooks/exhaustive-deps
  const cdLeft = D.cdAt ? D.cdLen * 1000 - (t - D.cdAt) : null
  useEffect(() => {
    if (D.cdAt && cdLeft !== null && cdLeft <= 0 && !D.entered && leader) bus.emit(me.id, 'enter')
  }, [cdLeft, D.cdAt, D.entered, leader]) // eslint-disable-line react-hooks/exhaustive-deps

  // 봇은 자동 착석, 면접관은 자동으로 앉은채 시작
  useEffect(() => {
    const en = D.entered
    if (!en || !leader) return
    parts.all.forEach((r) => {
      if (D.sat[r.userId]) return
      const u = users[r.userId]
      if (u?.bot && present(r)) { if (t - en > 2200) bus.emit(r.userId, 'sit') }
      else if (r.role === 'interviewer' && present(r) && t - en > 3000) bus.emit(r.userId, 'sit')
    })
  }, [t, D.entered, leader]) // eslint-disable-line react-hooks/exhaustive-deps
  // 면접자가 1분 안에 앉지 않으면 자동 착석
  useEffect(() => {
    const en = D.entered
    if (!en || !leader) return
    parts.ee.forEach((r) => { if (!D.sat[r.userId] && present(r) && t - en > 60_000) bus.emit(r.userId, 'sit') })
  }, [t, D.entered, leader]) // eslint-disable-line react-hooks/exhaustive-deps

  const allSat = parts.all.filter(present).every((r) => D.sat[r.userId])
  /** 면접관이 쓴 커스텀 질문. 없으면 자소서를 바탕으로 한 제안 질문을 써요. */
  const customFor = useCallback((eeId: string): CustomQuestion[] => {
    const mine = (room.custom[eeId] ?? []).filter((q) => q.text.trim())
    if (mine.length) return mine
    const u = users[eeId]
    if (!u?.resume) return []
    return CUSTOM_TEMPLATES.map((f) => f(u.resume!)).filter((g): g is { text: string; intent: string } => !!g).slice(0, 2)
      .map((g, i) => ({ id: `auto-${eeId}-${i}`, text: g.text, intent: g.intent, by: 'auto' }))
  }, [room.custom, users])
  const hasCustom = useMemo(() => parts.ee.some((r) => customFor(r.userId).length > 0), [parts.ee, customFor])
  useEffect(() => {
    if (!D.entered || D.live || !allSat || !leader) return
    bus.emit(me.id, 'live', { at: now() + 1200, partMs: settings.partMin * MIN, hasCustom })
  }, [allSat, D.entered, D.live, leader]) // eslint-disable-line react-hooks/exhaustive-deps

  const ph = D.live ? phaseAt(D.live, t) : null
  useEffect(() => { if (D.live && ph && ph.part === 0 && t >= D.live.at && !D.ended && leader) bus.emit(me.id, 'end') }, [ph?.part, D.live, leader]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- 사람 면접관 유무 ---- */
  const humanEr = parts.er.filter((r) => humanOf(r) && present(r))
  const botMode = humanEr.length === 0
  const humanEe = parts.ee.filter((r) => humanOf(r) && present(r))

  /* ---- 출연자 ---- */
  const people: Person[] = useMemo(() => {
    const mk = (r: Reservation, idx: number): Person => {
      const u = users[r.userId]
      return { id: r.userId, name: u?.nickname ?? '?', avatar: (r.role === 'interviewer' && r.skin ? r.skin : u?.avatar ?? 'boy') as AvatarId, role: r.role, idx, seated: !!D.sat[r.userId], speaking: !!D.speaking[r.userId]?.on && t - D.speaking[r.userId].t < 2500, me: r.userId === me.id }
    }
    return [...parts.ee.filter(present).map(mk), ...parts.er.filter(present).map(mk)]
  }, [parts, users, D.sat, D.speaking, t]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- 질문하기 / 답변 ---- */
  const asks = D.asks
  const lastAsk = asks.at(-1)
  const askedIds = new Set(asks.map((a) => a.qid).filter(Boolean))
  const [mode3d, setMode3d] = useState<'iso' | 'fpv'>('iso')
  useEffect(() => { if (D.live) { const id = setTimeout(() => setMode3d('fpv'), 700); return () => clearTimeout(id) } }, [!!D.live])

  const ask = useCallback((by: string, to: string, q: { qid?: string; text: string; intent: string; direction: string; tag?: string }, kind: Ask['kind'], part: 1 | 2 | 3) => {
    bus.emit(by, 'ask', { id: uid('a'), to, kind, part, ...q })
  }, [bus])

  // 봇 면접관 구동
  const lastBotAsk = useRef(0)
  const speechAt = useRef(0)
  useEffect(() => {
    if (!D.live || !ph || ph.part === 0 || !botMode || !leader || t < D.live.at) return
    const sinceAsk = lastAsk ? t - lastAsk.t : Infinity
    const answered = lastAsk ? (D.answers[lastAsk.id] ?? '').length : 0
    const quiet = speechAt.current && t - speechAt.current > 3500
    const eeRes = humanEe[0] ?? parts.ee.filter(present)[0]
    if (!eeRes) return
    const need = !lastAsk || (lastAsk.part !== ph.part) || (sinceAsk > 9000 && answered > 8 && quiet) || sinceAsk > 55_000 || (sinceAsk > 9000 && !humanEe.length && answered > 20)
    if (!need || t - lastBotAsk.current < 4000) return
    lastBotAsk.current = t
    const erId = parts.er.filter(present)[0]?.userId ?? parts.er[0].userId
    const to = eeRes.userId
    let q: Question | null = null, kind: Ask['kind'] = 'common'
    if (ph.part === 3 && lastAsk && lastAsk.part === 3 && (D.answers[lastAsk.id] ?? '').length > 12 && lastAsk.kind !== 'followup') {
      const f = FOLLOWUPS[seedOf(lastAsk.id) % FOLLOWUPS.length]
      q = { id: 'fu', tag: '꼬리', text: f, intent: '답변을 더 깊게 확인하는 꼬리질문이에요.', direction: '방금 한 말의 근거와 내 역할을 구체적으로 보충해요.' }
      kind = 'followup'
    } else if (ph.part === 2 && customFor(to).length) {
      const cq = customFor(to).find((c) => !askedIds.has(c.id))
      if (cq) { q = { id: cq.id, tag: '경험', text: cq.text, intent: cq.intent, direction: '질문에 나온 경험을 상황·행동·결과로 풀어서 답해요.' }; kind = 'custom' }
    }
    if (!q) {
      const pool = ph.part === 3 ? FREE_SUGGESTIONS.filter((x) => !askedIds.has(x.id)) : shuffle(COMMON_QUESTIONS, seedOf(roomId)).filter((x) => !askedIds.has(x.id))
      q = pool[0] ?? shuffle(COMMON_QUESTIONS, seedOf(roomId + 'x')).find((x) => !askedIds.has(x.id)) ?? COMMON_QUESTIONS[0]
      kind = ph.part === 3 ? 'free' : 'common'
    }
    ask(erId, to, { qid: q.id, text: q.text, intent: q.intent, direction: q.direction, tag: q.tag }, kind, ph.part as 1 | 2 | 3)
  }, [t, D.live, ph?.part, botMode, leader]) // eslint-disable-line react-hooks/exhaustive-deps

  // 새 질문이 오면 봇 면접관이 소리 내어 질문(TTS), 봇 면접자는 답변을 흘려 보내요
  const spoken = useRef<string>('')
  useEffect(() => {
    if (!lastAsk || spoken.current === lastAsk.id) return
    spoken.current = lastAsk.id
    const askerIsBot = !!users[lastAsk.by]?.bot
    if (askerIsBot && myRole === 'interviewee') {
      bus.emit(lastAsk.by, 'spk', { on: true })
      speak(lastAsk.text, () => bus.emit(lastAsk.by, 'spk', { on: false }))
    }
  }, [lastAsk?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const botEeAnswered = useRef<string>('')
  useEffect(() => {
    if (!lastAsk || !leader || botEeAnswered.current === lastAsk.id) return
    const target = users[lastAsk.to]
    if (!target?.bot) return
    botEeAnswered.current = lastAsk.id
    const text = BOT_ANSWERS[seedOf(lastAsk.id) % BOT_ANSWERS.length]
    const words = text.split(' ')
    let i = 0
    bus.emit(lastAsk.to, 'spk', { on: true })
    const id = setInterval(() => {
      const chunk = words.slice(i, i + 3).join(' ')
      i += 3
      bus.emit(lastAsk.to, 'ans', { askId: lastAsk.id, text: chunk })
      if (i >= words.length) { clearInterval(id); bus.emit(lastAsk.to, 'spk', { on: false }) }
    }, 1300)
    return () => clearInterval(id)
  }, [lastAsk?.id, leader]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeak(), [])

  /* ---- 내 음성(면접자): STT + 녹음 + 발화 신호 ---- */
  const iAmEe = myRole === 'interviewee'
  const live = !!D.live && !!ph && ph.part !== 0 && t >= (D.live?.at ?? 0)
  const { mic, state: micState, level } = useMic(D.entered !== undefined)
  const [muted, setMuted] = useState(false)
  const stt = useRef<ReturnType<typeof createSTT> | null>(null)
  const rec = useRef<Recorder | null>(null)
  const markRef = useRef<{ qid: string; t: number }[]>([])
  const lastAskRef = useRef<Ask | undefined>(undefined)
  lastAskRef.current = lastAsk
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!live || !iAmEe || muted || micState !== 'ready' || !sttSupported()) return
    stt.current = createSTT((fin) => {
      const a = lastAskRef.current
      if (fin && a && a.to === me.id) { bus.emit(me.id, 'ans', { askId: a.id, text: fin.trim() }); speechAt.current = now() }
    })
    stt.current.start()
    return () => stt.current?.stop()
  }, [live, iAmEe, muted, micState]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!live || !iAmEe || !myRes.record || micState !== 'ready' || rec.current || !mic.current) return
    rec.current = startRecording(mic.current.stream)
  }, [live, iAmEe, micState]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (lastAsk && lastAsk.to === me.id && rec.current) markRef.current.push({ qid: lastAsk.id, t: (Date.now() - rec.current.startedAt) / 1000 })
  }, [lastAsk?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // 발화 신호 (소리가 날 때만, 0.8초 간격)
  const sp = useRef(false)
  useEffect(() => {
    if (!live || muted) return
    const on = level > 0.16
    if (on) speechAt.current = now()
    if (on !== sp.current || (on && Math.random() < 0.2)) { sp.current = on; bus.emit(me.id, 'spk', { on }) }
  }, [level, live, muted]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- 착석 ---- */
  const [arrived, setArrived] = useState<Record<string, boolean>>({})
  const sat = !!D.sat[me.id]
  const canSit = !!arrived[me.id] && !sat
  const sit = () => { if (!sat) bus.emit(me.id, 'sit') }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Space' && canSit && !(e.target as HTMLElement)?.closest('button,input,textarea')) { e.preventDefault(); sit() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const [sitLeft, setSitLeft] = useState(60)
  useEffect(() => { if (D.entered) setSitLeft(Math.max(0, 60 - Math.floor((t - D.entered) / 1000))) }, [t, D.entered])

  /* ---- 종료 처리: 기록 저장 ---- */
  const saved = useRef(false)
  useEffect(() => {
    if (!D.ended || saved.current) return
    saved.current = true
    stopSpeak(); stt.current?.stop()
    const liveAt = D.live?.at ?? D.ended
    const qa: QA[] = D.asks.filter((a) => (iAmEe ? a.to === me.id : a.by === me.id)).map((a) => ({
      id: a.id, qid: a.qid, text: a.text, intent: a.intent, direction: a.direction, kind: a.kind, part: a.part, tag: a.tag, to: a.to, by: a.by, answer: D.answers[a.id] ?? '', t0: a.t - liveAt,
    }))
    const finish = async () => {
      let hasRec = false
      if (rec.current) { const blob = await rec.current.stop(); await idbPut(`${roomId}:${me.id}`, { blob, marks: markRef.current }); hasRec = true }
      const record: InterviewRecord = {
        id: uid('rec'), roomId, userId: me.id, role: myRole, at: now(), startAt: room.startAt, layout: room.layout, qa, hasRecording: hasRec,
        peers: parts.all.filter((r) => r.userId !== me.id).map((r) => ({ userId: r.userId, role: r.role })),
      }
      useDB.getState().saveRecord(record)
      useDB.getState().patchRes(myRes.id, { status: 'done' })
      useDB.getState().recompute(me.id)
    }
    void finish()
  }, [D.ended]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- 화면 분기 ---- */
  if (D.rematch === false) {
    return (
      <Modal open title="면접이 취소됐어요" dismissible={false} footer={<Btn onClick={() => nav('/lobby', { replace: true })}>로비로</Btn>}>
        모집 알림을 보냈지만 같은 방에 함께할 참가자가 모이지 않았어요. {myRole === 'interviewee' ? '사용한 면접권 1장은 돌려드렸어요.' : '다음 방에서 만나요.'}
      </Modal>
    )
  }
  if (D.gate === false) {
    return (
      <div className="min-h-dvh bg-cream grid place-items-center p-5">
        <div className="max-w-md w-full bg-paper border border-line rounded-[28px] shadow-soft p-6 text-center">
          <F code="인원 미달 안내 모달" className="mb-2 inline-block" />
          <div className="text-5xl">🪑</div>
          <h1 className="mt-3 text-[22px] font-extrabold">아직 인원이 모자라요</h1>
          <p className="mt-2 text-ink2 text-[15px]">면접은 <b>면접자 1명 + 면접관 1명</b>이 있어야 시작해요. {!eePresent.length ? '면접자' : '면접관'}가 아직 도착하지 않았어요.</p>
          {!D.recruitAt ? (
            <div className="mt-5 flex gap-2 justify-center flex-wrap">
              <Btn v="soft" onClick={() => { bus.emit(me.id, 'rematch', { ok: false }) }}>나가기 (면접 취소)</Btn>
              <Btn onClick={() => { bus.emit(me.id, 'recruit'); setRecruiting(true) }}>모집 알림 보내고 기다리기</Btn>
            </div>
          ) : (
            <div className="mt-5">
              <div className="mx-auto h-10 w-10 rounded-full border-4 border-brand border-t-transparent animate-spin" />
              <p className="mt-3 text-[14px] text-ink2">모집 알림을 보냈어요. 먼저 오는 분과 선착순으로 다시 맞춰요… <b className="tabular-nums">{Math.max(0, 12 - Math.floor((t - D.recruitAt) / 1000))}초</b></p>
              <div className="mt-4"><Btn v="soft" onClick={() => bus.emit(me.id, 'rematch', { ok: false })}>나가기</Btn></div>
            </div>
          )}
          {recruiting && null}
        </div>
      </div>
    )
  }
  if (D.gate === undefined) {
    return <div className="min-h-dvh grid place-items-center bg-cream"><div className="text-center"><div className="mx-auto h-10 w-10 rounded-full border-4 border-brand border-t-transparent animate-spin" /><p className="mt-3 font-semibold">참가자를 확인하는 중…</p></div></div>
  }
  if (D.cdAt && !D.entered) {
    return (
      <div className="min-h-dvh grid place-items-center bg-espresso text-white p-5 text-center">
        <div>
          <F code="카운트다운" className="mb-3 inline-block" />
          <p className="text-cream/70">면접이 곧 시작돼요</p>
          <div className="text-[120px] sm:text-[160px] leading-none font-extrabold tabular-nums text-brand-l" aria-live="assertive">{Math.max(1, Math.ceil((cdLeft ?? 0) / 1000))}</div>
          <p className="text-cream/70">깊게 숨 한 번 쉬고, 자리로 이동해요.</p>
        </div>
      </div>
    )
  }

  const myP = people.find((p) => p.id === me.id)
  const part = ph?.part ?? 0
  const curPart = part === 0 ? 3 : part

  return (
    <div className="fixed inset-0 bg-cream overflow-hidden">
      <Suspense fallback={<div className="absolute inset-0 grid place-items-center">면접장을 여는 중…</div>}>
        <Scene people={people} mode={mode3d} meId={me.id} walk={!D.live} onArrive={(id) => setArrived((a) => ({ ...a, [id]: true }))} />
      </Suspense>

      {/* 상단 HUD: 면접 중에는 GNB를 숨겨요 */}
      <div className="absolute inset-x-0 top-0 z-20 p-3 flex items-start gap-2 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-paper/92 backdrop-blur border border-line shadow-soft px-3.5 py-2.5">
          <div className="flex items-center gap-2"><F code="F-13 면접장" /><Chip tone={myRole === 'interviewer' ? 'brand' : 'leaf'}>{myRole === 'interviewer' ? '면접관' : '면접자'}</Chip>
            {D.live && ph && ph.part !== 0 && <Chip tone="dark">{PART_NAME[part as 1 | 2 | 3]}</Chip>}</div>
          {D.live && ph ? (
            <div className="mt-1.5 flex items-baseline gap-3">
              <span className="text-[26px] font-extrabold tabular-nums leading-none">{fmtCount(ph.remain)}</span>
              <span className="text-[12px] text-ink3">전체 남은 시간 · 이 부 {fmtCount(ph.partRemain)}</span>
            </div>
          ) : <div className="mt-1 text-[13px] text-ink2 font-semibold">{D.entered ? (sat ? '다른 참가자가 앉기를 기다려요…' : '자리로 이동해 앉아요') : ''}</div>}
          {D.live && ph && ph.part !== 0 && (
            <div className="mt-2 flex gap-1" aria-label="진행 단계">
              {[1, 2, 3].map((n) => <span key={n} className={cx('h-1.5 w-12 rounded-full', ph.durs[n - 1] === 0 ? 'bg-line/40' : n < part ? 'bg-leaf' : n === part ? 'bg-brand' : 'bg-line')} />)}
            </div>
          )}
        </div>
        <div className="flex-1" />
        {D.live && <div className="pointer-events-auto flex flex-col gap-2 items-end">
          <Btn size="sm" v="soft" onClick={() => setMode3d(mode3d === 'fpv' ? 'iso' : 'fpv')}>{mode3d === 'fpv' ? '3인칭으로 보기' : '1인칭으로 보기'}</Btn>
          {iAmEe && <Btn size="sm" v={muted ? 'danger' : 'soft'} onClick={() => setMuted(!muted)} aria-pressed={muted}>{muted ? <Ico.micOff size={16} /> : <Ico.mic size={16} />}{muted ? '음소거됨' : '마이크 켜짐'}</Btn>}
        </div>}
      </div>

      {/* 입장·착석 안내 */}
      {D.entered && !D.live && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-4 safe-b flex justify-center">
          <div className="w-full max-w-md rounded-[28px] bg-paper border border-line shadow-soft p-4 text-center animate-rise">
            <p className="font-bold text-[16px]">{sat ? '앉았어요. 다른 참가자를 기다려요…' : myRole === 'interviewer' ? '면접관은 자동으로 앉아요' : canSit ? '자리 앞에 도착했어요. 앉으면 30분 면접이 시작돼요.' : '자리로 걸어가는 중…'}</p>
            {myRole === 'interviewee' && !sat && <>
              <div className="mt-2.5"><Btn size="lg" disabled={!canSit} onClick={sit}>앉기 (Space)</Btn></div>
              <p className="text-[12px] text-ink3 mt-2">{sitLeft}초 안에 앉지 않으면 자동으로 앉혀져요.</p>
            </>}
          </div>
        </div>
      )}
      {D.live && ph && t < D.live.at && <div className="absolute inset-0 z-30 grid place-items-center bg-espresso/60 text-cream text-[22px] font-extrabold">면접을 시작해요</div>}

      {/* 면접 진행 패널 */}
      {live && myRole === 'interviewee' && (
        <EePanel ask={lastAsk} answer={lastAsk ? D.answers[lastAsk.id] ?? '' : ''} level={level} micState={micState} muted={muted} botMode={botMode} part={curPart}
          onNext={() => nextBot()}
          typed={typed} setTyped={setTyped}
          onSend={() => { if (lastAsk && typed.trim()) { bus.emit(me.id, 'ans', { askId: lastAsk.id, text: typed.trim() }); speechAt.current = now(); setTyped('') } }}
          sttOk={sttSupported()} users={users} />
      )}
      {live && myRole === 'interviewer' && (
        <ErPanel part={curPart} asks={asks} answers={D.answers} users={users} parts={parts} customFor={customFor} askedIds={askedIds} me={me}
          onAsk={(to, q, kind) => ask(me.id, to, q, kind, curPart as 1 | 2 | 3)} />
      )}

      {D.ended && <EndOverlay roomId={roomId} myRole={myRole} nav={nav} />}
      {myP && null}
    </div>
  )

  // 봇 모드에서 면접자가 직접 '다음 질문 받기'를 누를 때
  function nextBot() {
    if (!ph || ph.part === 0) return
    const to = me.id
    const pool = ph.part === 3 ? FREE_SUGGESTIONS.filter((x) => !askedIds.has(x.id)) : shuffle(COMMON_QUESTIONS, seedOf(roomId)).filter((x) => !askedIds.has(x.id))
    const cq = ph.part === 2 ? customFor(to).find((c) => !askedIds.has(c.id)) : undefined
    const erId = parts.er.filter(present)[0]?.userId ?? parts.er[0].userId
    if (cq) return ask(erId, to, { qid: cq.id, text: cq.text, intent: cq.intent, direction: '질문에 나온 경험을 상황·행동·결과로 풀어서 답해요.', tag: '경험' }, 'custom', 2)
    const q = pool[0] ?? COMMON_QUESTIONS[0]
    ask(erId, to, { qid: q.id, text: q.text, intent: q.intent, direction: q.direction, tag: q.tag }, ph.part === 3 ? 'free' : 'common', ph.part as 1 | 2 | 3)
  }
}

/* ---------------- 면접자 패널 ---------------- */
function EePanel({ ask, answer, level, micState, muted, botMode, part, onNext, typed, setTyped, onSend, sttOk, users }: {
  ask?: Ask; answer: string; level: number; micState: string; muted: boolean; botMode: boolean; part: number; onNext: () => void
  typed: string; setTyped: (s: string) => void; onSend: () => void; sttOk: boolean; users: Record<string, User>
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3 safe-b flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl rounded-[28px] bg-paper/96 backdrop-blur border border-line shadow-soft overflow-hidden animate-rise">
        <button className="w-full flex items-center gap-2 px-4 pt-3 pb-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Chip tone="dark">{PART_NAME[part as 1 | 2 | 3]}</Chip>
          {ask?.tag && <Chip tone="warn">{ask.tag}</Chip>}
          {ask?.kind === 'followup' && <Chip tone="brand">꼬리질문</Chip>}
          <span className="flex-1" />
          <span className="text-[12px] text-ink3">{open ? '접기' : '펼치기'}</span>
        </button>
        {open && (
          <div className="px-4 pb-4">
            {ask ? (
              <>
                <p className="text-[19px] sm:text-[21px] font-extrabold leading-snug">{ask.text}</p>
                <div className="mt-2 text-[12px] text-ink3">질문한 면접관: {users[ask.by]?.nickname}</div>
              </>
            ) : <p className="text-[17px] font-bold text-ink2">면접관이 첫 질문을 고르고 있어요…</p>}
            <div className="mt-3 rounded-2xl bg-sand px-3.5 py-3 min-h-[64px]">
              <div className="flex items-center gap-3 mb-1.5"><span className="text-[12px] font-bold text-ink2">내 답변 (자동 기록)</span>{!muted && micState === 'ready' && <Meter level={level} className="!h-5 scale-90 origin-left" />}</div>
              <p className="text-[15px] leading-relaxed">{answer || <span className="text-ink3">{micState === 'denied' ? '마이크를 쓸 수 없어요. 아래에 글자로 답해 주세요.' : sttOk ? '말씀하시면 여기에 기록돼요…' : '이 브라우저는 음성 인식을 지원하지 않아요. 아래에 글자로 답해 주세요.'}</span>}</p>
            </div>
            <div className="mt-2.5 flex gap-2">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSend() }} placeholder="직접 입력해서 답할 수도 있어요" className="flex-1 h-11 rounded-2xl border border-line bg-white px-4 text-[14px]" />
              <Btn size="md" v="soft" onClick={onSend} disabled={!typed.trim()}>보내기</Btn>
              {botMode && <Btn size="md" v="dark" onClick={onNext}>다음 질문</Btn>}
            </div>
            {botMode && <p className="text-[11.5px] text-ink3 mt-1.5">지금은 사람 면접관이 없어서 면접관 NPC가 질문해요. 답변이 끝나면 자동으로 다음 질문으로 넘어가요.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- 면접관 패널 ---------------- */
function ErPanel({ part, asks, answers, users, parts, customFor, askedIds, me, onAsk }: {
  part: number; asks: Ask[]; answers: Record<string, string>; users: Record<string, User>
  parts: { ee: Reservation[]; er: Reservation[] }; customFor: (id: string) => CustomQuestion[]; askedIds: Set<string | undefined>; me: User
  onAsk: (to: string, q: { qid?: string; text: string; intent: string; direction: string; tag?: string }, kind: Ask['kind']) => void
}) {
  const [tab, setTab] = useState<1 | 2 | 3>(part as 1 | 2 | 3)
  useEffect(() => { setTab(part as 1 | 2 | 3) }, [part])
  const ees = parts.ee
  const [target, setTarget] = useState(ees[0]?.userId ?? '')
  const [free, setFree] = useState('')
  const last = asks.at(-1)
  const [open, setOpen] = useState(true)
  const tgt = ees.find((e) => e.userId === target) ?? ees[0]
  const tgtId = tgt?.userId ?? ''
  const list: Question[] = tab === 1 ? COMMON_QUESTIONS : tab === 2
    ? customFor(tgtId).map((c) => ({ id: c.id, text: c.text, intent: c.intent, direction: '질문에 나온 경험을 상황·행동·결과로 풀어서 답해요.', tag: '경험' as const }))
    : FREE_SUGGESTIONS
  const myAsks = asks.length
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3 safe-b flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl rounded-[28px] bg-paper/96 backdrop-blur border border-line shadow-soft overflow-hidden animate-rise max-h-[44dvh] flex flex-col">
        <button className="w-full flex items-center gap-2 px-4 pt-3 pb-2 text-left shrink-0" onClick={() => setOpen(!open)} aria-expanded={open}>
          <b className="text-[15px]">질문 카드</b><Chip>지금까지 {myAsks}개 질문</Chip>
          <span className="flex-1" /><span className="text-[12px] text-ink3">{open ? '접기' : '펼치기'}</span>
        </button>
        {open && (
          <div className="px-4 pb-4 overflow-y-auto">
            {last && (
              <div className="mb-3 rounded-2xl bg-leaf-l/70 border border-leaf/20 p-3">
                <div className="text-[12px] font-bold text-leaf-d">방금 한 질문 · {users[last.to]?.nickname}에게</div>
                <div className="font-bold text-[15px] mt-0.5">{last.text}</div>
                <div className="mt-1.5 text-[14px] text-ink2"><b className="text-ink">답변</b> {answers[last.id] || <span className="text-ink3">듣는 중… (면접자의 말이 자동으로 기록돼요)</span>}</div>
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap items-center">
              {([1, 2, 3] as const).map((n) => <button key={n} onClick={() => setTab(n)} className={cx('h-9 px-3.5 rounded-full text-[13px] font-bold border', tab === n ? 'bg-espresso text-white border-espresso' : 'bg-paper border-line text-ink2', n === part && 'ring-2 ring-brand/40')}>{PART_NAME[n]}</button>)}
              {ees.length > 1 && (
                <select value={tgtId} onChange={(e) => setTarget(e.target.value)} className="h-9 rounded-full border border-line bg-white px-3 text-[13px] font-semibold ml-auto" aria-label="질문 받을 면접자">
                  {ees.map((e) => <option key={e.userId} value={e.userId}>{users[e.userId]?.nickname}에게</option>)}
                </select>
              )}
            </div>
            <p className="text-[12px] text-ink3 mt-2">카드를 누르면 면접자 화면에도 질문이 떠요. 소리 내어 질문해 주세요. 꼬리질문은 3부에서 할 수 있어요.</p>
            <div className="mt-2.5 grid sm:grid-cols-2 gap-2">
              {list.length === 0 && <div className="sm:col-span-2 text-[14px] text-ink3 bg-sand rounded-xl px-3 py-3">{tab === 2 ? '이 면접자의 커스텀 질문이 없어요. 1부 공통 질문으로 이어가요.' : '질문이 없어요.'}</div>}
              {list.map((q) => {
                const used = askedIds.has(q.id)
                return (
                  <button key={q.id} disabled={!tgtId} onClick={() => onAsk(tgtId, { qid: q.id, text: q.text, intent: q.intent, direction: q.direction, tag: q.tag }, tab === 1 ? 'common' : tab === 2 ? 'custom' : 'free')}
                    className={cx('text-left rounded-2xl border p-3 transition hover:border-brand', used ? 'bg-sand/60 border-line opacity-70' : 'bg-white border-line')}>
                    <div className="flex items-center gap-1.5 mb-1"><Chip tone={q.tag === '압박' ? 'danger' : q.tag === '황당' ? 'warn' : 'neutral'}>{q.tag}</Chip>{used && <Chip tone="leaf">질문함</Chip>}</div>
                    <div className="font-bold text-[14.5px] leading-snug">{q.text}</div>
                    <div className="mt-1 text-[12px] text-ink2 leading-snug"><b>의도</b> {q.intent}</div>
                  </button>
                )
              })}
            </div>
            {tab === 3 && (
              <div className="mt-3 rounded-2xl border border-line p-3 bg-white">
                <div className="text-[13px] font-bold mb-1.5">자유 질문 · 꼬리질문</div>
                <textarea className={cx(areaCls, '!py-2 text-[14px]')} rows={2} value={free} onChange={(e) => setFree(e.target.value)} placeholder="직접 질문을 써서 던져 보세요" />
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Btn size="sm" disabled={!free.trim() || !tgtId} onClick={() => { onAsk(tgtId, { text: free.trim(), intent: '면접관이 직접 만든 자유 질문이에요.', direction: '질문의 핵심을 먼저 말하고 근거를 이어서 설명해요.', tag: '인성' }, 'free'); setFree('') }}>자유 질문하기</Btn>
                  {FOLLOWUPS.slice(0, 4).map((f) => <Btn key={f} size="sm" v="soft" disabled={!tgtId} onClick={() => onAsk(tgtId, { text: f, intent: '답변을 더 깊게 확인하는 꼬리질문이에요.', direction: '방금 한 말의 근거와 내 역할을 구체적으로 보충해요.', tag: '꼬리' }, 'followup')}>꼬리: {f.slice(0, 12)}…</Btn>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EndOverlay({ roomId, myRole, nav }: { roomId: string; myRole: Role; nav: (p: string, o?: { replace?: boolean }) => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-espresso/70 backdrop-blur-sm p-5">
      <div className="max-w-sm w-full rounded-[28px] bg-paper p-7 text-center animate-pop shadow-soft">
        <F code="F-18 면접 종료" className="mb-2 inline-block" />
        <div className="text-5xl">🎉</div>
        <h2 className="mt-3 text-[24px] font-extrabold">면접이 끝났어요</h2>
        <p className="mt-2 text-ink2 text-[15px]">{myRole === 'interviewer' ? '수고하셨어요! 피드백을 남기면 면접권 1장을 받아요.' : '수고하셨어요! 면접관에게 좋아요를 남기고 결과를 확인해요.'}<br />피드백은 5분 안에 남겨 주세요.</p>
        <Btn size="lg" full className="mt-5" onClick={() => nav(`/feedback/${roomId}`, { replace: true })}>피드백 남기러 가기</Btn>
      </div>
    </div>
  )
}

export { hhmm, seedOf, shuffle, toast, AvatarImg }
