import { Component, signal, OnInit, OnDestroy } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { AuthService } from '../../../core/services/auth.service'
import { ApiService } from '../../../core/services/api.service'
import { Subscription } from 'rxjs'
import { SocketService } from '../../../core/services/socket.service'

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
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
