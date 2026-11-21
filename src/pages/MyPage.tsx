import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CFG, cx, fmtDT, now } from '../lib/core'
import { useAuth, useDB, useMe } from '../lib/db'
import { AVATAR_NAME, AvatarImg, Btn, Card, Chip, F, Field, Ico, Modal, inputCls, toast } from '../components/ui'
import { BADGE_DEFS } from '../data/questions'
import { AvatarPick, ResumeForm } from './Onboarding'

export default function MyPage() {
  const me = useMe()!
  const nav = useNavigate()
  const signOut = useAuth((s) => s.signOut)
  const patch = useDB((s) => s.patchUser)
  const changePw = useDB((s) => s.changePw)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [old, setOld] = useState('')
  const [nw, setNw] = useState('')
  const [msg, setMsg] = useState('')
  const restricted = me.restrictedUntil && me.restrictedUntil > now()
  return (
    <div className="space-y-5">
      <div>
        <F code="메뉴 3 · 마이페이지 → 내 정보" className="mb-2 inline-block" />
        <h1 className="text-[28px] font-extrabold tracking-tight">마이페이지</h1>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <AvatarImg id={me.avatar} size={84} bg="#f2e9db" />
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center gap-2"><span className="text-[22px] font-extrabold">{me.nickname}</span><Chip tone="sky"><Ico.lock size={12} /> 변경 불가</Chip></div>
            <div className="text-[13px] text-ink3">{me.email}</div>
            <div className="text-[12px] text-ink3 mt-0.5">아바타: {AVATAR_NAME[me.avatar]}</div>
          </div>
          <Btn v="soft" onClick={() => setAvatarOpen(true)}>아바타 바꾸기</Btn>
        </div>
        <p className="text-[12px] text-ink3 mt-3">닉네임은 가입 후 변경할 수 없어요. 아바타는 MVP에서는 자유롭게 바꿀 수 있어요.</p>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-[17px]">면접권 · 레벨 · 뱃지</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Stat icon={<Ico.ticket />} label="면접권" value={`${me.tickets}장`} tone="brand" />
          <Stat icon={<Ico.star />} label="신뢰도 레벨" value={`Lv.${me.level}`} tone="leaf" />
          <Stat icon={<Ico.thumb />} label="받은 좋아요" value={`${me.likes}개`} tone="sky" />
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {me.badges.length === 0 ? <span className="text-[14px] text-ink3">아직 뱃지가 없어요. 첫 면접을 마치면 받아요.</span> : me.badges.map((b) => { const d = BADGE_DEFS.find((x) => x.id === b); return d ? <Chip key={b} tone="brand" className="!text-[13px] !py-1.5">{d.emoji} {d.name}</Chip> : null })}
        </div>
        <p className="text-[12px] text-ink3 mt-3">면접권과 신뢰도 레벨, 뱃지는 다른 사람에게도 공개돼요.</p>
        <div className={cx('mt-4 rounded-2xl p-4', me.warnings ? 'bg-warn-l' : 'bg-sand')}>
          <div className="flex items-center gap-2"><b className="text-[15px]">노쇼 경고</b><Chip tone="neutral"><Ico.lock size={12} /> 나만 볼 수 있어요</Chip></div>
          <div className="mt-1 text-[14px]">{me.warnings}회 / {CFG.noShowLimit}회 {restricted ? <b className="text-danger"> · {fmtDT(me.restrictedUntil!)}까지 예약이 제한돼요</b> : me.warnings ? ' · 한 번 더 쌓이면 이용이 제한돼요' : ' · 깨끗해요 👍'}</div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2"><h2 className="font-bold text-[17px]">자소서 · 이력 관리</h2><F code="자소서 · 이력 관리" /></div>
        {me.resume ? (
          <div className="mt-3 rounded-2xl bg-sand p-4 text-[14px] space-y-1.5">
            <div><b>직군</b> {me.resume.job}</div><div><b>자기소개</b> {me.resume.intro || '—'}</div><div><b>이력</b> {me.resume.career || '—'}</div>
          </div>
        ) : <p className="mt-3 text-[14px] text-ink2 bg-sand rounded-xl px-3 py-3">등록하지 않았어요. 기본 인성면접만 가능하고, 2부 커스텀 질문은 제한될 수 있어요.</p>}
        <p className="text-[12px] text-ink3 mt-2">등록하면 면접 때 면접관 역할에게 <b>항상 공개</b>돼요.</p>
        <div className="mt-3 flex gap-2"><Btn v="soft" onClick={() => setResumeOpen(true)}>{me.resume ? '수정하기' : '등록하기'}</Btn>{me.resume && <Btn v="ghost" onClick={() => { patch(me.id, { resume: null }); toast('자소서·이력을 삭제했어요.') }}>삭제</Btn>}</div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-[17px]">계정 · 비밀번호 변경</h2>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <Field label="현재 비밀번호"><input type="password" className={inputCls} value={old} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="새 비밀번호" hint="6자 이상"><input type="password" className={inputCls} value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" /></Field>
        </div>
        {msg && <p role="alert" className="text-[13px] text-danger mt-2">{msg}</p>}
        <div className="mt-3"><Btn v="soft" disabled={!old || !nw} onClick={() => { const r = changePw(me.id, old, nw); if (!r.ok) setMsg(r.msg ?? ''); else { setMsg(''); setOld(''); setNw(''); toast('비밀번호를 바꿨어요.', 'ok') } }}>비밀번호 바꾸기</Btn></div>
      </Card>

      <div className="flex gap-2 flex-wrap"><Btn v="ghost" onClick={() => { signOut(); nav('/') }}>로그아웃</Btn></div>

      <Modal open={avatarOpen} onClose={() => setAvatarOpen(false)} wide title="아바타 바꾸기">
        <AvatarPick embedded onDone={() => setAvatarOpen(false)} />
      </Modal>
      <Modal open={resumeOpen} onClose={() => setResumeOpen(false)} wide title="자소서 · 이력">
        <ResumeForm onSaved={() => setResumeOpen(false)} submitLabel="저장하기" />
      </Modal>
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'brand' | 'leaf' | 'sky' }) {
  const c = { brand: 'bg-brand-l text-brand-d', leaf: 'bg-leaf-l text-leaf-d', sky: 'bg-sky-l text-sky' }[tone]
  return <div className="rounded-2xl border border-line p-3"><div className={cx('mx-auto h-10 w-10 rounded-xl grid place-items-center', c)}>{icon}</div><div className="mt-1.5 text-[12px] text-ink2 font-semibold">{label}</div><div className="text-[20px] font-extrabold">{value}</div></div>
}
