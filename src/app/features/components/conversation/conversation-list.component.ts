import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core'
import { Router, RouterLink, ActivatedRoute } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../../core/services/api.service'
import { SocketService } from '../../../core/services/socket.service'
import { AuthService } from '../../../core/services/auth.service'
import { Subscription } from 'rxjs'
import { debounceTime, Subject } from 'rxjs'

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './conversation-list.component.html',
  styleUrl: './conversation-list.component.scss'
})
export class ConversationListComponent implements OnInit, OnDestroy {
  conversations = signal<any[]>([])
  total         = signal(0)
  loading       = signal(true)
  page          = 1
  search        = ''
  statusFilter  = 'open'
  channelFilter = 'all'
  activeId?: number
  private subs: Subscription[] = []
  private searchSubject = new Subject<string>()

  statuses = [
    { value: 'open',     label: 'Abiertos' },
    { value: 'pending',  label: 'Pendientes' },
    { value: 'resolved', label: 'Resueltos' },
  ]

  channelTypes = [
    { value: 'all',       label: 'Todos',      icon: 'all_inbox' },
    { value: 'whatsapp',  label: 'WhatsApp',   icon: 'chat' },
    { value: 'instagram', label: 'Instagram',  icon: 'photo_camera' },
    { value: 'email',     label: 'Email',      icon: 'mail' },
    { value: 'webchat',   label: 'Web',        icon: 'language' },
  ]

  constructor(
    private api: ApiService,
    private socket: SocketService,
    private route: ActivatedRoute,
    public auth: AuthService
  ) {}

  ngOnInit() {
    this.load()
    this.subs.push(
      this.socket.convUpdated$.subscribe(updated => this.applyUpdate(updated)),
      this.socket.message$.subscribe(msg => this.applyNewMessage(msg)),
      this.searchSubject.pipe(debounceTime(400)).subscribe(() => { this.page = 1; this.load() })
    )
    const paramsSub = this.route.firstChild?.params.subscribe(p => { this.activeId = +p['id'] })
    if (paramsSub) this.subs.push(paramsSub)
  }

  ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()) }

  load() {
    this.loading.set(true)
    const filters: any = { status: this.statusFilter, page: this.page }
    if (this.search) filters.search = this.search
    if (this.channelFilter !== 'all') filters.channel_type = this.channelFilter

    this.api.getConversations(filters).subscribe(res => {
      this.conversations.set(res.data)
      this.total.set(res.total)
      this.loading.set(false)
    })
  }

  setStatus(s: string)  { this.statusFilter = s;  this.page = 1; this.load() }
  setChannel(c: string) { this.channelFilter = c; this.page = 1; this.load() }
  onSearch() { this.searchSubject.next(this.search) }
  prevPage() { if (this.page > 1) { this.page--; this.load() } }
  nextPage() { if (this.page < this.totalPages()) { this.page++; this.load() } }
  totalPages() { return Math.ceil(this.total() / 25) }

  applyUpdate(updated: any) {
    this.conversations.update(list => {
      const existing = list.find(c => c.id === updated.id)
      if (!existing) {
        // Si no existe en la lista actual y es relevante, recargar para obtener datos completos
        this.load()
        return list
      }
      return list.map(c => c.id === updated.id ? { ...c, ...updated } : c)
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    })
  }

  applyNewMessage(msg: any) {
    this.conversations.update(list => {
      const existingIndex = list.findIndex(c => c.id === msg.conversation_id)

      if (existingIndex === -1) {
        // Nueva conversación: recargar lista para obtener datos completos del backend
        this.load()
        return list
      }

      // Actualizar conversación existente
      const updated = [...list]
      const isInbound = msg.direction === 'inbound'
      updated[existingIndex] = {
        ...updated[existingIndex],
        last_message_at: msg.created_at,
        last_message: msg,
        unread_count: isInbound ? updated[existingIndex].unread_count + 1 : updated[existingIndex].unread_count,
      }
      return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    })
  }

  initials(name: string) {
    if (!name) return '?'
    return name.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase()
  }

  chIcon(type: string) {
    const m: any = { whatsapp: 'chat', instagram: 'photo_camera', email: 'mail', webchat: 'language' }
    return m[type] ?? 'chat'
  }

  statusLabel(s: string) {
    const m: any = { open: 'Abierto', pending: 'Pendiente', resolved: 'Resuelto', snoozed: 'Pospuesto' }
    return m[s] ?? s
  }

  timeAgo(date: string) {
    if (!date) return ''
    const diff = (Date.now() - new Date(date).getTime()) / 1000
    if (diff < 60)   return 'ahora'
    if (diff < 3600) return Math.floor(diff/60) + 'm'
    if (diff < 86400)return Math.floor(diff/3600) + 'h'
    return Math.floor(diff/86400) + 'd'
  }

  deleteConversation(id: number) {
    if (!confirm('¿Eliminar esta conversación permanentemente? Esta acción no se puede deshacer.')) return

    this.api.deleteConversation(id).subscribe({
      next: () => {
        this.conversations.update(l => l.filter(c => c.id !== id))
        this.total.update(t => Math.max(0, t - 1))
      },
      error: (err) => {
        console.error('Error eliminando conversación:', err)
        alert('Error al eliminar la conversación')
      }
    })
  }

  resolveConversation(id: number) {
    this.api.updateConversationStatus(id, 'resolved').subscribe({
      next: () => {
        this.conversations.update(l => l.filter(c => c.id !== id))
        this.total.update(t => Math.max(0, t - 1))
      },
      error: (err) => {
        console.error('Error marcando como resuelta:', err)
      }
    })
  }
}
