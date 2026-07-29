import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../../core/services/api.service'
import { SocketService } from '../../../core/services/socket.service'
import { AuthService } from '../../../core/services/auth.service'
import { Subscription } from 'rxjs'
import { EmojiPickerComponent } from '../../../shared/components/emoji-picker/emoji-picker.component'

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule, EmojiPickerComponent],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss'
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('msgArea') msgArea!: ElementRef
  @ViewChild('msgInput') msgInput!: ElementRef
  @ViewChild(EmojiPickerComponent) emojiPicker?: EmojiPickerComponent

  conv        = signal<any>(null)
  messages    = signal<any[]>([])
  agents      = signal<any[]>([])
  loadingMsgs = signal(false)
  sending     = signal(false)
  typingUser  = signal<string | null>(null)
  previewImage = signal<string | null>(null)
  uploadingMedia = signal(false)
  isRecording = signal(false)
  recordSeconds = signal(0)
  showEmojiPicker = signal(false)
  messageText = ''

  private subs: Subscription[] = []
  private typingTimer: any
  private shouldScroll = false
  private currentConvId = 0
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private mediaStream: MediaStream | null = null
  private recordInterval: any

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
    if (this.isRecording()) this.stopRecording()
    clearInterval(this.recordInterval)
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

  toggleEmojiPicker() {
    this.showEmojiPicker.update(v => !v)
  }

  onEmojiSelected(emoji: string) {
    const textarea = this.msgInput?.nativeElement as HTMLTextAreaElement | undefined
    if (textarea) {
      const start = textarea.selectionStart ?? this.messageText.length
      const end = textarea.selectionEnd ?? this.messageText.length
      this.messageText = this.messageText.slice(0, start) + emoji + this.messageText.slice(end)
      setTimeout(() => {
        textarea.focus()
        const pos = start + emoji.length
        textarea.setSelectionRange(pos, pos)
      })
    } else {
      this.messageText += emoji
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.showEmojiPicker()) return
    const target = event.target as HTMLElement
    if (this.emojiPicker?.contains(target)) return
    if (target.closest('.emoji-trigger-btn')) return
    this.showEmojiPicker.set(false)
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.showEmojiPicker.set(false)
  }

  triggerFileInput(input: HTMLInputElement) {
    input.click()
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file || this.uploadingMedia()) return

    this.uploadingMedia.set(true)
    this.api.uploadAndSendMedia(this.currentConvId, file).subscribe({
      next: (msg) => {
        this.messages.update(m => [...m, msg])
        this.shouldScroll = true
        this.uploadingMedia.set(false)
      },
      error: (err) => {
        console.error('Error subiendo archivo:', err)
        this.uploadingMedia.set(false)
      }
    })
    input.value = ''
  }

  async toggleRecording() {
    if (this.isRecording()) {
      this.stopRecording()
    } else {
      await this.startRecording()
    }
  }

  private async startRecording() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      console.error('No se pudo acceder al micrófono:', err)
      alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.')
      return
    }

    const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || ''
    this.audioChunks = []
    this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined)

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data)
    }
    this.mediaRecorder.onstop = () => this.handleRecordingStop()

    this.mediaRecorder.start()
    this.isRecording.set(true)
    this.recordSeconds.set(0)
    this.recordInterval = setInterval(() => this.recordSeconds.update(s => s + 1), 1000)
  }

  private stopRecording() {
    this.mediaRecorder?.stop()
    this.mediaStream?.getTracks().forEach(t => t.stop())
    this.isRecording.set(false)
    clearInterval(this.recordInterval)
  }

  private handleRecordingStop() {
    const usedType = this.mediaRecorder?.mimeType || 'audio/webm'
    const blob = new Blob(this.audioChunks, { type: usedType })
    this.audioChunks = []

    if (blob.size === 0) return

    const ext = usedType.includes('mp4') ? 'm4a' : usedType.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: usedType })

    this.uploadingMedia.set(true)
    this.api.uploadAndSendMedia(this.currentConvId, file).subscribe({
      next: (msg) => {
        this.messages.update(m => [...m, msg])
        this.shouldScroll = true
        this.uploadingMedia.set(false)
      },
      error: (err) => {
        console.error('Error enviando nota de voz:', err)
        this.uploadingMedia.set(false)
      }
    })
  }

  formatRecordTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  openImagePreview(url: string) {
    this.previewImage.set(url)
  }

  closeImagePreview() {
    this.previewImage.set(null)
  }

  deleteMedia(msg: any) {
    if (!msg?.id || !msg?.media_url) return
    this.api.deleteMessageMedia(msg.id).subscribe({
      next: () => {
        this.messages.update(list => list.map(m =>
          m.id === msg.id ? { ...m, media_url: null, media_mime_type: null } : m
        ))
      },
      error: (err) => console.error('Error eliminando archivo:', err)
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
