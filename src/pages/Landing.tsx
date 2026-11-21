import { useState } from 'react'
import { A } from '../lib/asset'
import { Link, useNavigate } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE, cx } from '../lib/core'
import { useAuth, useMe } from '../lib/db'
import { AvatarImg, Btn, Card, Chip, F, Ico } from '../components/ui'

const STATS = [
  { n: '33.3%', t: '면접 준비에서 가장 막막한 건 “말로 전달하기”', s: '답변을 쓰는 것보다 말로 하는 게 더 어려워요' },
  { n: '95.2%', t: '모의면접에 참여해 본 적이 없어요', s: '낯선 사람 앞이 부담스럽고, 일정·장소 잡기도 어려워요' },
  { n: '52.6%', t: 'AI로 연습해도 “긴장감이 없다”고 느껴요', s: '실제 사람 앞에서의 긴장은 AI가 대신해 주지 못해요' },
]
const VALUES = [
  { e: '📚', t: '양질의 질문 데이터', d: '날카롭고 당황스러운 질문과 질문 의도, 모범 답변 방향까지 한 세트로 보여줘요.', tag: '현직자 인터뷰로 채워가는 중' },
  { e: '🔄', t: '양쪽 시선의 연습', d: '면접자로 연습하고, 면접관이 되어 “왜 이 질문을 하는지”를 직접 체감해요.', tag: '면접권 교환' },
  { e: '🎭', t: '가볍게 시작하는 진짜 긴장감', d: '익명 아바타라 부담은 낮지만, 상대는 진짜 사람이라 실전 같은 긴장감이 있어요.', tag: '익명 · 사람 대 사람' },
]
const STEPS = [
  { n: '①', t: '면접방 예약', d: '로비 키오스크나 상단 버튼으로 시간대와 역할을 골라요. 면접자는 면접권 1장이 필요해요.' },
  { n: '②', t: '대기실', d: '시작 15분 전에 열려요. 마이크를 확인하고, 면접관은 자소서를 보며 커스텀 질문을 써요.' },
  { n: '③', t: '면접 진행', d: '총 30분. 1부 공통 질문 → 2부 커스텀 질문 → 3부 자유 질문(꼬리질문 가능)이에요.' },
  { n: '④', t: '피드백', d: '키워드와 한 줄 평을 남기고, 면접관에겐 좋아요를 보내요. 기록은 질문카드 보관함에 쌓여요.' },
]
const FAQ = [
  { q: '왜 메타버스인가요? 그냥 화상으로 하면 안 되나요?', a: '얼굴을 드러내는 부담 없이, 그래도 “자리에 앉아 면접관과 마주한 느낌”을 만들기 위해서예요. 시간대에 맞춰 방이 열리고 질문 카드·타이머·기록이 자동으로 진행돼서, 진행자를 따로 구할 필요도 없어요.' },
  { q: '익명인데 자소서·이력은 어떻게 쓰나요?', a: '등록은 선택이에요. 등록하면 면접 때 면접관에게 항상 공개돼서 2부 커스텀 질문을 받을 수 있어요. 등록하지 않으면 기본 인성면접만 가능하고, 2부는 공통 질문으로 진행돼요.' },
  { q: '면접권이 없으면 면접을 못 보나요?', a: '면접관으로 먼저 참여하면 면접이 끝난 뒤 면접권을 1장 받아요. 면접권이 없는 면접자에게는 면접관 참여를 제안해 드려요.' },
  { q: '예약하고 못 가면 어떻게 되나요?', a: '노쇼 경고가 쌓이고, 2회가 되면 이용이 제한돼요. 취소와 변경은 면접 1시간 전까지만 할 수 있어요.' },
]

