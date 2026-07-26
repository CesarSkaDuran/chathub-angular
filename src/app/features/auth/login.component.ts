import { Component, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { SocketService } from '../../core/services/socket.service'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email    = ''
  password = ''
  showPass = false
  loading  = signal(false)
  error    = signal('')

  constructor(private auth: AuthService, private socket: SocketService, private router: Router) {}

  submit() {
    if (!this.email || !this.password) return
    this.loading.set(true)
    this.error.set('')

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.socket.connect()
        this.router.navigate(['/chat'])
      },
      error: (err) => {
        this.loading.set(false)
        this.error.set(err.error?.error || 'Error al iniciar sesión')
      }
    })
  }
}
