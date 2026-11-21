import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { AvatarId } from '../types'
import { Character, ISO_SQUASH, viewFromDir, type View } from './Character'
import { C, Box, Cabinet, Clock, Frame, Lamp, Lights, Plant, RoomShell, Sofa, Table, TVBoard, Window, Chair, makeTex } from './parts'
import { APP_NAME } from '../lib/core'

const W = 16, D = 11
const BOUND = { x: [-7.2, 7.2], z: [-4.6, 4.6] }
export const KIOSK = { x: 3.2, z: -2.2 }
const KIOSK_STAND = new THREE.Vector3(KIOSK.x + 1.15, 0, KIOSK.z + 1.15)
const OBST = [
  { x: KIOSK.x, z: KIOSK.z, r: 0.75 }, { x: -5.6, z: -4.2, r: 1.0 }, { x: -4.4, z: -4.2, r: 1.0 }, { x: -1.6, z: -4.8, r: 0.8 },
  { x: -5.2, z: 1.6, r: 1.0 }, { x: -4.0, z: 1.6, r: 1.0 }, { x: 7, z: -4.6, r: 0.5 }, { x: -7.2, z: -4.6, r: 0.4 },
]
const R = new THREE.Vector3(1, 0, -1).normalize()
const U = new THREE.Vector3(-1, 0, -1).normalize() // 화면 위쪽

export interface LobbyProps {
  me: { avatar: AvatarId; name: string }
  npcs: { id: string; name: string; avatar: AvatarId }[]
  joy: React.MutableRefObject<{ x: number; y: number }>
  onNear: (near: boolean) => void
  onKioskClick: (near: boolean) => void
}

