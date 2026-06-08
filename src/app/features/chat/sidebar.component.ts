import { Component, signal, OnInit, OnDestroy } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { ApiService } from '../../core/services/api.service'
import { Subscription } from 'rxjs'
import { SocketService } from '../../core/services/socket.service'

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <!-- Brand -->
      <div class="sidebar-brand">
        <div class="brand-icon">
          <span class="material-symbols-rounded icon-fill">forum</span>
        </div>
        <span class="brand-name">ChatHub</span>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
        <a class="nav-item" routerLink="/chat" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
          <span class="material-symbols-rounded">chat_bubble</span>
          <span>Conversaciones</span>
          @if (pendingCount() > 0) {
            <span class="unread-dot">{{ pendingCount() }}</span>
          }
        </a>

        @if (auth.isSupervisor()) {
          <a class="nav-item" routerLink="/chat/dashboard" routerLinkActive="active">
            <span class="material-symbols-rounded">bar_chart</span>
            <span>Dashboard</span>
          </a>
          <a class="nav-item" routerLink="/chat/channels" routerLinkActive="active">
            <span class="material-symbols-rounded">hub</span>
            <span>Canales</span>
          </a>
          <a class="nav-item" routerLink="/chat/agents" routerLinkActive="active">
            <span class="material-symbols-rounded">group</span>
            <span>Agentes</span>
          </a>
        }
      </nav>

      <!-- User -->
      <div class="sidebar-user">
        <div class="avatar">{{ initials() }}</div>
        <div class="user-info">
          <div class="user-name truncate">{{ auth.currentUser()?.name }}</div>
          <div class="user-role">{{ roleLabel() }}</div>
        </div>
        <button class="logout-btn" (click)="auth.logout()" title="Cerrar sesión">
          <span class="material-symbols-rounded">logout</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 220px; flex-shrink: 0;
      background: var(--bg-1); border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
    }
    .sidebar-brand {
      padding: 18px 16px; display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid var(--border);
    }
    .brand-icon {
      width: 32px; height: 32px; border-radius: var(--r-sm);
      background: var(--accent-bg); display: flex; align-items: center; justify-content: center;
    }
    .brand-icon .material-symbols-rounded { font-size: 18px; color: var(--accent); }
    .brand-name { font-weight: 600; font-size: 15px; letter-spacing: .3px; }

    .sidebar-nav { flex: 1; padding: 10px 8px; display: flex; flex-direction: column; gap: 2px; }

    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: var(--r-md);
      color: var(--text-2); font-size: 13.5px; font-weight: 500;
      transition: all .15s; text-decoration: none;
    }
    .nav-item:hover { background: var(--bg-3); color: var(--text-1); }
    .nav-item.active { background: var(--accent-bg); color: var(--accent); }
    .nav-item .material-symbols-rounded { font-size: 19px; }
    .nav-item span:nth-child(2) { flex: 1; }

    .sidebar-user {
      padding: 12px; border-top: 1px solid var(--border);
      display: flex; align-items: center; gap: 10px;
    }
    .user-info { flex: 1; overflow: hidden; }
    .user-name { font-size: 13px; font-weight: 500; }
    .user-role { font-size: 11px; color: var(--text-3); }
    .logout-btn {
      background: none; border: none; color: var(--text-3);
      padding: 4px; border-radius: var(--r-sm);
      display: flex; align-items: center;
    }
    .logout-btn:hover { background: var(--bg-3); color: var(--red); }
  `]
})
export class SidebarComponent implements OnInit, OnDestroy {
  pendingCount = signal(0)
  private sub!: Subscription

  constructor(public auth: AuthService, private api: ApiService, private socket: SocketService) {}

  ngOnInit() {
    this.loadPending()
    this.sub = this.socket.convUpdated$.subscribe(() => this.loadPending())
  }

  ngOnDestroy() { this.sub?.unsubscribe() }

  loadPending() {
    this.api.getConversations({ status: 'pending' }).subscribe(res => {
      this.pendingCount.set(res.total ?? res.data?.length ?? 0)
    })
  }

  initials() {
    const name = this.auth.currentUser()?.name ?? ''
    return name.split(' ').slice(0,2).map((n:string) => n[0]).join('').toUpperCase()
  }

  roleLabel() {
    const map: any = { admin: 'Administrador', supervisor: 'Supervisor', agent: 'Agente' }
    return map[this.auth.currentUser()?.role ?? ''] ?? ''
  }
}
