import { Component, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { SocketService } from '../../core/services/socket.service'
import { SidebarComponent } from './sidebar.component'

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
export class ChatShellComponent implements OnInit {
  constructor(private socket: SocketService, private auth: AuthService) {}

  ngOnInit() {
    if (!this.socket) return
    this.socket.connect()
  }
}
