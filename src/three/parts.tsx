import { useMemo } from 'react'
import * as THREE from 'three'

export const C = {
  wall: '#ebe4d8', wallDk: '#ddd3c4', wallTop: '#f8f5ef', slab: '#f6f3ed', carpet: '#d3c8b6', carpetEdge: '#bdb19d',
  wood: '#c9935c', woodDk: '#a8733f', white: '#fbfaf7', cream: '#efe9dd', green: '#5e9150', greenDk: '#467a3c', pot: '#f4f0e9',
  chair: '#eee7da', metal: '#9ea3a8', dark: '#3b3733', brand: '#c24e1a', sky: '#cfe3f2',
}

export function makeTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  draw(cv.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function Box({ p, s, c, r = 0, ...rest }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number } & Record<string, unknown>) {
  return (
    <mesh position={p} rotation={[0, r, 0]} {...rest}>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}
export function Cyl({ p, r, h, c, seg = 20, r2 }: { p: [number, number, number]; r: number; h: number; c: string; seg?: number; r2?: number }) {
  return (
    <mesh position={p}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

export function Plant({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 0.3, 0]} r={0.34} r2={0.28} h={0.6} c={C.pot} />
      <Cyl p={[0, 0.6, 0]} r={0.3} h={0.04} c="#6b4f3a" />
      {[[0, 1.05, 0, 0.5], [-0.28, 0.9, 0.1, 0.38], [0.3, 0.95, -0.1, 0.4], [0.05, 1.4, 0.05, 0.36], [-0.12, 1.2, -0.25, 0.3]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.85, 0.35]} rotation={[0, i * 1.1, 0]}>
          <sphereGeometry args={[r, 14, 12]} />
          <meshLambertMaterial color={i % 2 ? C.greenDk : C.green} />
        </mesh>
      ))}
    </group>
  )
}
export function SmallPlant({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.07, 0]} r={0.1} r2={0.08} h={0.14} c={C.pot} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.6) * 0.06, 0.24, Math.sin(i * 1.6) * 0.06]} rotation={[0.4 * (i % 2 ? 1 : -1), i, 0.3]} scale={[0.3, 1, 0.12]}>
          <sphereGeometry args={[0.14, 8, 8]} />
          <meshLambertMaterial color={C.green} />
        </mesh>
      ))}
    </group>
  )
}

export function Chair({ p, r = 0, c = C.chair }: { p: [number, number, number]; r?: number; c?: string }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.47, 0]} s={[0.62, 0.12, 0.6]} c={c} />
      <Box p={[0, 0.88, -0.27]} s={[0.6, 0.62, 0.1]} c={c} />
      <Cyl p={[0, 0.25, 0]} r={0.04} h={0.4} c={C.metal} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} p={[Math.cos((i / 5) * 6.283) * 0.22, 0.04, Math.sin((i / 5) * 6.283) * 0.22]} s={[0.4, 0.04, 0.05]} c={C.metal} r={-(i / 5) * 6.283} />
      ))}
    </group>
  )
}

export function Table({ p = [0, 0, 0], len = 5, dep = 1.3 }: { p?: [number, number, number]; len?: number; dep?: number }) {
  return (
    <group position={p}>
      <Box p={[0, 0.74, 0]} s={[len, 0.08, dep]} c={C.white} />
      <Box p={[0, 0.785, 0]} s={[len * 0.98, 0.012, 0.34]} c={C.wood} />
      <Box p={[-len / 2 + 0.35, 0.37, 0]} s={[0.1, 0.74, dep - 0.25]} c={C.wood} />
      <Box p={[len / 2 - 0.35, 0.37, 0]} s={[0.1, 0.74, dep - 0.25]} c={C.wood} />
      <SmallPlant p={[1.7, 0.8, 0.3]} />
      <Box p={[-1.7, 0.82, 0.3]} s={[0.42, 0.05, 0.3]} c="#e3b84a" r={0.2} />
      <Box p={[-1.7, 0.87, 0.3]} s={[0.4, 0.04, 0.28]} c="#2f6d8a" r={0.2} />
    </group>
  )
}

export function Lamp({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {[0, 2.1, 4.2].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.18, 0.7, Math.sin(a) * 0.18]} rotation={[Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]}>
          <cylinderGeometry args={[0.02, 0.02, 1.45, 6]} />
          <meshLambertMaterial color="#8b3a22" />
        </mesh>
      ))}
      <Cyl p={[0, 1.55, 0]} r={0.26} h={0.36} c="#fffaf0" />
      <Cyl p={[0, 1.76, 0]} r={0.05} h={0.04} c="#b43c1e" />
    </group>
  )
}

