import { useEffect, useMemo, useRef, useState } from 'react'
import { A } from '../lib/asset'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CFG, MIN, cx, fmtCount, fmtDT, uid, useNow } from '../lib/core'
import { roomSeats, useDB, useMe } from '../lib/db'
import { AvatarImg, Btn, Card, Chip, F, Ico, Meter, Modal, areaCls, toast } from '../components/ui'
import { createSTT, sttSupported, useMic } from '../lib/media'
import { getBus } from '../lib/session'
import { CUSTOM_TEMPLATES } from '../data/questions'
import type { CustomQuestion, User } from '../types'

export default function Waiting() {
  const { resId } = useParams()
  const me = useMe()!
  const nav = useNavigate()
  const res = useDB((s) => (resId ? s.reservations[resId] : undefined))
  const room = useDB((s) => (res ? s.rooms[res.roomId] : undefined))
  const allRes = useDB((s) => s.reservations)
  const rooms = useDB((s) => s.rooms)
  const users = useDB((s) => s.users)
  const patchRes = useDB((s) => s.patchRes)
  const t = useNow(500)
  const [entered, setEntered] = useState(false)
  const [micOk, setMicOk] = useState(false)
  const [leaveWarn, setLeaveWarn] = useState(false)
  const bus = room ? getBus(room.id) : null

  const ok = !!res && !!room && res.userId === me.id && res.status === 'booked'
  const start = room?.startAt ?? 0
  const openAt = start - CFG.waitingOpenMin * MIN
  const isEr = res?.role === 'interviewer'
  const canPrep = isEr && t >= start - 60 * MIN
  const open = t >= openAt

  // 대기실 입장
  useEffect(() => { if (entered && res && !res.attended) patchRes(res.id, { attended: true }) }, [entered]) // eslint-disable-line react-hooks/exhaustive-deps
  // 존재 신호
  useEffect(() => {
    if (!entered || !bus || !res) return
    const send = () => bus.emit(me.id, 'hb', { role: res.role, where: 'waiting' })
    send()
    const id = setInterval(send, 3000)
    return () => clearInterval(id)
  }, [entered, bus, res?.role]) // eslint-disable-line react-hooks/exhaustive-deps
  // 나갈 수 없어요
  useEffect(() => {
    if (!entered) return
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [entered])
  // 시작 시각이 되면 면접장으로
  useEffect(() => { if (entered && t >= start && room) nav(`/interview/${room.id}`, { replace: true }) }, [entered, t >= start]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ok || !room || !res) return <Navigate to="/records?tab=calendar" replace />
  const seats = roomSeats({ rooms, reservations: allRes }, room.id)
  const left = start - t
  const late = t >= start && t < start + 3 * MIN

  return (
    <div className="min-h-dvh bg-cream">
      <header className="h-14 border-b border-line bg-cream/90 backdrop-blur sticky top-0 z-30">
        <div className="w-full h-full px-4 sm:px-8 flex items-center gap-3">
          <img src={A('favicon.svg')} alt="" className="h-7 w-7" />
          <b className="text-[16px]">대기실</b>
          <F code="F-12 대기실 입장" />
          <div className="flex-1" />
          {entered && <Chip tone="warn"><Ico.lock size={13} /> 중간에 나갈 수 없어요</Chip>}
          <Chip tone="dark" className="tabular-nums">{left > 0 ? `시작까지 ${fmtCount(left)}` : '시작 시각이에요'}</Chip>
        </div>
      </header>

      <div className="w-full px-4 sm:px-8 py-5 grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-4 min-w-0">
          <Card className="p-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone={isEr ? 'brand' : 'leaf'}>{isEr ? '면접관' : '면접자'}</Chip>
              <Chip tone="dark">면접자 {seats.cap.ee} : 면접관 {seats.cap.er}</Chip>
              <span className="text-[14px] text-ink2">{fmtDT(start)} 시작 · 총 30분</span>
            </div>
            {!entered && (
              <div className="mt-4">
                {!open && !late ? (
                  <div className="rounded-2xl bg-sand p-4 text-[14px]">
                    <b className="text-ink">대기실은 시작 {CFG.waitingOpenMin}분 전에 열려요.</b> 열리기까지 <span className="tabular-nums font-bold">{fmtCount(openAt - t)}</span> 남았어요.
                    {isEr && (canPrep ? ' 면접 1시간 전이 지나서 지금부터 자소서를 열람하고 커스텀 질문을 쓸 수 있어요.' : ' 면접 1시간 전부터 자소서 열람과 커스텀 질문 작성이 시작돼요.')}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-[14px] text-ink2 flex-1 min-w-[220px]">대기실에 들어오면 <b>중간에 나갈 수 없어요.</b> 들어가서 마이크를 확인하고 면접을 준비해요.</p>
                    <Btn v="leaf" size="lg" onClick={() => setEntered(true)}>대기실 입장</Btn>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 마이크 체크 (전원) */}
          {entered && <MicCheck onOk={() => setMicOk(true)} ok={micOk} />}

          {/* 면접자: 녹음 여부 + NPC */}
          {entered && !isEr && (
            <>
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-1"><h3 className="font-bold text-[17px]">답변 녹음</h3><Chip>선택 사항</Chip></div>
                <p className="text-[14px] text-ink2">내 답변을 녹음해 두면 면접 뒤에 질문카드 보관함에서 다시 들어볼 수 있어요. 녹음은 이 기기에만 저장되고, 상대에게는 공유되지 않아요.</p>
                <label className="mt-3 flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 cursor-pointer">
                  <input type="checkbox" className="h-5 w-5 accent-[#c24e1a]" checked={res.record} onChange={(e) => patchRes(res.id, { record: e.target.checked })} />
                  <span className="font-semibold text-[15px]">내 답변을 녹음할게요</span>
                </label>
              </Card>
              <NpcWarmup />
            </>
          )}

          {/* 면접관: 자소서 열람 + 커스텀 질문 */}
          {isEr && (entered || canPrep) && <Prep roomId={room.id} />}
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h3 className="font-bold mb-2">같은 방 참가자</h3>
            <div className="space-y-2">
              {[...seats.ee.map((r) => ({ r, tag: '면접자' })), ...seats.er.map((r) => ({ r, tag: '면접관' }))].map(({ r, tag }) => {
                const u = users[r.userId]
                if (!u) return null
                const hb = bus?.snapshot().filter((e) => e.type === 'hb' && e.by === u.id).at(-1)
                const here = u.bot ? !room.botNoShow : !!hb && t - hb.t < 9000
                return (
                  <div key={r.id} className="flex items-center gap-2.5">
                    <AvatarImg id={r.role === 'interviewer' && r.skin ? r.skin : u.avatar} size={38} bg="#f2e9db" />
                    <div className="min-w-0 flex-1"><div className="font-semibold text-[14px] truncate">{u.nickname}{u.id === me.id && ' (나)'}</div><div className="text-[12px] text-ink3">{tag}{u.bot ? ' · 대기실 도착' : ''}</div></div>
                    <span className={cx('h-2.5 w-2.5 rounded-full', here ? 'bg-leaf' : 'bg-line')} aria-label={here ? '입장함' : '아직 안 왔어요'} />
                  </div>
                )
              })}
              {Array.from({ length: Math.max(0, seats.cap.ee - seats.ee.length) + Math.max(0, seats.cap.er - seats.er.length) }).map((_, i) => (
                <div key={'e' + i} className="flex items-center gap-2.5 text-ink3 text-[13px]"><span className="h-[38px] w-[38px] rounded-xl border-2 border-dashed border-line grid place-items-center">+</span>빈 자리</div>
              ))}
            </div>
            <p className="text-[12px] text-ink3 mt-3">면접자 1명 + 면접관 1명만 있어도 시작해요.</p>
          </Card>
          <Card className="p-4 text-[13px] text-ink2 space-y-1.5">
            <div className="font-bold text-ink text-[14px]">안내</div>
            <p>• 시작 {CFG.waitingOpenMin}분 전에 열리고, 들어오면 중간에 나갈 수 없어요.</p>
            <p>• 모두 마이크 체크를 해요. 직접 말해보고 입력이 되는지 확인해요.</p>
            <p>• 시작 시각이 되면 자동으로 면접장으로 이동해요.</p>
          </Card>
          {entered && <Btn v="ghost" full onClick={() => setLeaveWarn(true)}>나가고 싶어요</Btn>}
        </aside>
      </div>

      {late && !entered && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4 safe-b"><div className="mx-auto max-w-md rounded-[28px] bg-paper border border-line shadow-soft p-4 flex items-center gap-3"><div className="flex-1 text-[14px]">면접이 막 시작됐어요. 지금 바로 입장할 수 있어요.</div><Btn onClick={() => { setEntered(true); nav(`/interview/${room.id}`) }}>바로 입장</Btn></div></div>
      )}

      <Modal open={leaveWarn} onClose={() => setLeaveWarn(false)} title="대기실에서는 나갈 수 없어요"
        footer={<Btn onClick={() => setLeaveWarn(false)}>계속 대기할게요</Btn>}>
        대기실에 들어온 뒤에는 중간에 나갈 수 없어요. 면접자와 면접관이 서로를 기다리고 있기 때문이에요. 정말 참여할 수 없다면, 다음부터는 면접 1시간 전까지 예약을 취소해 주세요.
      </Modal>
    </div>
  )
}

/* ---------------- 마이크 체크 ---------------- */
function MicCheck({ ok, onOk }: { ok: boolean; onOk: () => void }) {
  const { state, level } = useMic(true)
  const [heard, setHeard] = useState('')
  const [loud, setLoud] = useState(0)
  const [textMode, setTextMode] = useState(false)
  const [typed, setTyped] = useState('')
  const stt = useRef<ReturnType<typeof createSTT> | null>(null)
  const supported = sttSupported()

  useEffect(() => { if (level > 0.14) setLoud((n) => Math.min(n + 1, 40)) }, [level])
  useEffect(() => {
    if (state !== 'ready' || !supported) return
    stt.current = createSTT((f, i) => setHeard((h) => (f ? (h + ' ' + f).trim() : h) || i), () => undefined)
    stt.current.start()
    return () => stt.current?.stop()
  }, [state, supported])
  const passed = ok || (state === 'ready' && loud >= 8 && (!supported || heard.length >= 2)) || (textMode && typed.trim().length >= 2)
  useEffect(() => { if (passed && !ok) onOk() }, [passed]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1"><h3 className="font-bold text-[17px]">마이크 체크</h3><Chip tone="neutral">전원 필수</Chip>{passed && <Chip tone="leaf"><Ico.check size={13} /> 확인됐어요</Chip>}</div>
      {state === 'denied' || textMode ? (
        <div className="mt-2 space-y-2">
          <p className="text-[14px] text-warn bg-warn-l rounded-xl px-3 py-2">{state === 'denied' ? '마이크를 사용할 수 없어요. 브라우저 주소창의 마이크 권한을 허용하거나, 글자로 답변하는 방식으로 진행할 수 있어요.' : '글자로 답변하는 방식이에요.'}</p>
          <input className="w-full h-12 rounded-2xl border border-line bg-white px-4" placeholder="여기에 “안녕하세요”라고 입력해 보세요" value={typed} onChange={(e) => { setTextMode(true); setTyped(e.target.value) }} />
        </div>
      ) : (
        <>
          <p className="text-[14px] text-ink2 mt-1">직접 소리 내어 말해보고, 입력이 잘 되는지 확인해요.</p>
          <div className="mt-3 rounded-2xl bg-sand p-4">
            <div className="text-[13px] text-ink2 mb-2">아래 문장을 읽어 보세요</div>
            <div className="text-[18px] font-bold">“안녕하세요, 잘 부탁드립니다.”</div>
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              <Meter level={level} />
              <div className="text-[13px] text-ink2">{state === 'idle' ? '마이크를 여는 중…' : loud >= 8 ? '목소리가 잘 들려요' : '말씀해 보세요'}</div>
            </div>
            {supported && <div className="mt-2.5 text-[14px] min-h-[1.5em]"><span className="text-ink3">인식된 말: </span><b>{heard || '…'}</b></div>}
          </div>
          <div className="mt-2.5 flex gap-2 flex-wrap">
            {!passed && state === 'ready' && loud >= 8 && <Btn size="sm" v="soft" onClick={onOk}>잘 들리는 것 같아요</Btn>}
            <Btn size="sm" v="ghost" onClick={() => setTextMode(true)}>마이크 없이 진행</Btn>
          </div>
          <p className="text-[12px] text-ink3 mt-2">음성 인식은 브라우저(Chrome 등)의 기능을 써요. 브라우저에 따라 음성이 인식을 위해 서버로 전송될 수 있어요.</p>
        </>
      )}
    </Card>
  )
}

/* ---------------- 면접자: NPC와 면접 준비 ---------------- */
function NpcWarmup() {
  const [on, setOn] = useState(false)
  const { state } = useMic(on)
  const [txt, setTxt] = useState('')
  const stt = useRef<ReturnType<typeof createSTT> | null>(null)
  useEffect(() => {
    if (!on || state !== 'ready' || !sttSupported()) return
    stt.current = createSTT((f, i) => setTxt((h) => (f ? (h + ' ' + f).trim() : h) || i))
    stt.current.start()
    return () => stt.current?.stop()
  }, [on, state])
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-2"><h3 className="font-bold text-[17px]">NPC와 면접 준비</h3><Chip>선택 사항</Chip></div>
      <div className="flex items-start gap-3">
        <AvatarImg id="man" size={64} bg="#f2e9db" />
        <div className="flex-1">
          <div className="inline-block rounded-2xl rounded-tl-sm bg-sand px-4 py-3 text-[15px] font-semibold">긴장 풀 겸 연습해 볼까요? “오늘 가장 기대되는 질문이 뭐예요?”에 한 문장으로 답해 보세요.</div>
          {!on ? <div className="mt-3"><Btn size="sm" v="soft" onClick={() => setOn(true)}><Ico.mic size={16} /> 말로 연습해 보기</Btn></div> : (
            <div className="mt-3 rounded-2xl border border-line bg-white p-3 text-[14px] min-h-16">
              {txt || <span className="text-ink3">{state === 'denied' ? '마이크를 쓸 수 없어요.' : '말씀해 보세요…'}</span>}
              <div className="mt-2"><Btn size="sm" v="ghost" onClick={() => { setOn(false); setTxt('') }}>그만하기</Btn></div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ---------------- 면접관: 자소서 열람 + 커스텀 질문 작성(F-11) ---------------- */
function Prep({ roomId }: { roomId: string }) {
  const me = useMe()!
  const room = useDB((s) => s.rooms[roomId])
  const resv = useDB((s) => s.reservations)
  const users = useDB((s) => s.users)
  const setCustom = useDB((s) => s.setCustom)
  const finish = useDB((s) => s.finishCustom)
  const ees = useMemo(() => Object.values(resv).filter((r) => r.roomId === roomId && r.status === 'booked' && r.role === 'interviewee').map((r) => users[r.userId]).filter(Boolean) as User[], [resv, roomId, users])
  const done = !!room?.customDone[me.id]
  const any = ees.some((e) => e.resume)
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1 flex-wrap"><h3 className="font-bold text-[17px]">자소서 열람 · 커스텀 질문 작성</h3><F code="F-11" />{done && <Chip tone="leaf"><Ico.check size={13} /> 마무리됨</Chip>}</div>
      <p className="text-[14px] text-ink2">참여 면접자의 자소서·이력을 보고 2부 질문을 직접 써요. 면접 시작 전까지 쓸 수 있고, 꼬리질문은 3부에서 할 수 있어요.</p>
      {ees.length === 0 && <p className="mt-3 text-[14px] text-ink3 bg-sand rounded-xl px-3 py-3">아직 면접자가 없어요. 면접자가 예약하면 이곳에 나타나요.</p>}
      {!any && ees.length > 0 && <p className="mt-3 text-[14px] bg-warn-l text-warn rounded-xl px-3 py-2.5">참여 면접자의 자소서가 없어요. 열람을 건너뛰고, <b>2부는 공통 질문으로 진행</b>해요.</p>}
      <div className="mt-4 space-y-4">
        {ees.map((u) => {
          const mine = (room?.custom[u.id] ?? []).filter((q) => q.by === me.id)
          const others = (room?.custom[u.id] ?? []).filter((q) => q.by !== me.id)
          const save = (list: CustomQuestion[]) => setCustom(roomId, u.id, [...others, ...list])
          return (
            <div key={u.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-center gap-2.5"><AvatarImg id={u.avatar} size={40} bg="#f2e9db" /><div><div className="font-bold">{u.nickname}</div><div className="text-[12px] text-ink3">{u.resume ? u.resume.job : '자소서 미등록'}</div></div></div>
              {u.resume ? (
                <div className="mt-3 rounded-xl bg-sand p-3 text-[14px] space-y-1.5">
                  <div><b className="text-ink2">자기소개</b> {u.resume.intro || '—'}</div>
                  <div><b className="text-ink2">이력</b> {u.resume.career || '—'}</div>
                </div>
              ) : <p className="mt-2 text-[13px] text-ink3">열람할 내용이 없어서 건너뛰어요. 이 면접자의 2부는 공통 질문으로 진행돼요.</p>}
              {u.resume && (
                <div className="mt-3 space-y-2">
                  {mine.map((q) => (
                    <div key={q.id} className="flex gap-2 items-start">
                      <textarea className={cx(areaCls, '!py-2 text-[14px]')} rows={2} disabled={done} value={q.text} onChange={(e) => save(mine.map((x) => (x.id === q.id ? { ...x, text: e.target.value } : x)))} />
                      <button disabled={done} aria-label="질문 삭제" className="h-10 w-10 rounded-xl hover:bg-sand grid place-items-center text-ink3 shrink-0" onClick={() => save(mine.filter((x) => x.id !== q.id))}><Ico.x size={18} /></button>
                    </div>
                  ))}
                  {!done && mine.length < 3 && (
                    <div className="flex gap-2 flex-wrap">
                      <Btn size="sm" v="soft" onClick={() => save([...mine, { id: uid('cq'), text: '', intent: '자소서 내용의 구체적인 근거와 본인 기여도를 확인해요.', by: me.id }])}>＋ 질문 직접 쓰기</Btn>
                      {CUSTOM_TEMPLATES.map((f, i) => {
                        const g = f(u.resume!)
                        return g && mine.length < 3 ? <Btn key={i} size="sm" v="ghost" onClick={() => save([...mine, { id: uid('cq'), text: g.text, intent: g.intent, by: me.id }])}>제안 {i + 1} 넣기</Btn> : null
                      })}
                    </div>
                  )}
                  <p className="text-[12px] text-ink3">면접자 1명당 최대 3개 · 질문은 2부에서 질문 카드로 나와요.</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <Btn v={done ? 'soft' : 'leaf'} disabled={done} onClick={() => {
          // 빈 질문은 정리
          ees.forEach((u) => { const l = (useDB.getState().rooms[roomId]?.custom[u.id] ?? []).filter((q) => q.text.trim()); setCustom(roomId, u.id, l) })
          finish(roomId, me.id); toast('커스텀 질문을 마무리했어요.', 'ok')
        }}>{done ? '마무리했어요' : '커스텀 질문 마무리'}</Btn>
        {!done && <span className="text-[12px] text-ink3">마무리하지 않아도 면접 시작 시 쓴 질문은 그대로 쓰여요.</span>}
      </div>
    </Card>
  )
}
