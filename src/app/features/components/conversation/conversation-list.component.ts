import { Component, OnInit, OnDestroy, signal } from '@angular/core'
import { RouterLink, ActivatedRoute } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../../core/services/api.service'
import { SocketService } from '../../../core/services/socket.service'
import { AuthService } from '../../../core/services/auth.service'
import { Subscription } from 'rxjs'
import { debounceTime, Subject } from 'rxjs'

interface ChannelTab {
  id: number | 'all'
  name: string
  type: string
  status?: string
  identifier?: string
  total: number
  with_unread: number
  unread_total: number
}

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
  /** 'all' o id de canal como string */
  channelFilter = 'all'
  viewMode: 'chats' | 'groups' = 'chats'
  activeId?: number

  channelTabs = signal<ChannelTab[]>([])
  channelMenuOpen = signal(false)

  private subs: Subscription[] = []
  private searchSubject = new Subject<string>()
  private countsTimer: any

  statuses = [
    { value: 'open',     label: 'Abiertos' },
    { value: 'pending',  label: 'Pendientes' },
    { value: 'resolved', label: 'Resueltos' },
  ]

  constructor(
    private api: ApiService,
    private socket: SocketService,
    private route: ActivatedRoute,
    public auth: AuthService
  ) {}

  ngOnInit() {
    this.load()
    this.loadChannelCounts()
    this.subs.push(
      this.socket.convUpdated$.subscribe(updated => {
        this.applyUpdate(updated)
        this.scheduleCountsRefresh()
      }),
      this.socket.message$.subscribe(msg => {
        this.applyNewMessage(msg)
        this.scheduleCountsRefresh()
      }),
      this.searchSubject.pipe(debounceTime(400)).subscribe(() => {
        this.page = 1
        this.load()
        this.loadChannelCounts()
      })
    )
    const paramsSub = this.route.firstChild?.params.subscribe(p => { this.activeId = +p['id'] })
    if (paramsSub) this.subs.push(paramsSub)
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe())
    clearTimeout(this.countsTimer)
  }

  private baseFilters(): any {
    const filters: any = { status: this.statusFilter }
    if (this.search) filters.search = this.search
    filters.is_group = this.viewMode === 'groups'
    return filters
  }

  load() {
    this.loading.set(true)
    const filters: any = { ...this.baseFilters(), page: this.page }
    if (this.channelFilter !== 'all') filters.channel_id = this.channelFilter

    this.api.getConversations(filters).subscribe({
      next: res => {
        this.conversations.set(res.data)
        this.total.set(res.total)
        this.loading.set(false)
      },
      error: () => this.loading.set(false)
    })
  }

  loadChannelCounts() {
    this.api.getConversationCountsByChannel(this.baseFilters()).subscribe({
      next: res => {
        const tabs: ChannelTab[] = [
          {
            id: 'all',
            name: 'Todos',
            type: 'all',
            total: res.all?.total ?? 0,
            with_unread: res.all?.with_unread ?? 0,
            unread_total: res.all?.unread_total ?? 0,
          },
          ...(res.channels || []).map((ch: any) => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            status: ch.status,
            identifier: ch.identifier,
            total: ch.total ?? 0,
            with_unread: ch.with_unread ?? 0,
            unread_total: ch.unread_total ?? 0,
          })),
        ]
        this.channelTabs.set(tabs)
      },
      error: err => console.error('Error cargando contadores por canal:', err)
    })
  }

  private scheduleCountsRefresh() {
    clearTimeout(this.countsTimer)
    this.countsTimer = setTimeout(() => this.loadChannelCounts(), 800)
  }

  setStatus(s: string) {
    this.statusFilter = s
    this.page = 1
    this.load()
    this.loadChannelCounts()
  }

  setChannel(id: number | 'all') {
    this.channelFilter = id === 'all' ? 'all' : String(id)
    this.channelMenuOpen.set(false)
    this.page = 1
    this.load()
  }

  toggleChannelMenu() {
    this.channelMenuOpen.update(v => !v)
  }

  closeChannelMenu() {
    this.channelMenuOpen.set(false)
  }

  selectedChannelTab(): ChannelTab | undefined {
    const tabs = this.channelTabs()
    if (this.channelFilter === 'all') return tabs.find(t => t.id === 'all')
    return tabs.find(t => String(t.id) === this.channelFilter) || tabs[0]
  }

  otherChannelUnread(): number {
    return this.channelTabs()
      .filter(t => t.id !== 'all' && !this.isChannelActive(t))
      .reduce((sum, t) => sum + (t.with_unread || 0), 0)
  }

  setViewMode(m: 'chats' | 'groups') {
    this.viewMode = m
    this.page = 1
    this.load()
    this.loadChannelCounts()
  }

  onSearch() { this.searchSubject.next(this.search) }
  prevPage() { if (this.page > 1) { this.page--; this.load() } }
  nextPage() { if (this.page < this.totalPages()) { this.page++; this.load() } }
  totalPages() { return Math.ceil(this.total() / 25) }

  isChannelActive(tab: ChannelTab) {
    if (tab.id === 'all') return this.channelFilter === 'all'
    return this.channelFilter === String(tab.id)
  }

  applyUpdate(updated: any) {
    this.conversations.update(list => {
      const existing = list.find(c => c.id === updated.id)
      if (!existing) {
        // Solo recargar si parece una conversación nueva relevante
        if (updated.last_message || updated.unread_count > 0) this.load()
        return list
      }
      // Si el filtro de canal está activo y la conv ya no corresponde, quitarla
      if (this.channelFilter !== 'all' && updated.channel?.id != null
          && String(updated.channel.id) !== this.channelFilter) {
        this.total.update(t => Math.max(0, t - 1))
        return list.filter(c => c.id !== updated.id)
      }
      return list.map(c => c.id === updated.id ? { ...c, ...updated } : c)
        .sort((a, b) => {
          const tb = new Date(b.last_message_at || 0).getTime()
          const ta = new Date(a.last_message_at || 0).getTime()
          return tb - ta
        })
    })
  }

  applyNewMessage(msg: any) {
    this.conversations.update(list => {
      const existingIndex = list.findIndex(c => c.id === msg.conversation_id)

      if (existingIndex === -1) {
        this.load()
        return list
      }

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
    const m: any = { whatsapp: 'chat', instagram: 'photo_camera', email: 'mail', webchat: 'language', all: 'all_inbox' }
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
        this.scheduleCountsRefresh()
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
        this.scheduleCountsRefresh()
      },
      error: (err) => {
        console.error('Error marcando como resuelta:', err)
      }
    })
  }
}
