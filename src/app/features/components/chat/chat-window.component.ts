import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../../core/services/api.service'
import { SocketService } from '../../../core/services/socket.service'
import { AuthService } from '../../../core/services/auth.service'
import { Subscription } from 'rxjs'

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss'
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('msgArea') msgArea!: ElementRef
  @ViewChild('msgInput') msgInput!: ElementRef

  conv        = signal<any>(null)
  messages    = signal<any[]>([])
  agents      = signal<any[]>([])
  loadingMsgs = signal(false)
  sending     = signal(false)
  typingUser  = signal<string | null>(null)
  messageText = ''

  private subs: Subscription[] = []
  private typingTimer: any
  private shouldScroll = false
  private currentConvId = 0

  statuses = [
    { value: 'open',     label: 'Abierto' },
    { value: 'pending',  label: 'Pendiente' },
    { value: 'resolved', label: 'Resuelto' },
  ]

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    public auth: AuthService,
    private socket: SocketService
  ) {}

  ngOnInit() {
    this.subs.push(
      this.route.params.subscribe(p => {
        const id = +p['id']
        if (id && id !== this.currentConvId) {
          if (this.currentConvId) this.socket.leaveConversation(this.currentConvId)
          this.currentConvId = id
          this.loadConversation(id)
        }
      }),
      this.socket.message$.subscribe(msg => {
        if (msg.conversation_id === this.currentConvId) {
          this.messages.update(m => [...m, msg])
          this.shouldScroll = true
          this.api.markRead(this.currentConvId).subscribe()
        }
      }),
      this.socket.convUpdated$.subscribe(updated => {
        if (updated.id === this.currentConvId) {
          this.conv.update(c => ({ ...c, ...updated }))
        }
      }),
      this.socket.typing$.subscribe(t => {
        if (t.conversation_id === this.currentConvId) {
          clearTimeout(this.typingTimer)
          if (t.active) {
            this.typingUser.set(t.user?.name ?? 'Alguien')
            this.typingTimer = setTimeout(() => this.typingUser.set(null), 3000)
          } else {
            this.typingUser.set(null)
          }
        }
      })
    )

    if (this.auth.isSupervisor()) {
      this.api.getAgents().subscribe(a => this.agents.set(a))
    }
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe())
    if (this.currentConvId) this.socket.leaveConversation(this.currentConvId)
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom()
      this.shouldScroll = false
    }
  }

  loadConversation(id: number) {
    this.loadingMsgs.set(true)
    this.conv.set(null)
    this.messages.set([])

    this.api.getConversation(id).subscribe(conv => {
      this.conv.set(conv)
      this.socket.joinConversation(id)
      this.api.markRead(id).subscribe()
    })

    this.api.getMessages(id).subscribe(res => {
      this.messages.set(res.data)
      this.loadingMsgs.set(false)
      this.shouldScroll = true
    })
  }

  sendMessage() {
    const text = this.messageText.trim()
    if (!text || this.sending()) return
    this.sending.set(true)
    this.messageText = ''

    this.api.sendMessage(this.currentConvId, text).subscribe({
      next: (msg) => {
        this.messages.update(m => [...m, msg])
        this.shouldScroll = true
        this.sending.set(false)
      },
      error: () => this.sending.set(false)
    })
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.sendMessage()
    }
  }

  onTyping() {
    this.socket.typingStart(this.currentConvId)
    clearTimeout(this.typingTimer)
    this.typingTimer = setTimeout(() => this.socket.typingStop(this.currentConvId), 2000)
  }

  changeStatus(status: string) {
    this.api.updateConversationStatus(this.currentConvId, status).subscribe(conv => {
      this.conv.update(c => ({ ...c, status: conv.status }))
    })
  }

  assignAgent(event: Event) {
    const agentId = +(event.target as HTMLSelectElement).value
    if (!agentId) return
    this.api.assignConversation(this.currentConvId, agentId).subscribe(conv => {
      this.conv.update(c => ({ ...c, assigned_agent_id: conv.assigned_agent_id }))
    })
  }

  scrollToBottom() {
    try { this.msgArea.nativeElement.scrollTop = this.msgArea.nativeElement.scrollHeight } catch {}
  }

  initials(name: string) {
    if (!name) return '?'
    return name.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase()
  }

  chIcon(type: string) {
    const m: any = { whatsapp: 'chat', instagram: 'photo_camera', email: 'mail', webchat: 'language' }
    return m[type] ?? 'chat'
  }

  formatTime(date: string) {
    if (!date) return ''
    return new Date(date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }
}
