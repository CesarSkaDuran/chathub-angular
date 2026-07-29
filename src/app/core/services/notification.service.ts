import { Injectable } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private audioCtx: AudioContext | null = null
  private originalTitle = document.title
  private flashInterval: any = null
  private flashing = false

  constructor() {
    this.requestPermission()

    window.addEventListener('focus', () => this.stopTitleFlash())
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.stopTitleFlash()
    })

    const unlockAudio = () => {
      this.ensureAudioContext()
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
    window.addEventListener('click', unlockAudio)
    window.addEventListener('keydown', unlockAudio)
  }

  private ensureAudioContext(): AudioContext | null {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return null
      if (!this.audioCtx) this.audioCtx = new Ctx()
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume()
      return this.audioCtx
    } catch {
      return null
    }
  }

  requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }

  /** Notifica de un mensaje entrante: sonido + parpadeo de título + notificación del navegador. */
  notify(text?: string) {
    this.playSound()

    if (document.hidden) {
      this.startTitleFlash()
      this.showBrowserNotification(text)
    }
  }

  private playSound() {
    try {
      const ctx = this.ensureAudioContext()
      if (!ctx) return
      const now = ctx.currentTime

      const playTone = (freq: number, start: number, duration: number, volume = 0.6) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, now + start)
        gain.gain.linearRampToValueAtTime(volume, now + start + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + start)
        osc.stop(now + start + duration + 0.05)
      }

      playTone(988, 0, 0.16, 0.7)
      playTone(1319, 0.14, 0.22, 0.7)
    } catch {
      // Silencioso: navegadores que bloquean audio sin interacción previa
    }
  }

  private startTitleFlash() {
    if (this.flashing) return
    this.flashing = true
    this.originalTitle = document.title

    this.flashInterval = setInterval(() => {
      document.title = document.title === this.originalTitle
        ? '🔔 Nuevo mensaje'
        : this.originalTitle
    }, 1000)
  }

  private stopTitleFlash() {
    if (!this.flashing) return
    this.flashing = false
    clearInterval(this.flashInterval)
    document.title = this.originalTitle
  }

  private showBrowserNotification(body?: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    try {
      const n = new Notification('ChatHub', {
        body: body || 'Tienes un nuevo mensaje',
        icon: '/favicon.ico',
        silent: true,
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
      setTimeout(() => n.close(), 6000)
    } catch {
      // Ignorar errores de notificación
    }
  }
}
