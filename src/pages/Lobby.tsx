import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CFG, MIN, dayKey, now, useNow } from '../lib/core'
import { useAuth, useDB, useMe } from '../lib/db'
import { BottomNav, GNB, NextBanner } from '../components/Shell'
import { Btn, Chip, F, Ico, Modal } from '../components/ui'
import Joystick from '../components/Joystick'

const LobbyScene = lazy(() => import('../three/LobbyScene'))

export default function Lobby() {
  const me = useMe()
  const guest = useAuth((s) => s.guest)
  const nav = useNavigate()
  const users = useDB((s) => s.users)
  const rooms = useDB((s) => s.rooms)
  const t = useNow(5000)
  const [near, setNear] = useState(false)
  const [loginPop, setLoginPop] = useState(false)
  const joy = useRef({ x: 0, y: 0 })
  const [touch, setTouch] = useState(false)

  useEffect(() => {
    const f = () => setTouch(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 860)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  const npcs = useMemo(() => Object.values(users).filter((u) => u.bot).slice(0, 4).map((u) => ({ id: u.id, name: u.nickname, avatar: u.avatar })), [users])
  const openKiosk = () => { if (!me) setLoginPop(true); else nav('/reserve') }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && near && !(e.target as HTMLElement)?.closest('button,input,textarea,select,[role=dialog]')) { e.preventDefault(); openKiosk() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const openCount = Object.values(rooms).filter((r) => !r.cancelled && dayKey(r.startAt) === dayKey(now()) && r.startAt - CFG.lockBeforeMin * MIN > t).length
  const me2 = me ?? { avatar: 'boy' as const, nickname: '손님' }

  return (
    <div className="h-dvh flex flex-col bg-cream">
      <GNB />
      <NextBanner />
      <div className="relative flex-1 min-h-0 overflow-hidden pb-16 md:pb-0">
        <div className="absolute inset-0 bottom-16 md:bottom-0">
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-ink2">로비를 여는 중…</div>}>
            <LobbyScene me={{ avatar: me2.avatar, name: me ? me.nickname : '손님' }} npcs={npcs} joy={joy} onNear={setNear} onKioskClick={(isNear) => { if (isNear) openKiosk() }} />
          </Suspense>
        </div>

        <div className="absolute left-3 top-3 z-10 space-y-2 max-w-[260px] max-sm:max-w-[170px]">
          <F code="F-05 3D 로비 · 메뉴 1" />
          <div className="rounded-2xl bg-paper/92 backdrop-blur border border-line shadow-soft p-3.5">
            <div className="text-[13px] font-bold text-ink2">오늘의 면접방</div>
            <div className="mt-0.5 text-[20px] font-extrabold">{openCount}개 <span className="text-[13px] font-semibold text-ink2">예약 가능</span></div>
            <p className="text-[12px] text-ink3 mt-1 max-sm:hidden">매일 오전 {CFG.openHour}시에 그날 방이 한 번에 열려요.</p>
            {me && <Chip tone="brand" className="mt-2"><Ico.ticket size={13} /> 면접권 {me.tickets}장</Chip>}
            {!me && <p className="text-[12px] text-sky mt-2 font-semibold">로그인 없이 로비까지만 볼 수 있어요.</p>}
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 bottom-[178px] md:bottom-6 z-10 flex flex-col items-center gap-2 px-3 w-full pointer-events-none">
          {near ? (
            <div className="pointer-events-auto animate-pop rounded-2xl bg-paper border border-brand shadow-clay px-4 py-3 flex items-center gap-3">
              <div><div className="text-[14px] font-bold">예약 키오스크</div><div className="text-[12px] text-ink2">Enter · Space 또는 버튼</div></div>
              <Btn onClick={openKiosk}>예약하기</Btn>
            </div>
          ) : (
            <div className="rounded-full bg-espresso/80 text-cream text-[12.5px] font-semibold px-4 py-2 text-center">
              {touch ? '조이스틱으로 걸어가 예약 키오스크를 눌러요' : '방향키(WASD)로 걸어가 예약 키오스크를 사용해요 · 바닥을 눌러도 이동해요'}
            </div>
          )}
        </div>

        {touch && <div className="absolute left-4 bottom-8 md:bottom-6 z-10"><Joystick value={joy} /></div>}
        <button onClick={openKiosk} className="absolute right-3 top-3 z-10 md:hidden h-11 px-4 rounded-2xl bg-brand text-white font-bold shadow-clay flex items-center gap-1.5"><Ico.cal size={18} />예약</button>
      </div>
      <BottomNav />

      <Modal open={loginPop} onClose={() => setLoginPop(false)} title="로그인이 필요해요"
        footer={<><Btn v="soft" onClick={() => setLoginPop(false)}>계속 둘러보기</Btn><Btn onClick={() => nav('/auth?mode=login&next=/reserve')}>로그인하기</Btn></>}>
        {guest ? '둘러보기에서는 로비까지만 볼 수 있어요. ' : ''}다른 공간이나 기능을 쓰려면 로그인해야 해요. 계정이 없다면 회원가입도 1분이면 끝나요.
      </Modal>
    </div>
  )
}
