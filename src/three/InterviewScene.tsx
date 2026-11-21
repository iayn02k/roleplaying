import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import type { AvatarId, Role } from '../types'
import { Character, ISO_SQUASH, viewFromDir, type View } from './Character'
import { Box, Cabinet, Chair, Clock, Frame, Lamp, Lights, Plant, RoomShell, Table, TVBoard, Window } from './parts'

export interface Person {
  id: string
  name: string
  avatar: AvatarId
  role: Role
  idx: number
  seated: boolean
  speaking: boolean
  me: boolean
  tag?: string
}
export interface ISceneProps {
  people: Person[]
  mode: 'iso' | 'fpv'
  meId: string
  walk: boolean // 입장 중인지(걸어 들어오는 연출)
  onArrive: (id: string) => void
}

const W = 12, D = 9
const SEAT_Z = 1.2
const DOOR = new THREE.Vector3(4.2, 0, -3.7)
const CROP = 0.66
const SCALE = 1.05

const seatX = (n: number, idx: number) => (n <= 1 ? 0 : idx === 0 ? -1.15 : 1.15)

function Mover({ p, n, mode, meRole, walk, onArrive }: { p: Person; n: number; mode: 'iso' | 'fpv'; meRole: Role; walk: boolean; onArrive: (id: string) => void }) {
  const ee = p.role === 'interviewee'
  const stand = new THREE.Vector3(seatX(n, p.idx), 0, ee ? 2.55 : -2.55)
  const seat = new THREE.Vector3(seatX(n, p.idx), 0, ee ? SEAT_Z + 0.08 : -SEAT_Z - 0.08)
  const pos = useRef(walk ? DOOR.clone().add(new THREE.Vector3(p.idx * 0.5, 0, p.idx * 0.3 + (ee ? 0.5 : 0))) : seat.clone())
  const g = useRef<THREE.Group>(null)
  const [view, setView] = useState<View>(ee ? 'back' : 'front')
  const lv = useRef<View>(view)
  const [moving, setMoving] = useState(false)
  const lm = useRef(false)
  const arrived = useRef(!walk)
  const delay = useRef((p.idx + (ee ? 0 : 1)) * 0.7)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    let mv = false
    if (p.seated) {
      const to = seat.clone().sub(pos.current)
      if (to.length() > 0.04) { to.normalize(); pos.current.addScaledVector(to, 2.6 * dt); mv = true }
      else pos.current.copy(seat)
    } else if (delay.current > 0) delay.current -= dt
    else {
      const to = stand.clone().sub(pos.current)
      if (to.length() > 0.06) {
        to.normalize()
        pos.current.addScaledVector(to, 1.9 * dt)
        mv = true
        const v = viewFromDir(to.x, to.z)
        if (v !== lv.current) { lv.current = v; setView(v) }
      } else if (!arrived.current) { arrived.current = true; onArrive(p.id) }
    }
    if (mv !== lm.current) { lm.current = mv; setMoving(mv) }
    g.current?.position.set(pos.current.x, 0, pos.current.z)
  })
  if (mode === 'fpv' && p.me) return null
  let v: View = view
  if (p.seated || (!moving && arrived.current)) {
    if (mode === 'fpv') v = p.role !== meRole ? 'front' : 'back'
    else v = ee ? 'back' : 'front'
  }
  const crop = p.seated ? CROP : undefined
  return (
    <group ref={g} position={[pos.current.x, 0, pos.current.z]}>
      <Character
        avatar={p.avatar} view={v} x={0} z={0} y={p.seated ? 0.6 : 0} scale={SCALE} crop={crop}
        squash={mode === 'iso' ? ISO_SQUASH : 1} shadow={!p.seated}
        label={p.name + (p.me ? ' (나)' : '')} tone={p.me ? 'me' : p.role === 'interviewer' ? 'judge' : 'ee'} speaking={p.speaking} hop={moving}
      />
    </group>
  )
}

function IsoRig() {
  const { size, camera } = useThree()
  useFrame(() => {
    const cam = camera as THREE.OrthographicCamera
    const zoom = Math.min(size.width / 16.5, size.height / 12.2)
    if (Math.abs(cam.zoom - zoom) > 0.01) { cam.zoom = zoom; cam.updateProjectionMatrix() }
    cam.position.set(16, 17, 16)
    cam.lookAt(0, 1.2, 0)
  })
  return null
}

