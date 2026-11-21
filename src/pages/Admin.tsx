import { useMemo, useState } from 'react'
import { CFG, DAY, HOUR, cx, dayKey, fmtDT, fmtDate, hhmm, layoutCap, now, startOfDay, useNow } from '../lib/core'
import { roomSeats, useDB } from '../lib/db'
import { Btn, Card, Chip, F, Field, inputCls, toast } from '../components/ui'
import { JOBS } from '../data/questions'
import type { Layout } from '../types'

export default function Admin() {
  const t = useNow(3000)
  const rooms = useDB((s) => s.rooms)
  const resv = useDB((s) => s.reservations)
  const users = useDB((s) => s.users)
  const requests = useDB((s) => s.requests)
  const addRoom = useDB((s) => s.addRoom)
  const open = useDB((s) => s.openRequest)
  const reject = useDB((s) => s.rejectRequest)
  const [day, setDay] = useState(0)
  const [hour, setHour] = useState(20)
  const [min, setMin] = useState(0)
  const [layout, setLayout] = useState<Layout>('2:2')
  const [job, setJob] = useState('전체')
  const [pickLayout, setPickLayout] = useState<Record<string, Layout>>({})
  const today = dayKey(t)
  const list = useMemo(() => Object.values(rooms).filter((r) => dayKey(r.startAt) >= today).sort((a, b) => a.startAt - b.startAt), [rooms, today])
  const base = startOfDay(t)
  return (
    <div className="space-y-6">
      <div>
        <Chip tone="sky">프로토타입 관리자 페이지</Chip>
        <h1 className="text-[28px] font-extrabold tracking-tight mt-2">관리자</h1>
        <p className="text-ink2 mt-1 text-[15px]">매일 오전 {CFG.openHour}시에 정해진 시간대({CFG.slotTimes.join(' · ')})마다 방 {CFG.roomsPerSlot}개를 열어요. 개설 요청을 확인하고 방을 직접 열 수도 있어요.</p>
        <F code="관리자가 열면 알림" className="mt-2 inline-block" />
      </div>

      <Card className="p-5">
        <h2 className="font-bold text-[17px]">개설 요청 ({requests.filter((q) => q.status === 'pending').length}건 대기)</h2>
        <div className="mt-3 space-y-2.5">
          {requests.length === 0 && <p className="text-[14px] text-ink3">들어온 요청이 없어요. 면접방 예약 화면의 “개설 요청하기”로 보낼 수 있어요.</p>}
          {requests.map((q) => (
            <div key={q.id} className="rounded-2xl border border-line p-3.5 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]"><div className="font-bold">{fmtDT(q.desiredAt)} · {q.job}</div><div className="text-[12px] text-ink3">요청자 {users[q.userId]?.nickname ?? '?'} · {q.status === 'pending' ? '대기 중' : q.status === 'opened' ? '열림' : '반려'}</div></div>
              {q.status === 'pending' && <>
                <select className="h-10 rounded-xl border border-line bg-white px-2 text-[14px]" value={pickLayout[q.id] ?? '2:2'} onChange={(e) => setPickLayout((s) => ({ ...s, [q.id]: e.target.value as Layout }))} aria-label="방 구성">{(['2:2', '2:1', '1:2', '1:1'] as Layout[]).map((l) => <option key={l}>{l}</option>)}</select>
                <Btn size="sm" v="leaf" onClick={() => { open(q.id, pickLayout[q.id] ?? '2:2'); toast('방을 열고 요청자에게 알림을 보냈어요.', 'ok') }}>방 열기</Btn>
                <Btn size="sm" v="ghost" onClick={() => reject(q.id)}>반려</Btn>
              </>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-[17px]">방 직접 열기</h2>
        <div className="mt-3 grid sm:grid-cols-5 gap-3 items-end">
          <Field label="날짜"><select className={inputCls} value={day} onChange={(e) => setDay(+e.target.value)}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={i}>{fmtDate(base + i * DAY)}</option>)}</select></Field>
          <Field label="시"><select className={inputCls} value={hour} onChange={(e) => setHour(+e.target.value)}>{Array.from({ length: 16 }, (_, i) => 8 + i).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}</select></Field>
          <Field label="분"><select className={inputCls} value={min} onChange={(e) => setMin(+e.target.value)}>{[0, 10, 20, 30, 40, 50].map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}</select></Field>
          <Field label="구성"><select className={inputCls} value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>{(['2:2', '2:1', '1:2', '1:1'] as Layout[]).map((l) => <option key={l}>{l}</option>)}</select></Field>
          <Field label="직군"><select className={inputCls} value={job} onChange={(e) => setJob(e.target.value)}>{['전체', ...JOBS].map((j) => <option key={j}>{j}</option>)}</select></Field>
        </div>
        <div className="mt-3"><Btn onClick={() => { addRoom({ startAt: base + day * DAY + hour * HOUR + min * 60_000, layout, job, createdBy: 'admin' }); toast('방을 열었어요.', 'ok') }}>방 열기</Btn></div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-[17px]">열린 방 ({list.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead><tr className="text-left text-ink2"><th className="py-2">시작</th><th>구성</th><th>직군</th><th>면접자</th><th>면접관</th><th /></tr></thead>
            <tbody>
              {list.map((r) => { const s = roomSeats({ rooms, reservations: resv }, r.id); return (
                <tr key={r.id} className="border-t border-line"><td className="py-2 font-semibold">{fmtDate(r.startAt)} {hhmm(r.startAt)}</td><td>{r.layout}</td><td>{r.job}</td>
                  <td className={cx(s.eeLeft === 0 && 'text-leaf-d font-bold')}>{s.ee.length}/{layoutCap(r.layout).ee}</td><td className={cx(s.erLeft === 0 && 'text-leaf-d font-bold')}>{s.er.length}/{layoutCap(r.layout).er}</td>
                  <td>{r.startAt > now() && <button className="text-danger text-[13px] font-semibold" onClick={() => useDB.setState((st) => ({ rooms: { ...st.rooms, [r.id]: { ...r, cancelled: true } } }))}>닫기</button>}</td></tr>) })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
