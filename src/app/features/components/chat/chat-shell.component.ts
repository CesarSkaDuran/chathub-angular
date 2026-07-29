import { Component, OnInit, OnDestroy } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { Subscription } from 'rxjs'
import { AuthService } from '../../../core/services/auth.service'
import { SocketService } from '../../../core/services/socket.service'
import { NotificationService } from '../../../core/services/notification.service'
import { SidebarComponent } from '../sidebar/sidebar.component'

@Component({
  selector: 'app-chat-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="shell">
      <app-sidebar />
      <div class="shell-content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .shell {
      display: flex; height: 100vh; overflow: hidden;
      background: var(--bg-0);
    }
    .shell-content {
      flex: 1; display: flex; overflow: hidden;
    }
  `]
})
export class ChatShellComponent implements OnInit, OnDestroy {
  private sub?: Subscription

  constructor(
    private socket: SocketService,
    private auth: AuthService,
    private notifications: NotificationService,
  ) {}

  ngOnInit() {
    if (!this.socket) return
    this.socket.connect()

    this.sub = this.socket.message$.subscribe(msg => {
      if (msg?.direction === 'inbound') {
        this.notifications.notify(msg.body)
      }
    })
  }

  ngOnDestroy() {
    this.sub?.unsubscribe()
  }
}
