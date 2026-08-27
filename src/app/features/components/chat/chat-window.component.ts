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
  showQuickReplies = signal(false)
  quickReplies = signal<{ shortcut: string; label: string; text: string }[]>([])
  quickRepliesFiltered = signal<{ shortcut: string; label: string; text: string }[]>([])
  messageText = ''
  errorMessage = signal<string | null>(null)

  private subs: Subscription[] = []
  private typingTimer: any
  private shouldScroll = false
  private currentConvId = 0
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private mediaStream: MediaStream | null = null
  private recordInterval: any
  private errorTimer: any

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
          this.messages.update(list => this.mergeIncomingMessage(list, msg))
          this.shouldScroll = true
          if (msg.direction === 'inbound') {
            this.api.markRead(this.currentConvId).subscribe()
          }
        }
      }),
      this.socket.convUpdated$.subscribe(updated => {
        if (updated.id === this.currentConvId) {
          this.conv.update(c => ({ ...c, ...updated }))
        }
      }),
      this.socket.messageStatus$.subscribe(statusUpdate => {
        if (!statusUpdate?.id) return
        this.messages.update(list => list.map(m => {
          if (m.id !== statusUpdate.id) return m
          const updated = { ...m, status: statusUpdate.status }
          if (statusUpdate.external_id) updated.external_id = statusUpdate.external_id
          return updated
        }))
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

    this.loadQuickReplies()
  }

  loadQuickReplies() {
    this.api.getQuickReplies().subscribe({
      next: (replies) => {
        console.log('[QuickReplies] cargadas:', replies)
        const mapped = replies.map(q => ({
          shortcut: q.shortcut,
          label: q.label || q.shortcut.replace('/', '').charAt(0).toUpperCase() + q.shortcut.replace('/', '').slice(1),
          text: q.content,
        }))
        this.quickReplies.set(mapped)
      },
      error: (err) => console.error('[QuickReplies] error cargando:', err)
    })
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
      // Quitar badge al instante en el listado y confirmar en backend
      this.socket.emitConvUpdatedLocal({ id, unread_count: 0 })
      this.api.markRead(id).subscribe()
    })

    this.api.getMessages(id).subscribe(res => {
      this.messages.set(res.data)
      this.loadingMsgs.set(false)
      this.shouldScroll = true
    })
  }

  /** Evita duplicados: mismo id real, o temp outbound con mismo body reciente. */
  private mergeIncomingMessage(list: any[], msg: any): any[] {
    if (!msg) return list

    // Ya existe el mensaje real
    if (list.some(m => m.id === msg.id)) {
      return list.map(m => m.id === msg.id ? { ...m, ...msg } : m)
    }

    // Si llega por socket el mensaje real, reemplazar temp outbound equivalente
    if (msg.direction === 'outbound') {
      const tempIdx = list.findIndex(m =>
        typeof m.id === 'string' && String(m.id).startsWith('temp_')
        && m.direction === 'outbound'
        && m.type === msg.type
        && (m.body || '') === (msg.body || '')
        && (m.media_url ? !!msg.media_url : true)
      )
      if (tempIdx !== -1) {
        const next = [...list]
        next[tempIdx] = { ...msg, sender_name: next[tempIdx].sender_name || msg.sender_name }
        return next
      }
    }

    return [...list, msg]
  }

  private replaceTempOrMerge(list: any[], tempId: string, msg: any, senderName?: string): any[] {
    // Si el socket ya insertó el real, solo quitar el temp
    if (list.some(m => m.id === msg.id)) {
      return list
        .filter(m => m.id !== tempId)
        .map(m => m.id === msg.id ? { ...m, ...msg, sender_name: senderName || m.sender_name } : m)
    }
    // Si el temp sigue, reemplazarlo
    if (list.some(m => m.id === tempId)) {
      return list.map(m => m.id === tempId ? { ...msg, sender_name: senderName } : m)
    }
    return [...list, { ...msg, sender_name: senderName }]
  }

  sendMessage() {
    const text = this.messageText.trim()
    if (!text || this.sending()) return
    this.sending.set(true)
    this.errorMessage.set(null)
    clearTimeout(this.errorTimer)

    // UI optimista: crear mensaje temporal y mostrarlo inmediatamente
    const tempId = `temp_${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      conversation_id: this.currentConvId,
      direction: 'outbound',
      type: 'text',
      body: text,
      status: 'pending',
      created_at: new Date().toISOString(),
      sender_name: this.auth.currentUser()?.name,
    }
    this.messages.update(m => [...m, optimisticMsg])
    this.shouldScroll = true
    this.messageText = ''
    this.sending.set(false)

    this.api.sendMessage(this.currentConvId, text).subscribe({
      next: (msg) => {
        this.messages.update(list => this.replaceTempOrMerge(list, tempId, msg, optimisticMsg.sender_name))
        this.shouldScroll = true
      },
      error: (err) => {
        this.messages.update(list => list.map(m =>
          m.id === tempId ? { ...m, status: 'failed' } : m
        ))
        this.errorMessage.set(err?.error?.error || 'No se pudo enviar el mensaje')
        this.errorTimer = setTimeout(() => this.errorMessage.set(null), 6000)
      }
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
    const target = event.target as HTMLElement

    if (this.showEmojiPicker()) {
      if (this.emojiPicker?.contains(target)) return
      if (target.closest('.emoji-trigger-btn')) return
      this.showEmojiPicker.set(false)
    }

    if (this.showQuickReplies()) {
      if (target.closest('.quick-replies-trigger') || target.closest('.quick-replies-popup')) return
      this.showQuickReplies.set(false)
    }
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

    // UI optimista para imagen
    const tempId = `temp_img_${Date.now()}`
    const isImage = file.type.startsWith('image/')
    const previewUrl = isImage ? URL.createObjectURL(file) : null

    const optimisticMsg = {
      id: tempId,
      conversation_id: this.currentConvId,
      direction: 'outbound',
      type: isImage ? 'image' : 'document',
      body: file.name,
      media_url: previewUrl,
      status: 'pending',
      created_at: new Date().toISOString(),
      sender_name: this.auth.currentUser()?.name,
    }
    this.messages.update(m => [...m, optimisticMsg])
    this.shouldScroll = true

    this.uploadingMedia.set(true)
    this.api.uploadAndSendMedia(this.currentConvId, file).subscribe({
      next: (msg) => {
        this.messages.update(list => this.replaceTempOrMerge(list, tempId, msg, optimisticMsg.sender_name))
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        this.shouldScroll = true
        this.uploadingMedia.set(false)
      },
      error: (err) => {
        console.error('Error subiendo archivo:', err)
        this.messages.update(list => list.map(m =>
          m.id === tempId ? { ...m, status: 'failed' } : m
        ))
        if (previewUrl) URL.revokeObjectURL(previewUrl)
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

    // UI optimista para nota de voz
    const tempId = `temp_audio_${Date.now()}`
    const previewUrl = URL.createObjectURL(blob)
    const optimisticMsg = {
      id: tempId,
      conversation_id: this.currentConvId,
      direction: 'outbound',
      type: 'audio',
      media_url: previewUrl,
      status: 'pending',
      created_at: new Date().toISOString(),
      sender_name: this.auth.currentUser()?.name,
    }
    this.messages.update(m => [...m, optimisticMsg])
    this.shouldScroll = true

    this.uploadingMedia.set(true)
    this.api.uploadAndSendMedia(this.currentConvId, file).subscribe({
      next: (msg) => {
        this.messages.update(list => this.replaceTempOrMerge(list, tempId, msg, optimisticMsg.sender_name))
        URL.revokeObjectURL(previewUrl)
        this.shouldScroll = true
        this.uploadingMedia.set(false)
      },
      error: (err) => {
        console.error('Error enviando nota de voz:', err)
        this.messages.update(list => list.map(m =>
          m.id === tempId ? { ...m, status: 'failed' } : m
        ))
        URL.revokeObjectURL(previewUrl)
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
      this.showQuickReplies.set(false)
      return
    }

    if (e.key === 'Escape') {
      this.showQuickReplies.set(false)
      this.showEmojiPicker.set(false)
    }

    if (e.key === 'ArrowDown' && this.showQuickReplies()) {
      e.preventDefault()
      // Mover selección hacia abajo si se implementa
      return
    }
  }

  onTyping() {
    this.socket.typingStart(this.currentConvId)
    clearTimeout(this.typingTimer)
    this.typingTimer = setTimeout(() => this.socket.typingStop(this.currentConvId), 2000)

    this.filterQuickReplies()
  }

  toggleQuickReplies() {
    this.showQuickReplies.update(v => !v)
    if (this.showQuickReplies()) {
      this.quickRepliesFiltered.set(this.quickReplies())
    }
  }

  filterQuickReplies() {
    const text = this.messageText.trim().toLowerCase()
    console.log('[QuickReplies] filtrando, text:', text, 'total:', this.quickReplies().length)
    if (text.startsWith('/')) {
      const term = text
      const filtered = this.quickReplies().filter(q =>
        q.shortcut.toLowerCase().includes(term) ||
        q.label.toLowerCase().includes(term.replace('/', ''))
      )
      console.log('[QuickReplies] filtradas:', filtered)
      this.quickRepliesFiltered.set(filtered)
      this.showQuickReplies.set(filtered.length > 0)
    } else if (this.showQuickReplies()) {
      this.showQuickReplies.set(false)
    }
  }

  insertQuickReply(text: string) {
    this.messageText = text
    this.showQuickReplies.set(false)
    setTimeout(() => this.msgInput?.nativeElement?.focus())
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