export default function Landing() {
  const nav = useNavigate()
  const me = useMe()
  const browse = useAuth((s) => s.browse)
  const [open, setOpen] = useState<number | null>(0)
  const enter = () => nav(me ? '/lobby' : '/auth?mode=signup')
  const look = () => { if (!me) browse(); nav('/lobby') }
  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-30 px-3 sm:px-6 lg:px-10">
        <div className="w-full h-14 mt-3 pl-4 pr-2 rounded-full bg-white/90 backdrop-blur ring-1 ring-black/[.04] shadow-soft flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-extrabold text-[18px] tracking-tight"><img src={A('favicon.svg')} alt="" className="h-8 w-8" />{APP_NAME}</Link>
          <div className="flex-1" />
          {me ? <Btn size="sm" onClick={() => nav('/lobby')}>로비로 가기</Btn> : (<>
            <Btn size="sm" v="ghost" onClick={() => nav('/auth?mode=login')}>로그인</Btn>
            <Btn size="sm" onClick={() => nav('/auth?mode=signup')}>시작하기</Btn>
          </>)}
        </div>
      </header>

      {/* 히어로 */}
      <section className="w-full px-5 sm:px-8 lg:px-14 pt-10 pb-14 md:pt-16 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div className="animate-rise">
          <F code="F-02 메인 랜딩페이지" className="mb-3 inline-block" />
          <Chip tone="dark" className="mb-4 !px-3.5 !py-1.5">● 말로 하는 면접, 미리 해보는 곳</Chip>
          <h1 className="text-[34px] sm:text-[48px] xl:text-[60px] leading-[1.18] font-extrabold tracking-tight">
            현직자가 겪은 <span className="text-brand">날카로운 질문</span>으로,<br />면접자와 면접관을 오가며 연습해요
          </h1>
          <p className="mt-4 text-[17px] text-ink2 leading-relaxed max-w-[34em]">
            질문을 받아보고, 직접 던져보면서 면접을 <b className="text-ink">양쪽</b>에서 이해하게 되는 곳. 익명 아바타라 부담은 낮추고, 상대는 진짜 사람이라 긴장감은 그대로예요.
          </p>
          <div className="mt-7 flex gap-3 flex-wrap">
            <Btn size="lg" onClick={enter}>입장하기 <Ico.arrow /></Btn>
            <Btn size="lg" v="soft" onClick={look}>둘러보기</Btn>
          </div>
          <p className="mt-3 text-[13px] text-ink3">둘러보기는 로그인 없이 로비까지만 볼 수 있어요. 스크롤하면 서비스 소개를 읽을 수 있어요.</p>
        </div>
        <div className="relative h-[360px] sm:h-[460px] lg:h-[560px]" aria-hidden>
          <div className="absolute inset-0 rounded-[44px] bg-white ring-1 ring-black/[.04] shadow-soft overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-b from-[#f4f2ee] to-[#e8e5de]" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[20%] w-[70%] h-[15%] rounded-[22px] bg-white shadow-clay ring-1 ring-black/[.05]" />
            <div className="absolute right-6 top-6 h-24 w-24 rounded-full bg-brand-l" />
            <div className="absolute left-8 top-16 h-10 w-10 rounded-full bg-warn-l" />
          </div>
          <img src={A('sprites/girl_front.png')} alt="" className="absolute left-[9%] bottom-[22%] h-[54%] drop-shadow-xl" />
          <img src={A('sprites/man_front.png')} alt="" className="absolute left-1/2 -translate-x-1/2 bottom-[26%] h-[50%] drop-shadow-xl" />
          <img src={A('sprites/boy_back.png')} alt="" className="absolute right-[10%] bottom-[5%] h-[46%] drop-shadow-xl" />
          <div className="absolute left-4 top-5 rounded-full bg-white shadow-soft ring-1 ring-black/[.05] pl-2.5 pr-3.5 py-1.5 text-[13px] font-bold flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-warn" />왜 하필 저희여야 하나요?</div>
          <div className="absolute right-4 top-[34%] rounded-full bg-espresso text-white shadow-soft px-3.5 py-1.5 text-[13px] font-bold flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-leaf animate-blink" />1부 · 공통 질문 08:12</div>
          <div className="absolute left-4 bottom-5 rounded-full bg-white shadow-soft ring-1 ring-black/[.05] px-3.5 py-1.5 text-[13px] font-bold flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand" />면접자 2 : 면접관 2</div>
        </div>
      </section>

      {/* 문제 */}
      <section>
        <div className="w-full px-5 sm:px-8 lg:px-14 py-14">
          <h2 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight">면접 준비, 사실 말하는 게 제일 막막해요</h2>
          <p className="text-ink2 mt-2">5팀 유저 리서치 · 설문 105명 (11/17~20)</p>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {STATS.map((s) => (
              <Card key={s.n} className="p-6">
                <div className="text-[44px] font-extrabold text-brand leading-none tabular-nums">{s.n}</div>
                <div className="mt-3 text-[17px] font-bold leading-snug">{s.t}</div>
                <p className="mt-2 text-[14px] text-ink2">{s.s}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 가치 */}
      <section className="w-full px-5 sm:px-8 lg:px-14 py-14">
        <h2 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight">우리가 만드는 가치는 세 가지예요</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {VALUES.map((v) => (
            <Card key={v.t} className="p-6">
              <div className="h-12 w-12 rounded-full bg-brand-l grid place-items-center text-[22px]" aria-hidden>{v.e}</div>
              <h3 className="mt-3 text-[19px] font-bold">{v.t}</h3>
              <p className="mt-1.5 text-[15px] text-ink2 leading-relaxed">{v.d}</p>
              <Chip className="mt-4">{v.tag}</Chip>
            </Card>
          ))}
        </div>
        <p className="mt-5 text-[14px] text-ink3">재미는 진입 장벽을 낮추는 수단이에요. 캐릭터와 분위기는 가볍게, 질문과 진행은 진지하고 정확하게 가요.</p>
      </section>

      {/* 진행 */}
      <section className="bg-espresso text-white mx-3 rounded-[40px]">
        <div className="w-full px-5 sm:px-8 lg:px-14 py-14">
          <h2 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight">이렇게 진행돼요</h2>
          <p className="text-cream/70 mt-2">예약 → 대기실 → 면접(30분) → 피드백. 알아서 굴러가는 면접방이에요.</p>
          <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-[28px] bg-white/[.07] border border-white/10 p-5">
                <div className="h-9 w-9 rounded-full bg-brand text-white font-extrabold grid place-items-center">{s.n}</div>
                <h3 className="mt-3 text-[18px] font-bold">{s.t}</h3>
                <p className="mt-1.5 text-[14px] text-cream/75 leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 비교 */}
      <section className="w-full px-5 sm:px-8 lg:px-14 py-14">
        <h2 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight">기존 방법과 이렇게 달라요</h2>
        <div className="mt-6 overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[640px] text-[14px] border-separate border-spacing-0 rounded-[28px] overflow-hidden border border-line bg-paper">
            <thead>
              <tr className="bg-sand text-ink2 text-left">
                {['', '면접 스터디', 'AI 모의면접', '현직자 1:1', APP_NAME].map((h, i) => <th key={i} className={cx('px-4 py-3 font-bold', i === 4 && 'bg-brand text-white')}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ['질문 품질', '들쭉날쭉', '생성형 (출처 불명)', '높음', '현직자 질문 + 의도 + 모범 답변 방향'],
                ['실전 긴장감', '낮음 (지인)', '없음', '높음', '높음 (낯선 진짜 사람)'],
                ['면접관 시선 경험', '일부', '없음', '없음', '역할 교대로 구조적 제공'],
                ['비용·접근성', '무료, 모집 수고', '저렴', '비쌈', '무료, 예약만 하면 매칭'],
                ['부담감', '얼굴·관계 노출', '낮음', '얼굴 노출', '익명 아바타'],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-line">
                  {r.map((c, i) => <td key={i} className={cx('px-4 py-3 border-t border-line align-top', i === 0 && 'font-bold', i === 4 && 'bg-brand-l/50 font-semibold text-ink')}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-5 pb-14">
        <h2 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight">자주 묻는 질문</h2>
        <div className="mt-6 space-y-2.5">
          {FAQ.map((f, i) => (
            <Card key={f.q} className="overflow-hidden">
              <button className="w-full text-left px-5 py-4 flex items-center gap-3 font-bold text-[16px]" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span className="flex-1">{f.q}</span><span className={cx('transition text-ink3', open === i && 'rotate-45')}>＋</span>
              </button>
              {open === i && <p className="px-5 pb-5 -mt-1 text-[15px] text-ink2 leading-relaxed">{f.a}</p>}
            </Card>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="w-full rounded-[40px] bg-brand text-white p-8 sm:p-12 text-center shadow-glow">
          <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight">오늘 밤, 면접방에 앉아볼까요?</h2>
          <p className="mt-2 text-white/85">{APP_TAGLINE}</p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Btn size="lg" v="dark" onClick={enter}>입장하기</Btn>
            <Btn size="lg" className="!bg-white/20 hover:!bg-white/30 !shadow-none" onClick={look}>둘러보기</Btn>
          </div>
          <div className="mt-8 flex justify-center gap-2" aria-hidden>
            <AvatarImg id="boy" size={64} /><AvatarImg id="girl" size={64} /><AvatarImg id="man" size={64} />
          </div>
        </div>
        <p className="text-center text-[12px] text-ink3 mt-6">{APP_NAME}은 가칭이에요 · 디프만 19기 5팀 프로토타입 · 질문 데이터는 샘플이에요</p>
      </section>
    </div>
  )
}