export function Cabinet({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.5, 0]} s={[1.1, 1, 0.7]} c={C.white} />
      {[0.22, 0.5, 0.78].map((y) => <Box key={y} p={[0, y, 0.355]} s={[0.96, 0.02, 0.01]} c="#d8d2c6" />)}
      <Box p={[-0.3, 1.2, 0]} s={[0.12, 0.4, 0.14]} c="#4e9b6a" />
      <Box p={[-0.15, 1.15, 0]} s={[0.1, 0.3, 0.12]} c="#2f7d5b" />
      <Box p={[0.2, 1.1, 0]} s={[0.22, 0.2, 0.18]} c="#4f7f9e" />
    </group>
  )
}

export function Sofa({ p, r = 0, c = '#dbcdb6' }: { p: [number, number, number]; r?: number; c?: string }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.3, 0]} s={[2.4, 0.5, 0.95]} c={c} />
      <Box p={[0, 0.72, -0.36]} s={[2.4, 0.5, 0.24]} c={c} />
      <Box p={[-1.12, 0.52, 0]} s={[0.24, 0.5, 0.95]} c={c} />
      <Box p={[1.12, 0.52, 0]} s={[0.24, 0.5, 0.95]} c={c} />
      <Box p={[-0.5, 0.6, 0.05]} s={[0.9, 0.14, 0.7]} c="#e7dcc7" />
      <Box p={[0.5, 0.6, 0.05]} s={[0.9, 0.14, 0.7]} c="#e7dcc7" />
      <Box p={[0.8, 0.72, -0.15]} s={[0.4, 0.4, 0.14]} c={C.brand} r={0.3} />
    </group>
  )
}

export function Frame({ p, r = 0, s = [0.8, 1.05], art = 0 }: { p: [number, number, number]; r?: number; s?: [number, number]; art?: number }) {
  const tex = useMemo(
    () => makeTex(160, 210, (c, w, h) => {
      c.fillStyle = '#f7f2ea'; c.fillRect(0, 0, w, h)
      const cols = ['#c24e1a', '#2f7d5b', '#3a2e29', '#e3b84a']
      c.fillStyle = cols[art % 4]; c.beginPath(); c.arc(w * 0.5, h * 0.4, w * 0.26, 0, 7); c.fill()
      c.fillStyle = cols[(art + 1) % 4]; c.fillRect(w * 0.18, h * 0.66, w * 0.64, h * 0.1)
      c.fillStyle = cols[(art + 2) % 4]; c.fillRect(w * 0.3, h * 0.8, w * 0.4, h * 0.06)
    }),
    [art],
  )
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0, 0]} s={[s[0] + 0.1, s[1] + 0.1, 0.05]} c="#8b3a22" />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={s} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Clock({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.06, 28]} />
        <meshLambertMaterial color="#2b2724" />
      </mesh>
      <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.02, 28]} />
        <meshLambertMaterial color="#f5f1ea" />
      </mesh>
      <Box p={[0, 0.08, 0.06]} s={[0.025, 0.17, 0.01]} c="#2b2724" />
      <Box p={[0.07, 0, 0.06]} s={[0.12, 0.025, 0.01]} c="#2b2724" />
    </group>
  )
}

export function Window({ p, r = 0, w = 1.9, h = 1.7 }: { p: [number, number, number]; r?: number; w?: number; h?: number }) {
  const tex = useMemo(
    () => makeTex(256, 256, (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#fff8e6'); g.addColorStop(1, '#f4fbff')
      c.fillStyle = g; c.fillRect(0, 0, W, H)
      c.fillStyle = '#e9854a'
      for (let i = 0; i < 26; i++) { c.beginPath(); c.ellipse(70 + Math.sin(i * 2.3) * 55 + i * 2, 170 - (i % 9) * 11, 14, 8, i, 0, 7); c.fill() }
      c.fillStyle = '#6f9a5a'
      for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(80 + Math.cos(i * 1.7) * 50, 150 + (i % 5) * 9, 11, 7, i, 0, 7); c.fill() }
      c.fillStyle = '#c9936a'; c.fillRect(104, 200, 14, 60)
    }),
    [],
  )
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0, -0.02]} s={[w + 0.2, h + 0.2, 0.08]} c="#f4f1ea" />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <Box p={[0, 0, 0.05]} s={[0.07, h, 0.05]} c="#f4f1ea" />
      <Box p={[0, 0, 0.05]} s={[w, 0.07, 0.05]} c="#f4f1ea" />
      <Box p={[0, h / 2 + 0.2, 0.05]} s={[w + 0.3, 0.3, 0.14]} c="#f7f5f0" />
    </group>
  )
}

