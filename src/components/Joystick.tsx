import { useRef, useState } from 'react'

/** 모바일용 가상 조이스틱. 값은 ref에 -1..1로 써요 (x: 오른쪽, y: 아래쪽). */
export default function Joystick({ value }: { value: React.MutableRefObject<{ x: number; y: number }> }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)
  const R = 46
  const upd = (cx: number, cy: number) => {
    const r = base.current!.getBoundingClientRect()
    let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R }
    setKnob({ x: dx, y: dy })
    value.current = { x: dx / R, y: dy / R }
  }
  const end = () => { active.current = null; setKnob({ x: 0, y: 0 }); value.current = { x: 0, y: 0 } }
  return (
    <div
      ref={base}
      role="application"
      aria-label="이동 조이스틱"
      className="relative h-[128px] w-[128px] rounded-full bg-espresso/15 border-2 border-espresso/25 touch-none select-none backdrop-blur-sm"
      onPointerDown={(e) => { active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); upd(e.clientX, e.clientY) }}
      onPointerMove={(e) => { if (active.current === e.pointerId) upd(e.clientX, e.clientY) }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute left-1/2 top-1/2 h-14 w-14 -ml-7 -mt-7 rounded-full bg-paper shadow-clay border border-line" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
