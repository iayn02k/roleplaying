import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth, useDB, useMe } from './lib/db'
import { Toasts, toast } from './components/ui'
import { AppLayout, DemoPanel } from './components/Shell'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import { AvatarPick, ResumeSetup } from './pages/Onboarding'
import Lobby from './pages/Lobby'
import Reserve from './pages/Reserve'
import Records from './pages/Records'
import MyPage from './pages/MyPage'
import Waiting from './pages/Waiting'
import Interview from './pages/Interview'
import { Feedback, Result } from './pages/Feedback'
import Admin from './pages/Admin'

/** 1초마다: 방 보장, 예약 알림(1시간 전·대기실 오픈), 노쇼 처리, 새 알림 토스트 */
function Ticker() {
  const me = useMe()
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const run = () => {
      useDB.getState().ensureRooms()
      if (me) useDB.getState().scan(me.id)
    }
    run()
    const id = setInterval(run, 1000)
    return () => clearInterval(id)
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!me) { seen.current = null; return }
    return useDB.subscribe((s) => {
      const mine = s.notices.filter((n) => n.userId === me.id)
      if (!seen.current) { seen.current = new Set(mine.map((n) => n.id)); return }
      for (const n of mine) {
        if (!seen.current.has(n.id)) { seen.current.add(n.id); toast(n.text, n.kind === 'warn' ? 'warn' : n.kind === 'ok' ? 'ok' : 'info') }
      }
    })
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export function Protected({ children }: { children: ReactNode }) {
  const me = useMe()
  const loc = useLocation()
  if (!me) return <Navigate to={`/auth?mode=login&next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}

export default function App() {
  const hydrated = useDB((s) => s.users)
  void hydrated
  return (
    <>
      <ScrollTop />
      <Ticker />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding/avatar" element={<Protected><AvatarPick /></Protected>} />
        <Route path="/onboarding/resume" element={<Protected><ResumeSetup /></Protected>} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/reserve" element={<Protected><AppLayout wide><Reserve /></AppLayout></Protected>} />
        <Route path="/records" element={<Protected><AppLayout wide><Records /></AppLayout></Protected>} />
        <Route path="/me" element={<Protected><AppLayout><MyPage /></AppLayout></Protected>} />
        <Route path="/waiting/:resId" element={<Protected><Waiting /></Protected>} />
        <Route path="/interview/:roomId" element={<Protected><Interview /></Protected>} />
        <Route path="/feedback/:roomId" element={<Protected><Feedback /></Protected>} />
        <Route path="/result/:roomId" element={<Protected><Result /></Protected>} />
        <Route path="/admin" element={<AppLayout wide><Admin /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DemoPanel />
      <Toasts />
    </>
  )
}

export { useAuth }
