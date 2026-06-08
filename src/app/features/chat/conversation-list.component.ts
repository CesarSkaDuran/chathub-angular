import { Component, OnInit, OnDestroy, signal } from '@angular/core'
import { Router, RouterLink, ActivatedRoute } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../core/services/api.service'
import { SocketService } from '../../core/services/socket.service'
import { Subscription } from 'rxjs'
import { debounceTime, Subject } from 'rxjs'

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="conv-list">
      <!-- Header -->
      <div class="list-header">
        <h2>Conversaciones</h2>
        <span class="total-badge">{{ total() }}</span>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="search-wrap">
          <span class="material-symbols-rounded">search</span>
          <input class="input search-input" [(ngModel)]="search"
            (ngModelChange)="onSearch()" placeholder="Buscar contacto...">
        </div>
        <div class="filter-tabs">
          @for (s of statuses; track s.value) {
            <button class="tab" [class.active]="statusFilter === s.value"
              (click)="setStatus(s.value)">
              {{ s.label }}
            </button>
          }
        </div>
        <div class="channel-filters">
          @for (ch of channelTypes; track ch.value) {
            <button class="ch-filter" [class.active]="channelFilter === ch.value"
              (click)="setChannel(ch.value)" [class]="'ch-filter ch-' + ch.value">
              <span class="material-symbols-rounded">{{ ch.icon }}</span>
              {{ ch.label }}
            </button>
          }
        </div>
      </div>

      <!-- List -->
      <div class="list-body">
        @if (loading()) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="conv-skeleton">
              <div class="sk-avatar"></div>
              <div class="sk-lines"><div class="sk-line"></div><div class="sk-line short"></div></div>
            </div>
          }
        } @else if (conversations().length === 0) {
          <div class="empty">
            <span class="material-symbols-rounded">chat_bubble_outline</span>
            <p>Sin conversaciones</p>
          </div>
        } @else {
          @for (conv of conversations(); track conv.id) {
            <a class="conv-item" [class.active]="activeId === conv.id"
              [routerLink]="['/chat', conv.id]">
              <!-- Avatar + channel badge -->
              <div class="avatar-wrap">
                <div class="avatar">{{ initials(conv.contact?.name) }}</div>
                <span class="ch-dot" [class]="'ch-dot-' + conv.channel?.type" title="{{ conv.channel?.type }}">
                  <span class="material-symbols-rounded icon-fill">{{ chIcon(conv.channel?.type) }}</span>
                </span>
              </div>
              <!-- Info -->
              <div class="conv-info">
                <div class="conv-top">
                  <span class="contact-name truncate">{{ conv.contact?.name || conv.contact?.phone }}</span>
                  <span class="conv-time">{{ timeAgo(conv.last_message_at) }}</span>
                </div>
                <div class="conv-bottom">
                  <span class="last-msg truncate">
                    @if (conv.last_message?.direction === 'outbound') {
                      <span class="material-symbols-rounded sent-icon">done_all</span>
                    }
                    {{ conv.last_message?.body || '📎 Archivo' }}
                  </span>
                  <div class="conv-badges">
                    @if (conv.unread_count > 0) {
                      <span class="unread-dot">{{ conv.unread_count }}</span>
                    }
                    <span class="status-badge" [class]="conv.status">{{ statusLabel(conv.status) }}</span>
                  </div>
                </div>
                <div class="channel-label">
                  <span class="ch-badge" [class]="conv.channel?.type">{{ conv.channel?.name }}</span>
                </div>
              </div>
            </a>
          }
        }
      </div>

      <!-- Pagination -->
      @if (total() > 25) {
        <div class="pagination">
          <button class="btn btn-ghost" (click)="prevPage()" [disabled]="page === 1">
            <span class="material-symbols-rounded">chevron_left</span>
          </button>
          <span class="page-info">{{ page }} / {{ totalPages() }}</span>
          <button class="btn btn-ghost" (click)="nextPage()" [disabled]="page >= totalPages()">
            <span class="material-symbols-rounded">chevron_right</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .conv-list {
      width: 320px; flex-shrink: 0; display: flex; flex-direction: column;
      background: var(--bg-1); border-right: 1px solid var(--border); overflow: hidden;
    }
    .list-header {
      padding: 16px; display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid var(--border);
    }
    .list-header h2 { font-size: 15px; font-weight: 600; }
    .total-badge {
      background: var(--bg-3); color: var(--text-3);
      font-size: 11px; padding: 1px 7px; border-radius: 99px;
    }

    .filters { padding: 10px 12px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
    .search-wrap { position: relative; display: flex; align-items: center; }
    .search-wrap .material-symbols-rounded {
      position: absolute; left: 9px; color: var(--text-3); font-size: 17px; pointer-events: none;
    }
    .search-input { padding-left: 32px; font-size: 13px; }

    .filter-tabs { display: flex; gap: 4px; }
    .tab {
      flex: 1; padding: 5px; background: var(--bg-2); border: 1px solid var(--border);
      border-radius: var(--r-sm); color: var(--text-3); font-size: 11px; font-weight: 500;
      cursor: pointer; transition: all .15s;
    }
    .tab:hover { background: var(--bg-3); color: var(--text-2); }
    .tab.active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }

    .channel-filters { display: flex; gap: 4px; flex-wrap: wrap; }
    .ch-filter {
      display: flex; align-items: center; gap: 3px;
      padding: 3px 8px; border-radius: 99px; border: 1px solid var(--border);
      background: var(--bg-2); color: var(--text-3); font-size: 11px; cursor: pointer; transition: all .15s;
    }
    .ch-filter .material-symbols-rounded { font-size: 13px; }
    .ch-filter:hover { background: var(--bg-3); }
    .ch-filter.active.ch-whatsapp  { background: var(--wa-bg);    border-color: var(--wa);    color: var(--wa); }
    .ch-filter.active.ch-instagram { background: var(--ig-bg);    border-color: var(--ig);    color: var(--ig); }
    .ch-filter.active.ch-email     { background: var(--email-bg); border-color: var(--email); color: var(--email); }
    .ch-filter.active.ch-webchat   { background: var(--web-bg);   border-color: var(--web);   color: var(--web); }
    .ch-filter.active.ch-all       { background: var(--accent-bg);border-color: var(--accent);color: var(--accent); }

    .list-body { flex: 1; overflow-y: auto; }

    .conv-item {
      display: flex; gap: 10px; padding: 12px 14px; cursor: pointer;
      border-bottom: 1px solid var(--border); transition: background .12s; text-decoration: none;
      animation: slideIn .15s ease;
    }
    .conv-item:hover  { background: var(--bg-2); }
    .conv-item.active { background: var(--bg-3); }

    .avatar-wrap { position: relative; flex-shrink: 0; }
    .ch-dot {
      position: absolute; bottom: -2px; right: -2px;
      width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--bg-1);
      display: flex; align-items: center; justify-content: center;
    }
    .ch-dot .material-symbols-rounded { font-size: 9px; }
    .ch-dot-whatsapp  { background: var(--wa); color: #fff; }
    .ch-dot-instagram { background: var(--ig); color: #fff; }
    .ch-dot-email     { background: var(--email); color: #fff; }
    .ch-dot-webchat   { background: var(--web); color: #fff; }

    .conv-info { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 3px; }
    .conv-top  { display: flex; justify-content: space-between; align-items: center; }
    .contact-name { font-size: 13.5px; font-weight: 500; }
    .conv-time { font-size: 10.5px; color: var(--text-3); flex-shrink: 0; }
    .conv-bottom { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
    .last-msg { font-size: 12px; color: var(--text-3); flex: 1; display: flex; align-items: center; gap: 3px; }
    .sent-icon { font-size: 13px; color: var(--accent); }
    .conv-badges { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .channel-label { margin-top: 1px; }

    .status-badge { font-size: 10px; padding: 1px 6px; }

    /* Skeleton */
    .conv-skeleton { display: flex; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
    .sk-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--bg-3); animation: pulse 1.5s infinite; }
    .sk-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center; }
    .sk-line { height: 10px; background: var(--bg-3); border-radius: 4px; animation: pulse 1.5s infinite; }
    .sk-line.short { width: 60%; }
    @keyframes pulse { 0%,100% { opacity:.6; } 50% { opacity:1; } }

    .empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 200px; color: var(--text-3); gap: 8px;
    }
    .empty .material-symbols-rounded { font-size: 40px; }
    .empty p { font-size: 13px; }

    .pagination {
      padding: 10px 12px; border-top: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center; gap: 12px;
    }
    .page-info { font-size: 12px; color: var(--text-3); }
  `]
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

  constructor(private api: ApiService, private socket: SocketService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.load()
    this.subs.push(
      this.socket.convUpdated$.subscribe(updated => this.applyUpdate(updated)),
      this.socket.message$.subscribe(msg => this.applyNewMessage(msg)),
      this.searchSubject.pipe(debounceTime(400)).subscribe(() => { this.page = 1; this.load() }),
      this.route.firstChild?.params.subscribe(p => { this.activeId = +p['id'] }) ?? new Subscription()
    )
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
    this.conversations.update(list =>
      list.map(c => c.id === updated.id ? { ...c, ...updated } : c)
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    )
  }

  applyNewMessage(msg: any) {
    this.conversations.update(list =>
      list.map(c => c.id === msg.conversation_id
        ? { ...c, last_message_at: msg.created_at, last_message: msg, unread_count: c.unread_count + 1 }
        : c
      ).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    )
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
}
