import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../core/services/api.service'
import { SocketService } from '../../core/services/socket.service'
import { AuthService } from '../../core/services/auth.service'
import { Subscription } from 'rxjs'

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="chat-window">
      @if (!conv()) {
        <div class="empty-state">
          <span class="material-symbols-rounded">forum</span>
          <h3>Selecciona una conversación</h3>
          <p>Elige un chat de la lista para empezar</p>
        </div>
      } @else {
        <!-- Header -->
        <div class="chat-header">
          <div class="header-left">
            <div class="avatar lg">{{ initials(conv().contact_name) }}</div>
            <div>
              <div class="contact-name">{{ conv().contact_name || conv().phone }}</div>
              <div class="contact-sub">
                <span class="ch-badge" [class]="conv().channel_type">
                  <span class="material-symbols-rounded icon-fill">{{ chIcon(conv().channel_type) }}</span>
                  {{ conv().channel_name }}
                </span>
                @if (conv().phone) {
                  <span class="text-muted text-xs">{{ conv().phone }}</span>
                }
              </div>
            </div>
          </div>
          <div class="header-right">
            <!-- Status selector -->
            <div class="status-selector">
              @for (s of statuses; track s.value) {
                <button class="status-btn" [class]="s.value" [class.active]="conv().status === s.value"
                  (click)="changeStatus(s.value)">
                  {{ s.label }}
                </button>
              }
            </div>
            <!-- Assign -->
            @if (auth.isSupervisor()) {
              <div class="assign-wrap">
                <select class="input assign-select" (change)="assignAgent($event)">
                  <option value="">Asignar agente...</option>
                  @for (a of agents(); track a.id) {
                    <option [value]="a.id" [selected]="conv().assigned_agent_id === a.id">
                      {{ a.name }}
                    </option>
                  }
                </select>
              </div>
            }
          </div>
        </div>

        <!-- Messages -->
        <div class="messages-area" #msgArea>
          @if (loadingMsgs()) {
            <div class="loading-msgs">
              <div class="spinner-ring"></div>
            </div>
          }
          @for (msg of messages(); track msg.id) {
            <div class="msg-row" [class.outbound]="msg.direction === 'outbound'" [class.inbound]="msg.direction === 'inbound'">
              <div class="msg-bubble" [class]="msg.direction">
                @if (msg.type === 'text') {
                  <p class="msg-text">{{ msg.body }}</p>
                } @else if (msg.type === 'image') {
                  <div class="msg-media">
                    <span class="material-symbols-rounded">image</span>
                    <span>{{ msg.body || 'Imagen' }}</span>
                  </div>
                } @else if (msg.type === 'audio') {
                  <div class="msg-media">
                    <span class="material-symbols-rounded">mic</span>
                    <span>Audio</span>
                  </div>
                } @else if (msg.type === 'document') {
                  <div class="msg-media">
                    <span class="material-symbols-rounded">description</span>
                    <span>{{ msg.body || 'Documento' }}</span>
                  </div>
                } @else {
                  <p class="msg-text">{{ msg.body }}</p>
                }
                <div class="msg-meta">
                  <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                  @if (msg.direction === 'outbound') {
                    <span class="msg-status material-symbols-rounded icon-fill"
                      [class]="'status-' + msg.status">
                      {{ msg.status === 'read' ? 'done_all' : msg.status === 'delivered' ? 'done_all' : 'done' }}
                    </span>
                  }
                  @if (msg.sender_name) {
                    <span class="msg-sender">{{ msg.sender_name }}</span>
                  }
                </div>
              </div>
            </div>
          }
          <!-- Typing indicator -->
          @if (typingUser()) {
            <div class="msg-row inbound">
              <div class="msg-bubble inbound typing-bubble">
                <span class="typing-dots"><i></i><i></i><i></i></span>
                <span class="typing-name">{{ typingUser() }} está escribiendo</span>
              </div>
            </div>
          }
        </div>

        <!-- Input -->
        <div class="chat-input-area">
          @if (conv().status === 'resolved') {
            <div class="resolved-banner">
              <span class="material-symbols-rounded">check_circle</span>
              Conversación resuelta.
              <button class="btn btn-ghost btn-sm" (click)="changeStatus('open')">Reabrir</button>
            </div>
          } @else {
            <div class="input-row">
              <textarea
                class="msg-input"
                [(ngModel)]="messageText"
                (keydown)="onKeydown($event)"
                (input)="onTyping()"
                placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter nueva línea)"
                rows="1"
                #msgInput>
              </textarea>
              <button class="send-btn" (click)="sendMessage()" [disabled]="!messageText.trim() || sending()">
                @if (sending()) {
                  <div class="spinner-sm"></div>
                } @else {
                  <span class="material-symbols-rounded icon-fill">send</span>
                }
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .chat-window {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
      background: var(--bg-0);
    }
    .empty-state {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: var(--text-3); gap: 12px;
    }
    .empty-state .material-symbols-rounded { font-size: 56px; color: var(--bg-4); }
    .empty-state h3 { font-size: 16px; font-weight: 500; color: var(--text-2); }
    .empty-state p  { font-size: 13px; }

    /* Header */
    .chat-header {
      padding: 12px 18px; background: var(--bg-1); border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .contact-name { font-size: 15px; font-weight: 600; }
    .contact-sub  { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
    .header-right { display: flex; align-items: center; gap: 10px; }

    .status-selector { display: flex; gap: 4px; }
    .status-btn {
      padding: 5px 10px; border-radius: var(--r-sm); border: 1px solid var(--border);
      background: var(--bg-2); color: var(--text-3); font-size: 12px; font-weight: 500; cursor: pointer;
      transition: all .15s;
    }
    .status-btn:hover { background: var(--bg-3); }
    .status-btn.open.active     { background: var(--green-bg); border-color: var(--green); color: var(--green); }
    .status-btn.pending.active  { background: var(--amber-bg); border-color: var(--amber); color: var(--amber); }
    .status-btn.resolved.active { background: var(--bg-4); color: var(--text-2); }

    .assign-select { width: 180px; font-size: 12px; padding: 5px 8px; }

    /* Messages */
    .messages-area {
      flex: 1; overflow-y: auto; padding: 20px 18px;
      display: flex; flex-direction: column; gap: 6px;
      background: var(--bg-0);
    }
    .loading-msgs { display: flex; justify-content: center; padding: 20px; }
    .spinner-ring {
      width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid var(--bg-3); border-top-color: var(--accent);
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .msg-row { display: flex; animation: fadeIn .2s ease; }
    .msg-row.outbound { justify-content: flex-end; }
    .msg-row.inbound  { justify-content: flex-start; }

    .msg-bubble {
      max-width: 68%; padding: 10px 13px; border-radius: var(--r-lg);
      position: relative;
    }
    .msg-bubble.outbound {
      background: var(--accent); color: #fff;
      border-bottom-right-radius: 4px;
    }
    .msg-bubble.inbound {
      background: var(--bg-2); color: var(--text-1);
      border-bottom-left-radius: 4px; border: 1px solid var(--border);
    }
    .msg-text { font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .msg-media {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; padding: 4px 0;
    }
    .msg-media .material-symbols-rounded { font-size: 20px; }
    .msg-meta {
      display: flex; align-items: center; gap: 4px;
      margin-top: 4px; justify-content: flex-end;
    }
    .msg-time   { font-size: 10px; opacity: .7; }
    .msg-sender { font-size: 10px; opacity: .7; }
    .msg-status { font-size: 14px; opacity: .8; }
    .msg-status.status-read      { color: #90caf9; }
    .msg-status.status-delivered { opacity: .7; }

    /* Typing */
    .typing-bubble { display: flex; align-items: center; gap: 8px; padding: 10px 14px; }
    .typing-dots { display: flex; gap: 3px; }
    .typing-dots i {
      width: 6px; height: 6px; background: var(--text-3); border-radius: 50%;
      animation: bounce .8s infinite;
      display: block;
    }
    .typing-dots i:nth-child(2) { animation-delay: .15s; }
    .typing-dots i:nth-child(3) { animation-delay: .3s; }
    @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
    .typing-name { font-size: 11px; color: var(--text-3); }

    /* Input */
    .chat-input-area {
      padding: 12px 16px; background: var(--bg-1); border-top: 1px solid var(--border); flex-shrink: 0;
    }
    .input-row { display: flex; gap: 10px; align-items: flex-end; }
    .msg-input {
      flex: 1; background: var(--bg-2); border: 1px solid var(--border);
      border-radius: var(--r-lg); padding: 11px 14px; color: var(--text-1);
      font-size: 14px; resize: none; outline: none; max-height: 120px;
      transition: border .15s; line-height: 1.5;
    }
    .msg-input:focus { border-color: var(--accent); }
    .msg-input::placeholder { color: var(--text-3); }
    .send-btn {
      width: 42px; height: 42px; border-radius: 50%; border: none;
      background: var(--accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s; flex-shrink: 0;
    }
    .send-btn:hover:not(:disabled) { background: var(--accent-2); transform: scale(1.05); }
    .send-btn:disabled { opacity: .4; cursor: not-allowed; }
    .send-btn .material-symbols-rounded { font-size: 20px; }
    .spinner-sm {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      animation: spin .6s linear infinite;
    }

    .resolved-banner {
      display: flex; align-items: center; gap: 8px; justify-content: center;
      background: var(--bg-2); border-radius: var(--r-md); padding: 10px;
      color: var(--text-3); font-size: 13px;
    }
    .resolved-banner .material-symbols-rounded { color: var(--green); font-size: 18px; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }
  `]
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
