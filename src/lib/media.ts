import { useEffect, useRef, useState } from 'react'

/* ---------------- 음성 인식(STT) — 브라우저 내장 기능, 무료 ---------------- */
type AnyWin = Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }
export const sttSupported = () => typeof window !== 'undefined' && !!((window as AnyWin).SpeechRecognition || (window as AnyWin).webkitSpeechRecognition)

export interface STT { start: () => void; stop: () => void; active: () => boolean }
export function createSTT(onResult: (finalText: string, interim: string) => void, onError?: (e: string) => void): STT {
  const W = window as AnyWin
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition
  let rec: any = null
  let want = false
  let running = false
  const boot = () => {
    if (!Ctor || !want || running) return
    rec = new Ctor()
    rec.lang = 'ko-KR'
    rec.continuous = true
    rec.interimResults = true
    rec.onstart = () => { running = true }
    rec.onresult = (e: any) => {
      let fin = '', interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) fin += r[0].transcript
        else interim += r[0].transcript
      }
      onResult(fin, interim)
    }
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { want = false; onError?.('permission') }
      else if (e.error !== 'no-speech' && e.error !== 'aborted') onError?.(e.error)
    }
    rec.onend = () => { running = false; if (want) setTimeout(boot, 250) }
    try { rec.start() } catch { running = false }
  }
  return {
    start: () => { want = true; boot() },
    stop: () => { want = false; try { rec?.stop() } catch { /* ignore */ } },
    active: () => want,
  }
}

/* ---------------- 음성 합성(TTS) ---------------- */
export function speak(text: string, onEnd?: () => void) {
  if (typeof speechSynthesis === 'undefined') { onEnd?.(); return }
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'
    u.rate = 1.02
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('ko'))
    if (v) u.voice = v
    u.onend = () => onEnd?.()
    u.onerror = () => onEnd?.()
    speechSynthesis.speak(u)
  } catch { onEnd?.() }
}
export const stopSpeak = () => { try { speechSynthesis.cancel() } catch { /* ignore */ } }

/* ---------------- 마이크 레벨 ---------------- */
export interface Mic { stream: MediaStream; level: () => number; close: () => void }
export async function openMic(): Promise<Mic | null> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return null
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const AC = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AC()
    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser()
    an.fftSize = 512
    src.connect(an)
    const buf = new Uint8Array(an.fftSize)
    let smooth = 0
    return {
      stream,
      level: () => {
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
        const rms = Math.sqrt(sum / buf.length)
        smooth = smooth * 0.6 + Math.min(1, rms * 5) * 0.4
        return smooth
      },
      close: () => { stream.getTracks().forEach((t) => t.stop()); void ctx.close() },
    }
  } catch { return null }
}

/** 마이크를 열고 레벨을 state로 제공. enabled=false면 닫아요. */
export function useMic(enabled: boolean) {
  const micRef = useRef<Mic | null>(null)
  const [state, setState] = useState<'idle' | 'ready' | 'denied'>('idle')
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let alive = true, raf = 0, last = 0
    openMic().then((m) => {
      if (!alive) { m?.close(); return }
      if (!m) { setState('denied'); return }
      micRef.current = m
      setState('ready')
      const loop = (ts: number) => {
        if (ts - last > 60) { last = ts; setLevel(m.level()) }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })
    return () => { alive = false; cancelAnimationFrame(raf); micRef.current?.close(); micRef.current = null; setState('idle'); setLevel(0) }
  }, [enabled])
  return { mic: micRef, state, level }
}

/* ---------------- 녹음 + IndexedDB ---------------- */
export interface Recorder { stop: () => Promise<Blob>; startedAt: number }
export function startRecording(stream: MediaStream): Recorder | null {
  try {
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m))
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.start(1000)
    return {
      startedAt: Date.now(),
      stop: () => new Promise<Blob>((res) => {
        rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
        try { rec.stop() } catch { res(new Blob(chunks)) }
      }),
    }
  } catch { return null }
}

const DB_NAME = 'pm-rec'
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const q = indexedDB.open(DB_NAME, 1)
    q.onupgradeneeded = () => q.result.createObjectStore('rec')
    q.onsuccess = () => res(q.result)
    q.onerror = () => rej(q.error)
  })
}
export async function idbPut(key: string, val: unknown) {
  try {
    const db = await idb()
    await new Promise<void>((res, rej) => { const tx = db.transaction('rec', 'readwrite'); tx.objectStore('rec').put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  } catch { /* ignore */ }
}
export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await idb()
    return await new Promise<T | undefined>((res, rej) => { const q = db.transaction('rec').objectStore('rec').get(key); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error) })
  } catch { return undefined }
}
export interface RecBlob { blob: Blob; marks: { qid: string; t: number }[] }
