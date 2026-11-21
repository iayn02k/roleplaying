import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { A } from '../lib/asset'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CFG, MIN, cx, fmtCount, fmtDT, now, seedOf, useNow } from '../lib/core'
import { useDB, useMe } from '../lib/db'
import { AvatarImg, Btn, Card, Chip, F, Ico, areaCls, toast } from '../components/ui'
import { KEYWORDS } from '../data/questions'
import { PART_NAME, derive, getBus } from '../lib/session'
import { idbGet, type RecBlob } from '../lib/media'
import type { InterviewRecord, QA } from '../types'

/* ---------------- 피드백 (F-19) ---------------- */
export function Feedback() {
  const { roomId } = useParams()
  const me = useMe()!
  const nav = useNavigate()
  const room = useDB((s) => (roomId ? s.rooms[roomId] : undefined))
  const records = useDB((s) => s.records)
  const users = useDB((s) => s.users)
  const feedbacks = useDB((s) => s.feedbacks)
  const t = useNow(1000)
  const rec = records.find((r) => r.roomId === roomId && r.userId === me.id)
  const endedAt = useMemo(() => (roomId ? derive(getBus(roomId).snapshot()).ended : undefined) ?? rec?.at ?? now(), [roomId, rec?.at])
  const deadline = endedAt + CFG.feedbackMin * MIN
  const expired = t > deadline
  const already = feedbacks.some((f) => f.roomId === roomId && f.from === me.id)
  const isEr = rec?.role === 'interviewer'
  const targets = (rec?.peers ?? []).filter((p) => p.role === (isEr ? 'interviewee' : 'interviewer'))
  const [kw, setKw] = useState<Record<string, string[]>>({})
  const [cm, setCm] = useState<Record<string, string>>({})
  const [likes, setLikes] = useState<Record<string, boolean>>({})

  if (!room) return <Navigate to="/lobby" replace />
  if (!rec) return (
    <div className="min-h-dvh grid place-items-center bg-cream"><div className="text-center"><div className="mx-auto h-10 w-10 rounded-full border-4 border-brand border-t-transparent animate-spin" /><p className="mt-3 font-semibold">면접 기록을 정리하는 중…</p></div></div>
  )
  if (already) return <Navigate to={`/result/${roomId}`} replace />

  const ready = isEr ? targets.every((p) => (kw[p.userId]?.length ?? 0) >= 1) : true
  const submit = () => {
    const db = useDB.getState()
    if (isEr) {
      db.submitFeedback(room.id, me.id, targets.map((p) => ({ to: p.userId, kind: 'keywords' as const, keywords: kw[p.userId], comment: (cm[p.userId] ?? '').trim().slice(0, CFG.commentMax) })))
      if (db.grantTicket(me.id, `tk:${room.id}:${me.id}`)) db.notify(me.id, '피드백을 마쳤어요. 면접권 1장을 받았어요!', '/me', 'ok')
      // 면접자 NPC가 좋아요를 남겨요
      targets.forEach((p) => { if (users[p.userId]?.bot && seedOf(room.id + p.userId) % 5 !== 0) db.submitFeedback(room.id, p.userId, [{ to: me.id, kind: 'like', like: true }]) })
    } else {
      db.submitFeedback(room.id, me.id, targets.map((p) => ({ to: p.userId, kind: 'like' as const, like: !!likes[p.userId] })))
      // 면접관 NPC가 내 답변을 보고 키워드 피드백을 남겨요
      const mine = rec.qa
      const avg = mine.length ? mine.reduce((a, q) => a + q.answer.length, 0) / mine.length : 0
      targets.forEach((p) => {
        if (!users[p.userId]?.bot) return
        const k: string[] = []
        if (mine.every((q) => !q.answer.trim())) k.push('근거가 부족해요')
        else {
          if (avg > 70) k.push('구체적 사례 좋음'); else k.push('결론부터 말해요')
          if (avg > 170) k.push('답변이 길어요'); else k.push(seedOf(room.id) % 2 ? '차분해요' : '진정성 있어요')
          if (mine.length >= 5) k.push('초고속 답변러')
        }
        db.submitFeedback(room.id, p.userId, [{ to: me.id, kind: 'keywords', keywords: k.slice(0, 3), comment: avg > 40 ? '답변을 차근차근 이어가는 모습이 좋았어요. 다음엔 숫자나 결과를 하나만 더 넣어 보세요.' : '조금 더 길게 이야기해 주셔도 좋아요. 한 가지 경험을 구체적으로 풀어 보세요.' }])
      })
    }
    db.recompute(me.id)
    toast('피드백을 보냈어요.', 'ok')
    nav(`/result/${room.id}`, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-cream">
      <header className="h-14 border-b border-line bg-cream/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-3xl h-full px-4 flex items-center gap-3"><img src={A('favicon.svg')} alt="" className="h-7 w-7" /><b>피드백</b><F code="F-19 피드백" /><div className="flex-1" /><Chip tone={expired ? 'danger' : 'warn'} className="tabular-nums">{expired ? '시간이 지났어요' : `${fmtCount(deadline - t)} 안에 남겨요`}</Chip></div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <h1 className="text-[26px] font-extrabold tracking-tight">{isEr ? '면접자에게 키워드를 남겨요' : '면접관에게 좋아요를 보내요'}</h1>
        <p className="text-ink2 mt-1.5 text-[15px]">
          {isEr
            ? `키워드는 필수, 한 줄 평(${CFG.commentMax}자)은 선택이에요. 면접자 본인만 볼 수 있어요. 피드백을 마치면 면접권 1장을 받아요.`
            : '면접관에게는 좋아요만 줄 수 있어요. 좋은 평가만 공개돼요. 면접관이 남긴 키워드는 결과 화면에서 확인해요.'}
        </p>
        {expired && (
          <div className="mt-4 rounded-2xl bg-danger-l text-danger px-4 py-3 text-[14px] font-semibold">피드백은 면접이 끝나고 {CFG.feedbackMin}분 안에 남겨야 해요. 이번엔 시간이 지났어요.{isEr && ' 면접권은 피드백을 남긴 경우에만 받을 수 있어요.'}
            <div className="mt-2"><Btn size="sm" v="soft" onClick={() => nav(`/result/${room.id}`)}>결과 보기</Btn></div></div>
        )}
        <div className="mt-5 space-y-4">
          {targets.map((p) => {
            const u = users[p.userId]
            return (
              <Card key={p.userId} className="p-5">
                <div className="flex items-center gap-3"><AvatarImg id={u?.avatar ?? 'boy'} size={52} bg="#f2e9db" /><div><div className="font-extrabold text-[17px]">{u?.nickname}</div><div className="text-[12px] text-ink3">{isEr ? '면접자' : '면접관'}</div></div></div>
                {isEr ? (
                  <>
                    <div className="mt-4 text-[13px] font-bold text-ink2">키워드 (1~3개)</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {KEYWORDS.map((k) => {
                        const on = kw[p.userId]?.includes(k.k)
                        return <button key={k.k} disabled={expired} aria-pressed={!!on} onClick={() => setKw((s) => { const cur = s[p.userId] ?? []; return { ...s, [p.userId]: on ? cur.filter((x) => x !== k.k) : cur.length >= 3 ? cur : [...cur, k.k] } })}
                          className={cx('h-10 px-3.5 rounded-full text-[14px] font-semibold border transition disabled:opacity-50', on ? (k.tone === 'good' ? 'bg-leaf text-white border-leaf' : 'bg-warn text-white border-warn') : 'bg-paper border-line text-ink2 hover:border-ink3')}>{k.k}</button>
                      })}
                    </div>
                    <div className="mt-4 text-[13px] font-bold text-ink2 flex justify-between"><span>한 줄 평 (선택)</span><span className="font-normal text-ink3">{(cm[p.userId] ?? '').length}/{CFG.commentMax}</span></div>
                    <textarea disabled={expired} className={cx(areaCls, 'mt-1.5')} rows={2} maxLength={CFG.commentMax} value={cm[p.userId] ?? ''} onChange={(e) => setCm((s) => ({ ...s, [p.userId]: e.target.value }))} placeholder="예) 결론부터 말해서 훨씬 잘 들렸어요." />
                  </>
                ) : (
                  <button disabled={expired} aria-pressed={!!likes[p.userId]} onClick={() => setLikes((s) => ({ ...s, [p.userId]: !s[p.userId] }))}
                    className={cx('mt-4 h-14 w-full rounded-2xl border-2 font-bold text-[16px] flex items-center justify-center gap-2 transition', likes[p.userId] ? 'bg-brand text-white border-brand' : 'bg-paper border-line text-ink2 hover:border-brand')}>
                    <Ico.thumb size={22} /> {likes[p.userId] ? '좋아요를 보냈어요' : '좋아요 보내기 (선택)'}
                  </button>
                )}
              </Card>
            )
          })}
          {targets.length === 0 && <Card className="p-6 text-center text-ink2">남길 피드백 대상이 없어요.</Card>}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 bg-paper/95 backdrop-blur border-t border-line p-3 safe-b">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <p className="text-[13px] text-ink2 flex-1">{isEr ? (ready ? '키워드를 모두 골랐어요.' : '모든 면접자에게 키워드를 1개 이상 골라 주세요.') : '좋아요는 선택이에요.'}</p>
          <Btn size="lg" disabled={!ready || expired} onClick={submit}>{isEr ? '보내고 면접권 받기' : '보내기'}</Btn>
        </div>
      </div>
    </div>
  )
}

/* ---------------- 녹음 재생 ---------------- */
export function RecPlayer({ roomId, userId, marks, onReady }: { roomId: string; userId: string; marks?: { qid: string; t: number }[]; onReady?: (el: HTMLAudioElement | null) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [m, setM] = useState<RecBlob['marks']>([])
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    let u: string | null = null
    idbGet<RecBlob>(`${roomId}:${userId}`).then((r) => { if (r) { u = URL.createObjectURL(r.blob); setUrl(u); setM(r.marks) } })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [roomId, userId])
  useEffect(() => { onReady?.(ref.current) }, [url]) // eslint-disable-line react-hooks/exhaustive-deps
  void marks; void m
  if (!url) return <p className="text-[13px] text-ink3">저장된 녹음을 찾을 수 없어요.</p>
  return <audio ref={ref} controls src={url} className="w-full" />
}

const RecCtx = createContext<null>(null)
void RecCtx; void useContext

/* ---------------- 면접 결과 ---------------- */
export function Result() {
  const { roomId } = useParams()
  const me = useMe()!
  const nav = useNavigate()
  const records = useDB((s) => s.records)
  const feedbacks = useDB((s) => s.feedbacks)
  const users = useDB((s) => s.users)
  const room = useDB((s) => (roomId ? s.rooms[roomId] : undefined))
  const rec = records.find((r) => r.roomId === roomId && r.userId === me.id)
  if (!room || !rec) return <Navigate to="/lobby" replace />
  const isEr = rec.role === 'interviewer'
  const got = feedbacks.filter((f) => f.roomId === room.id && f.to === me.id)
  const kwFb = got.filter((f) => f.kind === 'keywords')
  const likes = got.filter((f) => f.kind === 'like' && f.like).length
  const gaveFb = feedbacks.some((f) => f.roomId === room.id && f.from === me.id)
  return (
    <div className="min-h-dvh bg-cream">
      <header className="h-14 border-b border-line bg-cream/90 backdrop-blur sticky top-0 z-30"><div className="mx-auto max-w-3xl h-full px-4 flex items-center gap-3"><img src={A('favicon.svg')} alt="" className="h-7 w-7" /><b>면접 결과</b><F code="면접 결과 · 피드백 확인" /></div></header>
      <div className="mx-auto max-w-3xl px-4 py-6 pb-16 space-y-5">
        <div>
          <Chip tone={isEr ? 'brand' : 'leaf'}>{isEr ? '면접관으로 참여' : '면접자로 참여'}</Chip>
          <h1 className="text-[28px] font-extrabold tracking-tight mt-2">수고했어요! 결과를 확인해요</h1>
          <p className="text-ink2 text-[14px] mt-1">{fmtDT(rec.startAt)} · 질문 {rec.qa.length}개{rec.hasRecording ? ' · 녹음 저장됨' : ''}</p>
        </div>

        {isEr ? (
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-brand-l text-brand grid place-items-center"><Ico.thumb size={28} /></div>
              <div><div className="text-[13px] text-ink2 font-semibold">받은 좋아요</div><div className="text-[30px] font-extrabold leading-none">{likes}개</div></div>
              <div className="flex-1" />
              {gaveFb ? <Chip tone="leaf"><Ico.ticket size={13} /> 면접권 1장 지급됨</Chip> : <Chip tone="warn">피드백을 남기면 면접권을 받아요</Chip>}
            </div>
            <p className="text-[12px] text-ink3 mt-3">면접관 참여 기록은 날짜와 좋아요 수로만 남아요.</p>
          </Card>
        ) : (
          <Card className="p-5">
            <h2 className="font-bold text-[17px]">받은 키워드 · 한 줄 평</h2>
            <p className="text-[12px] text-ink3">나만 볼 수 있어요.</p>
            {kwFb.length === 0 && <p className="mt-3 text-[14px] text-ink2 bg-sand rounded-xl px-3 py-3">아직 면접관의 피드백이 도착하지 않았어요. 사람 면접관이 피드백을 남기면 이곳에 쌓여요.</p>}
            <div className="mt-3 space-y-3">
              {kwFb.map((f) => (
                <div key={f.id} className="rounded-2xl bg-sand p-3.5">
                  <div className="flex items-center gap-2 text-[13px] font-bold"><AvatarImg id={users[f.from]?.avatar ?? 'boy'} size={28} />{users[f.from]?.nickname}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{f.keywords?.map((k) => <Chip key={k} tone={KEYWORDS.find((x) => x.k === k)?.tone === 'improve' ? 'warn' : 'leaf'}>{k}</Chip>)}</div>
                  {f.comment && <p className="mt-2 text-[14px] text-ink">“{f.comment}”</p>}
                </div>
              ))}
            </div>
          </Card>
        )}

        <QAList rec={rec} />

        <div className="rounded-[28px] bg-espresso text-white p-5">
          <div className="font-bold text-[17px]">{isEr ? '이제 면접자로도 연습해 볼까요?' : '면접관 자리에도 앉아볼까요?'}</div>
          <p className="text-cream/70 text-[14px] mt-1">{isEr ? '면접관 → 면접자: 방금 얻은 면접권으로 다음 면접을 예약해요.' : '면접자 → 면접관: 면접관을 해보면 질문의 의도가 보여요. 끝나면 면접권도 돌아와요.'}</p>
          <div className="mt-4 flex gap-2 flex-wrap"><Btn onClick={() => nav('/reserve')}>다음 면접 예약</Btn><Btn v="soft" onClick={() => nav('/records?tab=cards')}>질문카드 보관함</Btn><Btn v="ghost" className="!text-cream hover:!bg-white/10" onClick={() => nav('/lobby')}>로비로 돌아가기</Btn></div>
          <F code="로비 복귀 → 3D 로비 (F-05)" className="mt-3 inline-block" />
        </div>
      </div>
    </div>
  )
}

export function QAList({ rec, compact }: { rec: InterviewRecord; compact?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [aud, setAud] = useState<HTMLAudioElement | null>(null)
  const [marks, setMarks] = useState<{ qid: string; t: number }[]>([])
  useEffect(() => { if (rec.hasRecording) idbGet<RecBlob>(`${rec.roomId}:${rec.userId}`).then((r) => r && setMarks(r.marks)) }, [rec])
  const isEe = rec.role === 'interviewee'
  return (
    <Card className="p-5">
      <h2 className="font-bold text-[17px]">{isEe ? '내가 받은 질문' : '내가 던진 질문'} <span className="text-ink3 font-normal text-[14px]">{rec.qa.length}개</span></h2>
      {rec.hasRecording && <div className="mt-3"><RecPlayer roomId={rec.roomId} userId={rec.userId} onReady={setAud} /></div>}
      {rec.qa.length === 0 && <p className="mt-3 text-[14px] text-ink2 bg-sand rounded-xl px-3 py-3">이 면접에서는 질문이 오가지 않았어요.</p>}
      <div className="mt-3 space-y-2.5">
        {rec.qa.map((q, i) => <QACard key={q.id} q={q} i={i} open={compact ? openId === q.id : openId === q.id || (openId === null && i === 0)} toggle={() => setOpenId(openId === q.id ? '' : q.id)} isEe={isEe}
          seek={aud && marks.find((m) => m.qid === q.id) ? () => { aud.currentTime = marks.find((m) => m.qid === q.id)!.t; void aud.play() } : undefined} />)}
      </div>
    </Card>
  )
}

function QACard({ q, i, open, toggle, isEe, seek }: { q: QA; i: number; open: boolean; toggle: () => void; isEe: boolean; seek?: () => void }) {
  return (
    <div className="rounded-2xl border border-line overflow-hidden bg-white">
      <button className="w-full text-left px-4 py-3 flex gap-3 items-start" onClick={toggle} aria-expanded={open}>
        <span className="h-7 w-7 rounded-full bg-sand text-ink2 font-bold text-[13px] grid place-items-center shrink-0">{i + 1}</span>
        <span className="flex-1 min-w-0">
          <span className="flex gap-1.5 mb-1 flex-wrap"><Chip>{PART_NAME[q.part]}</Chip>{q.tag && <Chip tone={q.tag === '압박' ? 'danger' : q.tag === '황당' ? 'warn' : 'neutral'}>{q.tag}</Chip>}{q.kind === 'followup' && <Chip tone="brand">꼬리질문</Chip>}</span>
          <span className="font-bold text-[15px] leading-snug block">{q.text}</span>
        </span>
        <span className={cx('text-ink3 transition mt-1', open && 'rotate-180')}>⌄</span>
      </button>
      {open && (
        <div className="px-4 pb-4 grid gap-2.5 text-[14px]">
          <div className="rounded-xl bg-sky-l/60 p-3"><b className="text-sky">질문 의도</b><p className="mt-0.5 text-ink">{q.intent}</p></div>
          {isEe && <div className="rounded-xl bg-sand p-3"><div className="flex items-center"><b className="text-ink2">내 답변</b>{seek && <Btn size="sm" v="ghost" className="ml-auto" onClick={seek}><Ico.play size={13} /> 녹음 듣기</Btn>}</div><p className="mt-0.5 text-ink whitespace-pre-wrap">{q.answer || <span className="text-ink3">기록된 답변이 없어요.</span>}</p></div>}
          <div className="rounded-xl bg-leaf-l/70 p-3"><b className="text-leaf-d">모범 답변 방향</b><p className="mt-0.5 text-ink">{q.direction}</p></div>
        </div>
      )}
    </div>
  )
}
