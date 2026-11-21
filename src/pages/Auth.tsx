import { useState } from 'react'
import { A } from '../lib/asset'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { APP_NAME, cx } from '../lib/core'
import { useAuth, useDB } from '../lib/db'
import { AvatarImg, Btn, Field, F, inputCls } from '../components/ui'

export default function Auth() {
  const [sp, setSp] = useSearchParams()
  const mode = sp.get('mode') === 'login' ? 'login' : 'signup'
  const next = sp.get('next')
  const nav = useNavigate()
  const signIn = useAuth((s) => s.signIn)
  const { register, login } = useDB.getState()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [nick, setNick] = useState('')
  const [agree, setAgree] = useState(false)
  const [err, setErr] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (mode === 'signup') {
      if (!agree) return setErr('이용약관과 개인정보 처리에 동의해 주세요.')
      const r = register(email, pw, nick)
      if (!r.ok) return setErr(r.msg ?? '가입에 실패했어요.')
      signIn(r.id!)
      nav('/onboarding/avatar', { replace: true })
    } else {
      const r = login(email, pw)
      if (!r.ok) return setErr(r.msg ?? '로그인에 실패했어요.')
      signIn(r.id!)
      nav(next && next.startsWith('/') ? next : '/lobby', { replace: true })
    }
  }
  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-cream">
      <div className="hidden lg:flex flex-col justify-between bg-espresso text-white p-12 relative overflow-hidden">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-xl"><img src={A('favicon.svg')} alt="" className="h-9 w-9" />{APP_NAME}</Link>
        <div className="relative z-10">
          <h2 className="text-4xl font-extrabold leading-tight">얼굴은 가리고,<br />면접은 진짜처럼.</h2>
          <p className="mt-4 text-cream/70 max-w-sm">면접을 받으려면 면접관도 해보는 역할 교대. 양쪽에서 이해하면 답변이 달라져요.</p>
        </div>
        <div className="flex items-end gap-2 -mb-4 relative z-10">
          <img src={A('sprites/boy_front.png')} alt="" className="h-52" /><img src={A('sprites/girl_front.png')} alt="" className="h-56" /><img src={A('sprites/man_front.png')} alt="" className="h-48" />
        </div>
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
      </div>
      <div className="grid place-items-center p-5">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate>
          <F code="F-03 회원가입 · 로그인" className="mb-3 inline-block" />
          <Link to="/" className="lg:hidden flex items-center gap-2 font-extrabold text-lg mb-6"><img src={A('favicon.svg')} alt="" className="h-8 w-8" />{APP_NAME}</Link>
          <div className="flex rounded-full bg-sand p-1 mb-6" role="tablist">
            {(['signup', 'login'] as const).map((m) => (
              <button type="button" key={m} role="tab" aria-selected={mode === m} onClick={() => { setErr(''); setSp({ mode: m, ...(next ? { next } : {}) }) }}
                className={cx('flex-1 h-10 rounded-full text-[14px] font-bold transition', mode === m ? 'bg-paper shadow-soft text-ink' : 'text-ink2')}>{m === 'signup' ? '회원가입' : '로그인'}</button>
            ))}
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight mb-5">{mode === 'signup' ? '처음이세요? 반가워요' : '다시 오셨네요'}</h1>
          <div className="space-y-4">
            <Field label="이메일"><input className={inputCls} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
            <Field label="비밀번호" hint={mode === 'signup' ? '6자 이상' : undefined}><input className={inputCls} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            {mode === 'signup' && (
              <Field label="닉네임" hint="익명 면접에서 쓰는 이름이에요. 가입 후에는 변경할 수 없어요.">
                <input className={inputCls} maxLength={10} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="2~10자" />
              </Field>
            )}
            {mode === 'signup' && (
              <label className="flex gap-2.5 items-start text-[13px] text-ink2 leading-snug">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#2b5cff] shrink-0" />
                <span>(필수) 이용약관과 개인정보 처리에 동의해요. 노쇼 경고가 2회 쌓이면 이용이 제한되는 것에도 동의해요.</span>
              </label>
            )}
            {err && <p role="alert" className="text-[13px] text-danger bg-danger-l rounded-xl px-3 py-2">{err}</p>}
            <Btn type="submit" size="lg" full>{mode === 'signup' ? '가입하고 시작하기' : '로그인'}</Btn>
          </div>
          <p className="text-[12px] text-ink3 mt-5 leading-relaxed">프로토타입이라 계정은 이 브라우저에만 저장돼요. 비밀번호도 이 기기 안에서만 처리돼요.</p>
          <div className="mt-6 flex gap-3 justify-center opacity-90" aria-hidden><AvatarImg id="boy" size={44} /><AvatarImg id="girl" size={44} /><AvatarImg id="man" size={44} /></div>
        </form>
      </div>
    </div>
  )
}
