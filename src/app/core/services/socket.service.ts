import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'
import { io, Socket } from 'socket.io-client'
import { AuthService } from './auth.service'
import { AppConfigService } from './app-config.service'

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket!: Socket
  message$       = new Subject<any>()
  convUpdated$   = new Subject<any>()
  channelQr$     = new Subject<any>()
  channelStatus$ = new Subject<any>()
  typing$        = new Subject<any>()

  constructor(private auth: AuthService, private cfg: AppConfigService) {}

  connect() {
    const token = this.auth.getToken()
    if (!token) return
    if (this.socket?.connected) return

    this.socket = io(this.cfg.socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    this.socket.on('connect', () => console.log('[Socket] Conectado'))
    this.socket.on('disconnect', () => console.log('[Socket] Desconectado'))
    this.socket.on('connect_error', (e) => console.warn('[Socket] Error:', e.message))

    this.socket.on('message:new',          (d) => this.message$.next(d))
    this.socket.on('conversation:updated', (d) => this.convUpdated$.next(d))
    this.socket.on('channel:qr',           (d) => this.channelQr$.next(d))
    this.socket.on('channel:status',       (d) => this.channelStatus$.next(d))
    this.socket.on('typing:start',         (d) => this.typing$.next({ ...d, active: true }))
    this.socket.on('typing:stop',          (d) => this.typing$.next({ ...d, active: false }))
  }

  disconnect() { this.socket?.disconnect() }

  joinConversation(id: number)  { this.socket?.emit('join:conversation', id) }
  leaveConversation(id: number) { this.socket?.emit('leave:conversation', id) }
  typingStart(convId: number)   { this.socket?.emit('typing:start', { conversation_id: convId }) }
  typingStop(convId: number)    { this.socket?.emit('typing:stop',  { conversation_id: convId }) }
}