function Kiosk({ onClick }: { onClick: () => void }) {
  const tex = useMemo(
    () => makeTex(256, 200, (c, w, h) => {
      c.fillStyle = '#fff7ee'; c.fillRect(0, 0, w, h)
      c.fillStyle = '#c24e1a'; c.fillRect(0, 0, w, 62)
      c.fillStyle = '#fff'; c.font = '800 34px sans-serif'; c.textAlign = 'center'; c.fillText('면접방 예약', w / 2, 44)
      c.fillStyle = '#3a2e29'; c.font = '700 20px sans-serif'; c.fillText('오늘 8시 오픈', w / 2, 100)
      c.fillStyle = '#2f7d5b'; c.beginPath(); c.roundRect(40, 120, 176, 50, 14); c.fill()
      c.fillStyle = '#fff'; c.font = '800 24px sans-serif'; c.fillText('예약하기', w / 2, 154)
    }),
    [],
  )
  const glow = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => { if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(clock.elapsedTime * 2.4) * 0.1 })
  return (
    <group position={[KIOSK.x, 0, KIOSK.z]} rotation={[0, Math.PI / 4, 0]} scale={1.25} onClick={(e) => { e.stopPropagation(); onClick() }} onPointerOver={() => { document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}>
      <Box p={[0, 0.06, 0]} s={[1.1, 0.12, 0.8]} c="#4a403a" />
      <Box p={[0, 0.62, 0]} s={[0.78, 1.0, 0.5]} c="#fbfaf7" />
      <Box p={[0, 1.38, 0.02]} s={[1.06, 0.68, 0.2]} c="#3b3733" />
      <mesh position={[0, 1.38, 0.13]}>
        <planeGeometry args={[0.96, 0.6]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh ref={glow} position={[0, 0.02, 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 32]} />
        <meshBasicMaterial color="#e3b84a" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Rug() {
  const tex = useMemo(
    () => makeTex(512, 320, (c, w, h) => {
      c.fillStyle = '#f2e7d6'; c.fillRect(0, 0, w, h)
      c.strokeStyle = '#c24e1a'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28)
      c.strokeStyle = '#e3b84a'; c.lineWidth = 3; c.strokeRect(30, 30, w - 60, h - 60)
      c.fillStyle = '#3a2e29'; c.font = '800 56px sans-serif'; c.textAlign = 'center'; c.fillText(APP_NAME, w / 2, h / 2 + 10)
      c.fillStyle = '#8f8176'; c.font = '600 22px sans-serif'; c.fillText('메타버스 모의면접 로비', w / 2, h / 2 + 52)
    }),
    [],
  )
  return (
    <mesh position={[0.2, 0.008, 1.0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[5.4, 3.4]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

function Player({ me, joy, onNear, posRef }: { me: LobbyProps['me']; joy: LobbyProps['joy']; onNear: (n: boolean) => void; posRef: React.MutableRefObject<THREE.Vector3> }) {
  const target = useRef<THREE.Vector3 | null>(null)
  const keys = useRef(new Set<string>())
  const [view, setView] = useState<View>('front')
  const [moving, setMoving] = useState(false)
  const g = useRef<THREE.Group>(null)
  const near = useRef(false)
  const lastView = useRef<View>('front')
  const lastMoving = useRef(false)
  const { gl } = useThree()

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.current.add(k); e.preventDefault() }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  // 바닥을 눌러서 이동
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const onDown = (e: PointerEvent) => {
      const cam = (gl as any).__cam as THREE.Camera | undefined
      if (!cam) return
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, cam)
      const hit = new THREE.Vector3()
      if (ray.ray.intersectPlane(plane, hit)) {
        hit.x = THREE.MathUtils.clamp(hit.x, BOUND.x[0], BOUND.x[1]); hit.z = THREE.MathUtils.clamp(hit.z, BOUND.z[0], BOUND.z[1])
        target.current = hit
      }
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [gl])
  useEffect(() => { (window as any).__lobbyGoKiosk = () => { target.current = KIOSK_STAND.clone() } }, [])

  useFrame(({ camera }, dt) => {
    (gl as any).__cam = camera
    const p = posRef.current
    const dir = new THREE.Vector3()
    const k = keys.current
    if (k.has('arrowup') || k.has('w')) dir.add(U)
    if (k.has('arrowdown') || k.has('s')) dir.addScaledVector(U, -1)
    if (k.has('arrowright') || k.has('d')) dir.add(R)
    if (k.has('arrowleft') || k.has('a')) dir.addScaledVector(R, -1)
    const j = joy.current
    if (Math.abs(j.x) > 0.08 || Math.abs(j.y) > 0.08) { dir.addScaledVector(R, j.x).addScaledVector(U, -j.y) }
    let mag = Math.min(1, dir.length())
    if (dir.lengthSq() > 0.0001) target.current = null
    else if (target.current) {
      const to = target.current.clone().sub(p); to.y = 0
      if (to.length() < 0.12) { target.current = null } else { dir.copy(to); mag = 1 }
    }
    const isMoving = dir.lengthSq() > 0.0001
    if (isMoving) {
      dir.normalize()
      const step = 3.6 * mag * Math.min(dt, 0.05)
      const nx = p.x + dir.x * step, nz = p.z + dir.z * step
      let x = THREE.MathUtils.clamp(nx, BOUND.x[0], BOUND.x[1]), z = THREE.MathUtils.clamp(nz, BOUND.z[0], BOUND.z[1])
      for (const o of OBST) {
        const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz)
        if (d < o.r) { x = o.x + (dx / (d || 1)) * o.r; z = o.z + (dz / (d || 1)) * o.r }
      }
      p.x = x; p.z = z
      const v = viewFromDir(dir.x, dir.z)
      if (v !== lastView.current) { lastView.current = v; setView(v) }
    }
    if (isMoving !== lastMoving.current) { lastMoving.current = isMoving; setMoving(isMoving) }
    g.current?.position.set(p.x, 0, p.z)
    const n = Math.hypot(p.x - KIOSK.x, p.z - KIOSK.z) < 2.3
    if (n !== near.current) { near.current = n; onNear(n) }
  })
  return (
    <group ref={g} position={[posRef.current.x, 0, posRef.current.z]}>
      <Character avatar={me.avatar} view={view} x={0} z={0} squash={ISO_SQUASH} label={`${me.name} (나)`} tone="me" hop={moving} />
    </group>
  )
}

function Npc({ npc, seed }: { npc: LobbyProps['npcs'][number]; seed: number }) {
  const pos = useRef(new THREE.Vector3(-1 + seed * 1.3, 0, 1 + (seed % 3) * 0.8))
  const goal = useRef(new THREE.Vector3().copy(pos.current))
  const wait = useRef(Math.random() * 2)
  const g = useRef<THREE.Group>(null)
  const [view, setView] = useState<View>('front')
  const [moving, setMoving] = useState(false)
  const lv = useRef<View>('front'), lm = useRef(false)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const to = goal.current.clone().sub(pos.current)
    let mv = false
    if (to.length() > 0.1) {
      to.normalize()
      const nx = pos.current.x + to.x * 1.15 * dt, nz = pos.current.z + to.z * 1.15 * dt
      if (!OBST.some((o) => Math.hypot(nx - o.x, nz - o.z) < o.r)) { pos.current.x = nx; pos.current.z = nz; mv = true } else { goal.current.copy(pos.current) }
      const v = viewFromDir(to.x, to.z)
      if (v !== lv.current) { lv.current = v; setView(v) }
    } else {
      wait.current -= dt
      if (wait.current < 0) {
        wait.current = 1.5 + Math.random() * 3
        goal.current.set(THREE.MathUtils.randFloat(-6.5, 6.5), 0, THREE.MathUtils.randFloat(-3.2, 4.2))
      }
    }
    if (mv !== lm.current) { lm.current = mv; setMoving(mv) }
    g.current?.position.set(pos.current.x, 0, pos.current.z)
  })
  return (
    <group ref={g}>
      <Character avatar={npc.avatar} view={view} x={0} z={0} squash={ISO_SQUASH} label={npc.name} tone="npc" hop={moving} />
    </group>
  )
}

function Rig({ posRef, follow }: { posRef: React.MutableRefObject<THREE.Vector3>; follow: boolean }) {
  const { camera, size } = useThree()
  const look = useRef(new THREE.Vector3(0, 1.4, 0.2))
  useFrame((_, dt) => {
    const cam = camera as THREE.OrthographicCamera
    const fit = Math.min(size.width / 19.6, size.height / 13.2)
    const zoom = follow ? Math.max(fit, size.width < 520 ? 40 : 52) : fit
    if (Math.abs(cam.zoom - zoom) > 0.01) { cam.zoom = zoom; cam.updateProjectionMatrix() }
    const want = follow ? new THREE.Vector3(posRef.current.x, 1.0, posRef.current.z) : new THREE.Vector3(0, 1.5, 0.2)
    look.current.lerp(want, 1 - Math.pow(0.0015, dt))
    cam.position.set(look.current.x + 20, look.current.y + 20, look.current.z + 20)
    cam.lookAt(look.current)
  })
  return null
}

export default function LobbyScene({ me, npcs, joy, onNear, onKioskClick }: LobbyProps) {
  const posRef = useRef(new THREE.Vector3(-0.5, 0, 3.0))
  const nearRef = useRef(false)
  const [follow, setFollow] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const f = () => setFollow((wrap.current?.clientWidth ?? 1000) < 860)
    f()
    const ro = new ResizeObserver(f)
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={wrap} className="canvas-wrap absolute inset-0 no-select">
      <Canvas orthographic dpr={[1, 1.75]} camera={{ position: [20, 20, 20], zoom: 50, near: -100, far: 200 }} gl={{ antialias: true }}>
        <color attach="background" args={['#f1e9dc']} />
        <Lights />
        <Suspense fallback={null}>
          <RoomShell w={W} d={D} />
          <Rug />
          <Window p={[-3.4, 2.5, -D / 2 + 0.06]} />
          <Frame p={[0.6, 2.5, -D / 2 + 0.07]} art={0} />
          <Frame p={[1.8, 2.7, -D / 2 + 0.07]} art={2} s={[0.6, 0.8]} />
          <Clock p={[5.6, 2.9, -D / 2 + 0.08]} />
          <Frame p={[-W / 2 + 0.07, 2.6, 3.2]} r={Math.PI / 2} art={1} />
          <TVBoard p={[-W / 2 + 0.09, 2.5, -1.2]} r={Math.PI / 2} />
          <Sofa p={[-5.0, 0, -4.2]} />
          <Cabinet p={[-1.6, 0, -4.85]} />
          <Lamp p={[-7.2, 0, -4.6]} />
          <Plant p={[7, 0, -4.6]} s={1.15} />
          <Plant p={[-7.2, 0, 3.6]} s={0.9} />
          <Table p={[-4.6, 0, 1.6]} len={2.4} dep={1.1} />
          <Chair p={[-5.1, 0, 2.5]} r={Math.PI} />
          <Chair p={[-4.1, 0, 2.5]} r={Math.PI} />
          <Chair p={[-5.1, 0, 0.7]} r={0} />
          <Chair p={[-4.1, 0, 0.7]} r={0} />
          <Kiosk onClick={() => { onKioskClick(nearRef.current); if (!nearRef.current) (window as any).__lobbyGoKiosk?.() }} />
          {npcs.map((n, i) => <Npc key={n.id} npc={n} seed={i} />)}
          <Player me={me} joy={joy} posRef={posRef} onNear={(v) => { nearRef.current = v; onNear(v) }} />
          <Rig posRef={posRef} follow={follow} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export { C }