function FpvRig({ me, n }: { me: Person; n: number }) {
  const { camera, size } = useThree()
  const ee = me.role === 'interviewee'
  const x = seatX(n, me.idx)
  useFrame(({ clock }) => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const fov = aspect < 0.85 ? 78 : aspect < 1.2 ? 62 : 52
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix() }
    const s = clock.elapsedTime
    const back = aspect < 0.85 ? 1.5 : 1.15
    cam.position.set(x * 0.9 + Math.sin(s * 0.5) * 0.012, 1.55 + Math.sin(s * 0.9) * 0.01, ee ? SEAT_Z + back : -SEAT_Z - back)
    cam.lookAt(x * 0.15, 0.55, ee ? -SEAT_Z : SEAT_Z)
  })
  return null
}

function Door() {
  return (
    <group position={[4.2, 0, -D / 2 + 0.08]}>
      <Box p={[0, 1.15, 0]} s={[1.2, 2.3, 0.08]} c="#c9a27a" />
      <Box p={[0, 1.15, 0.05]} s={[1.0, 2.15, 0.03]} c="#d8b690" />
      <Box p={[0.35, 1.1, 0.09]} s={[0.07, 0.07, 0.05]} c="#6b5e55" />
    </group>
  )
}

export default function InterviewScene({ people, mode, meId, walk, onArrive }: ISceneProps) {
  const nEe = people.filter((p) => p.role === 'interviewee').length
  const nEr = people.filter((p) => p.role === 'interviewer').length
  const me = people.find((p) => p.id === meId) ?? people[0]
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  return (
    <div className="canvas-wrap absolute inset-0 no-select">
      <Canvas dpr={[1, 1.75]} gl={{ antialias: true }}>
        <color attach="background" args={['#efe7da']} />
        <Lights />
        {mode === 'iso'
          ? <OrthographicCamera makeDefault position={[16, 17, 16]} zoom={50} near={-100} far={200} />
          : <PerspectiveCamera makeDefault fov={52} near={0.1} far={60} position={[0, 1.3, 2]} />}
        {mode === 'iso' ? <IsoRig /> : me && <FpvRig me={me} n={me.role === 'interviewee' ? nEe : nEr} />}
        <Suspense fallback={null}>
          <RoomShell w={W} d={D} floor="#d6ccba" />
          <Window p={[-3.2, 2.45, -D / 2 + 0.06]} />
          <Frame p={[0.4, 2.55, -D / 2 + 0.07]} art={1} />
          <Frame p={[1.6, 2.7, -D / 2 + 0.07]} art={3} s={[0.6, 0.8]} />
          <Clock p={[-0.9, 3.1, -D / 2 + 0.08]} />
          <Door />
          <TVBoard p={[-W / 2 + 0.09, 2.5, 0]} r={Math.PI / 2} />
          <Frame p={[-W / 2 + 0.07, 2.4, -2.9]} r={Math.PI / 2} art={2} />
          <Cabinet p={[-5.0, 0, -3.9]} />
          <Lamp p={[-5.5, 0, 3.7]} />
          <Plant p={[5.2, 0, -3.6]} s={1.1} />
          <Plant p={[-5.3, 0, -0.8]} s={0.85} />
          {/* 반대편 벽 장식(1인칭에서만 보여요) */}
          {mode === 'fpv' && (
            <>
              <Window p={[-1.8, 2.4, D / 2 - 0.06]} r={Math.PI} />
              <Frame p={[2.4, 2.5, D / 2 - 0.07]} r={Math.PI} art={0} />
              <Frame p={[W / 2 - 0.07, 2.4, -1.5]} r={-Math.PI / 2} art={1} />
              <Plant p={[5.0, 0, 3.7]} s={1} />
            </>
          )}
          <Table len={5} dep={1.3} />
          {Array.from({ length: nEe }, (_, i) => i).filter((i) => !(mode === 'fpv' && me?.role === 'interviewee' && me.idx === i)).map((i) => <Chair key={'e' + i} p={[seatX(nEe, i), 0, SEAT_Z + 0.2]} r={Math.PI} />)}
          {Array.from({ length: nEr }, (_, i) => i).filter((i) => !(mode === 'fpv' && me?.role === 'interviewer' && me.idx === i)).map((i) => <Chair key={'r' + i} p={[seatX(nEr, i), 0, -SEAT_Z - 0.2]} r={0} />)}
          {ready && people.map((p) => (
            <Mover key={p.id} p={p} n={p.role === 'interviewee' ? nEe : nEr} mode={mode} meRole={me?.role ?? 'interviewee'} walk={walk} onArrive={onArrive} />
          ))}
        </Suspense>
      </Canvas>
    </div>
  )
}
