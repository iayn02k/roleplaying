export type AvatarId = 'boy' | 'girl' | 'man'
export type Role = 'interviewee' | 'interviewer'
export type Layout = '2:2' | '2:1' | '1:2' | '1:1'

export interface Resume {
  job: string
  intro: string // 자기소개/자소서
  career: string // 이력·경험
}

export interface User {
  id: string
  bot?: boolean
  email: string
  pw: string // 프로토타입: 해시(SHA-256) 문자열
  nickname: string
  avatar: AvatarId
  resume: Resume | null
  tickets: number // 면접권
  warnings: number // 노쇼 경고 (본인만 확인)
  restrictedUntil: number | null
  level: number
  likes: number
  badges: string[]
  createdAt: number
}

export interface Room {
  id: string
  startAt: number
  layout: Layout
  job: string
  title?: string
  note?: string
  createdBy: 'system' | 'admin' | 'request'
  /** 사람이 먼저 쓴 커스텀 질문: 면접자 userId -> 질문들 */
  custom: Record<string, CustomQuestion[]>
  customDone: Record<string, boolean> // 면접관 userId -> 마무리
  botNoShow?: boolean // 데모: 상대 노쇼 시뮬레이션
  cancelled?: boolean
}

export interface CustomQuestion {
  id: string
  text: string
  intent: string
  by: string
}

export type ResStatus = 'booked' | 'cancelled' | 'done' | 'noshow'

export interface Reservation {
  id: string
  roomId: string
  userId: string
  role: Role
  status: ResStatus
  record: boolean // 녹음 여부 (면접자)
  attended: boolean
  createdAt: number
  ticketHeld: boolean
  skin?: AvatarId // 면접관 외형 (랜덤)
  reason?: string
}

export interface OpenRequest {
  id: string
  userId: string
  desiredAt: number
  job: string
  status: 'pending' | 'opened' | 'rejected'
  createdAt: number
  roomId?: string
}

export interface Notice {
  id: string
  userId: string
  text: string
  at: number
  read: boolean
  link?: string
  kind: 'info' | 'warn' | 'ok'
}

export interface QA {
  id: string
  qid?: string
  text: string
  intent: string
  direction: string
  kind: 'common' | 'custom' | 'free' | 'followup'
  part: 1 | 2 | 3
  tag?: string
  to: string // 면접자 userId
  by: string // 면접관 userId
  answer: string
  t0: number // 질문 시각(ms, 면접 시작 기준 상대)
}

export interface InterviewRecord {
  id: string
  roomId: string
  userId: string
  role: Role
  at: number
  startAt: number
  layout: Layout
  qa: QA[] // 면접자: 내가 받은 질문 / 면접관: 내가 던진 질문
  hasRecording: boolean
  peers: { userId: string; role: Role }[]
}

export interface Feedback {
  id: string
  roomId: string
  from: string
  to: string
  kind: 'keywords' | 'like'
  keywords?: string[]
  comment?: string
  like?: boolean
  at: number
}

export interface Question {
  id: string
  text: string
  intent: string
  direction: string
  tag: '경험' | '가치관' | '압박' | '꼬리' | '황당' | '인성'
}
