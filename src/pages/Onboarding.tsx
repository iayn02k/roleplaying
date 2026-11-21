import { useState } from 'react'
import { A } from '../lib/asset'
import { useNavigate } from 'react-router-dom'
import { APP_NAME, cx } from '../lib/core'
import { useDB, useMe } from '../lib/db'
import { AVATAR_NAME, AvatarImg, Btn, Card, F, Field, Modal, areaCls, inputCls, toast } from '../components/ui'
import { JOBS } from '../data/questions'
import type { AvatarId } from '../types'

function Frame({ step, title, desc, children, code }: { step: number; title: string; desc: string; children: React.ReactNode; code: string }) {
  return (
    <div className="min-h-dvh bg-cream px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2 font-extrabold mb-6"><img src={A('favicon.svg')} alt="" className="h-8 w-8" />{APP_NAME}</div>
        <div className="flex gap-1.5 mb-5" aria-label={`2단계 중 ${step}단계`}>{[1, 2].map((i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand' : 'bg-line')} />)}</div>
        <F code={code} className="mb-2 inline-block" />
        <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
        <p className="text-ink2 mt-1.5 mb-6">{desc}</p>
        {children}
      </div>
    </div>
  )
}

/** F-04 아바타 선택 */
export function AvatarPick({ embedded, onDone }: { embedded?: boolean; onDone?: () => void }) {
  const me = useMe()
  const nav = useNavigate()
  const patch = useDB((s) => s.patchUser)
  const [sel, setSel] = useState<AvatarId>(me?.avatar ?? 'boy')
  const ids: AvatarId[] = ['boy', 'girl', 'man']
  const body = (
    <>
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="아바타 선택">
        {ids.map((id) => (
          <button key={id} role="radio" aria-checked={sel === id} onClick={() => setSel(id)}
            className={cx('rounded-[28px] border-2 bg-paper p-3 pb-4 transition text-center', sel === id ? 'border-brand shadow-clay -translate-y-0.5' : 'border-line hover:border-ink3')}>
            <div className="h-36 sm:h-44 flex items-end justify-center bg-sand rounded-2xl overflow-hidden pb-1.5">
              <img src={A(`sprites/${id}_front.png`)} alt="" className="h-[90%] w-auto max-w-full object-contain" draggable={false} />
            </div>
            <div className="mt-2 text-[14px] font-bold">{AVATAR_NAME[id]}</div>
          </button>
        ))}
      </div>
      <p className="text-[13px] text-ink3 mt-3">준비된 캐릭터 중에서 골라요. 처음엔 모두 면접자 외형이에요. 면접관으로 참여하면 외형이 면접관 시트에서 랜덤으로 바뀌어요.</p>
    </>
  )
  if (embedded) return (
    <div>{body}<Btn className="mt-4" onClick={() => { if (me) patch(me.id, { avatar: sel }); toast('아바타를 바꿨어요.', 'ok'); onDone?.() }}>이 아바타로 바꾸기</Btn></div>
  )
  return (
    <Frame step={1} code="F-04 아바타 선택" title="나를 대신할 아바타를 골라요" desc="얼굴도 이름도 가려지는 면접이라, 아바타가 곧 나예요.">
      {body}
      <Btn size="lg" full className="mt-6" onClick={() => { if (me) patch(me.id, { avatar: sel }); nav('/onboarding/resume') }}>다음</Btn>
    </Frame>
  )
}

/** 자소서 · 이력 등록 (선택) */
export function ResumeForm({ onSaved, submitLabel = '등록하기' }: { onSaved: () => void; submitLabel?: string }) {
  const me = useMe()
  const patch = useDB((s) => s.patchUser)
  const [job, setJob] = useState<string>(me?.resume?.job ?? JOBS[0])
  const [intro, setIntro] = useState(me?.resume?.intro ?? '')
  const [career, setCareer] = useState(me?.resume?.career ?? '')
  const ok = intro.trim().length >= 10 || career.trim().length >= 10
  return (
    <div className="space-y-4">
      <Field label="지원 직군">
        <select className={inputCls} value={job} onChange={(e) => setJob(e.target.value)}>{JOBS.map((j) => <option key={j}>{j}</option>)}</select>
      </Field>
      <Field label="자기소개 · 자소서" hint="면접관이 2부 커스텀 질문을 만들 때 참고해요.">
        <textarea className={areaCls} rows={4} maxLength={600} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="예) 문제를 정의하는 일에 흥미가 많은 신입 PM 지망생입니다." />
      </Field>
      <Field label="이력 · 경험">
        <textarea className={areaCls} rows={4} maxLength={600} value={career} onChange={(e) => setCareer(e.target.value)} placeholder="예) 교내 창업 동아리에서 사용자 인터뷰 20건을 진행했어요." />
      </Field>
      <p className="text-[13px] bg-warn-l text-warn rounded-xl px-3 py-2">등록하면 면접 때 <b>면접관 역할에게 항상 공개</b>돼요. 연락처·실명 등 개인정보는 적지 마세요.</p>
      <Btn full size="lg" disabled={!ok} onClick={() => { if (me) patch(me.id, { resume: { job, intro: intro.trim(), career: career.trim() } }); toast('자소서·이력을 등록했어요.', 'ok'); onSaved() }}>{submitLabel}</Btn>
      {!ok && <p className="text-[12px] text-ink3 text-center">자기소개나 이력 중 하나를 10자 이상 적어주세요.</p>}
    </div>
  )
}

export function ResumeSetup() {
  const nav = useNavigate()
  const [pop, setPop] = useState(false)
  return (
    <Frame step={2} code="자소서 · 이력 등록 (선택)" title="자소서와 이력을 등록할까요?" desc="선택이에요. 등록하면 면접관이 내 이야기에서 질문을 뽑아줘요.">
      <Card className="p-5">
        <ResumeForm onSaved={() => nav('/lobby')} submitLabel="등록하고 로비로" />
      </Card>
      <button className="mt-4 w-full text-center text-[14px] font-semibold text-ink2 underline underline-offset-4 py-3" onClick={() => setPop(true)}>나중에 할게요 (건너뛰기)</button>
      <Modal open={pop} onClose={() => setPop(false)} title="건너뛰면 이렇게 돼요"
        footer={<><Btn v="soft" onClick={() => setPop(false)}>등록할게요</Btn><Btn onClick={() => { setPop(false); nav('/lobby') }}>건너뛰기</Btn></>}>
        기본 인성면접만 가능하고, <b>심화 질문(2부 커스텀 질문)은 제한</b>될 수 있어요. 마이페이지에서 언제든 등록할 수 있어요.
      </Modal>
    </Frame>
  )
}