export function TVBoard({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  const tex = useMemo(
    () => makeTex(512, 300, (c, w, h) => {
      c.fillStyle = '#2b2724'; c.fillRect(0, 0, w, h)
      c.fillStyle = '#f2e6d8'; c.fillRect(30, 36, 150, 190)
      c.fillStyle = '#c24e1a'; c.fillRect(48, 150, 80, 60)
      c.fillStyle = '#fff'; c.font = '700 28px sans-serif'; c.fillText('오늘의 면접', 215, 78)
      c.fillStyle = '#e3b84a'; c.fillRect(215, 100, 130, 12); c.fillRect(215, 128, 200, 12); c.fillRect(215, 156, 90, 12)
      c.fillStyle = '#2f7d5b'; c.fillRect(380, 200, 90, 60)
    }),
    [],
  )
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0, 0]} s={[2.5, 1.45, 0.07]} c="#2b2724" />
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[2.38, 1.33]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** 바닥 + 슬래브 + 벽 (가까운 두 벽은 면이 안쪽을 향해 있어 아이소 카메라에선 보이지 않아요) */
export function RoomShell({ w, d, h = 4.2, floor = C.carpet }: { w: number; d: number; h?: number; floor?: string }) {
  const carpetTex = useMemo(
    () => makeTex(256, 256, (c, W, H) => {
      c.fillStyle = floor; c.fillRect(0, 0, W, H)
      for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(${90 + (i % 40)},${80 + (i % 30)},${60 + (i % 20)},0.05)`; c.fillRect(Math.random() * W, Math.random() * H, 2, 1) }
    }),
    [floor],
  )
  useMemo(() => { carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping; carpetTex.repeat.set(w / 3, d / 3) }, [carpetTex, w, d])
  const half = { x: w / 2, z: d / 2 }
  return (
    <group>
      {/* 슬래브 */}
      <Box p={[0, -0.18, 0]} s={[w + 0.5, 0.3, d + 0.5]} c={C.slab} />
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshLambertMaterial map={carpetTex} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.001, 0.001, 4]} />
        <meshBasicMaterial color={C.carpetEdge} />
      </mesh>
      {/* 안쪽 테두리 선 */}
      {[[0, -half.z + 0.35, w - 0.7, 0.05], [0, half.z - 0.35, w - 0.7, 0.05], [-half.x + 0.35, 0, 0.05, d - 0.7], [half.x - 0.35, 0, 0.05, d - 0.7]].map(([x, z, sw, sd], i) => (
        <mesh key={i} position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[sw, sd]} />
          <meshBasicMaterial color={C.carpetEdge} />
        </mesh>
      ))}
      {/* 뒤쪽 벽 (두께 있음) */}
      <Box p={[0, h / 2, -half.z - 0.12]} s={[w + 0.5, h, 0.28]} c={C.wall} />
      <Box p={[0, h + 0.02, -half.z - 0.12]} s={[w + 0.5, 0.06, 0.3]} c={C.wallTop} />
      <Box p={[-half.x - 0.12, h / 2, 0]} s={[0.28, h, d + 0.5]} c={C.wall} />
      <Box p={[-half.x - 0.12, h + 0.02, 0]} s={[0.3, 0.06, d + 0.5]} c={C.wallTop} />
      <Box p={[0, 0.16, -half.z + 0.02]} s={[w, 0.32, 0.05]} c={C.wallDk} />
      <Box p={[-half.x + 0.02, 0.16, 0]} s={[0.05, 0.32, d]} c={C.wallDk} />
      <Box p={[0, h * 0.78, -half.z + 0.02]} s={[w, 0.03, 0.03]} c={C.wallDk} />
      <Box p={[-half.x + 0.02, h * 0.78, 0]} s={[0.03, 0.03, d]} c={C.wallDk} />
      {/* 앞쪽 벽(면이 안쪽을 향함: 1인칭에서만 보여요) */}
      <mesh position={[0, h / 2, half.z]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshLambertMaterial color={C.wall} />
      </mesh>
      <mesh position={[half.x, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[d, h]} />
        <meshLambertMaterial color={C.wall} />
      </mesh>
      <mesh position={[0, h - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshLambertMaterial color="#f6f2ea" />
      </mesh>
    </group>
  )
}

export function Lights() {
  return (
    <>
      <ambientLight intensity={2.3} />
      <hemisphereLight args={['#fff9ef', '#d9ccb6', 1.5]} />
      <directionalLight position={[6, 12, 6]} intensity={1.6} color="#fff3e0" />
    </>
  )
}

const blobTex = (() => {
  let t: THREE.CanvasTexture | null = null
  return () => {
    if (!t) {
      t = makeTex(64, 64, (c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(50,38,30,0.38)'); g.addColorStop(1, 'rgba(50,38,30,0)')
        c.fillStyle = g; c.fillRect(0, 0, w, h)
      })
    }
    return t
  }
})()
export function BlobShadow({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <mesh position={[p[0], 0.012, p[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[1.25 * s, 0.9 * s]} />
      <meshBasicMaterial map={blobTex()} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
