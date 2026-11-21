import { useMemo, useRef } from 'react'
import { A } from '../lib/asset'
import * as THREE from 'three'
import { Html, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { AvatarId } from '../types'
import { BlobShadow } from './parts'

export type View = 'front' | 'back' | 'left' | 'right'
const AV: AvatarId[] = ['boy', 'girl', 'man']
const VIEWS: View[] = ['front', 'back', 'left', 'right']
const URLS = AV.flatMap((a) => VIEWS.map((v) => A(`sprites/${a}_${v}.png`)))
useTexture.preload(URLS)

const UNIT = 1.5 / 300 // 스프라이트 1px = 월드 단위
export const ISO_SQUASH = 1.2247 // 아이소 카메라에서 세로가 줄어드는 만큼 보정

export interface CharProps {
  avatar: AvatarId
  view?: View
  x: number
  z: number
  y?: number
  scale?: number
  squash?: number // 세로 보정
  crop?: number // 앉은 모습: 위쪽 이 비율만 보여줘요
  label?: string
  tone?: 'me' | 'npc' | 'judge' | 'ee'
  speaking?: boolean
  hop?: boolean
  shadow?: boolean
  bubble?: string
}

const TONE = {
  me: 'bg-brand text-white', npc: 'bg-paper/95 text-ink border border-line', judge: 'bg-espresso text-cream', ee: 'bg-leaf text-white',
}

export function Character({ avatar, view = 'front', x, z, y = 0, scale = 1, squash = 1, crop, label, tone = 'npc', speaking, hop, shadow = true, bubble }: CharProps) {
  const tex = useTexture(A(`sprites/${avatar}_${view}.png`)) as THREE.Texture
  const t = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    if (!crop) return tex
    const c = tex.clone()
    c.needsUpdate = true
    c.repeat.set(1, crop)
    c.offset.set(0, 1 - crop)
    return c
  }, [tex, crop])
  const img = tex.image as { width: number; height: number }
  const W = img.width * UNIT * scale
  const H = img.height * UNIT * scale * (crop ?? 1)
  const g = useRef<THREE.Group>(null)
  const bb = useRef<THREE.Group>(null)
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock, camera }) => {
    // 카메라가 보는 방향으로 스프라이트를 돌려요 (세로축 기준)
    if (bb.current) { camera.getWorldDirection(dir); bb.current.rotation.y = Math.atan2(-dir.x, -dir.z) }
    if (!g.current) return
    const s = clock.elapsedTime
    g.current.position.y = y + (hop ? Math.abs(Math.sin(s * 11)) * 0.07 : 0)
    g.current.scale.y = speaking ? 1 + Math.sin(s * 16) * 0.025 : 1
  })
  return (
    <group position={[x, 0, z]}>
      {shadow && <BlobShadow p={[0, 0, 0]} s={scale} />}
      <group ref={g}>
        <group ref={bb}>
          <mesh position={[0, (H * squash) / 2, 0]} scale={[1, squash, 1]}>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial map={t} transparent alphaTest={0.08} toneMapped={false} />
          </mesh>
        </group>
        {label && (
          <Html position={[0, H * squash + 0.18, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="flex flex-col items-center gap-1 whitespace-nowrap select-none">
              {bubble && <div className="max-w-[200px] truncate rounded-xl bg-white px-2.5 py-1 text-[12px] font-semibold text-ink shadow-soft border border-line">{bubble}</div>}
              <div className={`rounded-full px-2.5 py-[3px] text-[12px] font-bold leading-none shadow-soft ${TONE[tone]}`}>
                {speaking && <span className="mr-1 inline-block animate-blink">●</span>}
                {label}
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

export function viewFromDir(dx: number, dz: number): View {
  // 아이소 카메라(+x,+z에서 바라봄): 화면 오른쪽 = (1,0,-1), 화면 아래(카메라 쪽) = (1,0,1)
  const sx = (dx - dz) / Math.SQRT2
  const sy = (dx + dz) / Math.SQRT2
  if (Math.abs(sx) > Math.abs(sy)) return sx > 0 ? 'right' : 'left'
  return sy > 0 ? 'front' : 'back'
}
