import { Component, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { SocketService } from '../../core/services/socket.service'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-wrap">
      <div class="login-card fade-in">

        <div class="brand">
          <div class="brand-icon">
            <span class="material-symbols-rounded icon-fill">forum</span>
          </div>
          <h1>ChatHub</h1>
          <p>Panel de atención multicanal</p>
        </div>

        <form (ngSubmit)="submit()">
          <div class="field">
            <label>Correo electrónico</label>
            <div class="input-wrap">
              <span class="material-symbols-rounded">mail</span>
              <input class="input" type="email" [(ngModel)]="email" name="email"
                placeholder="admin@chathub.com" required autocomplete="email">
            </div>
          </div>

          <div class="field">
            <label>Contraseña</label>
            <div class="input-wrap">
              <span class="material-symbols-rounded">lock</span>
              <input class="input" [type]="showPass ? 'text' : 'password'"
                [(ngModel)]="password" name="password"
                placeholder="••••••••" required autocomplete="current-password">
              <button type="button" class="toggle-pass" (click)="showPass = !showPass">
                <span class="material-symbols-rounded">{{ showPass ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          @if (error()) {
            <div class="error-msg fade-in">
              <span class="material-symbols-rounded">error</span>
              {{ error() }}
            </div>
          }

          <button type="submit" class="btn btn-primary submit-btn" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner"></span> Ingresando...
            } @else {
              <span class="material-symbols-rounded">login</span> Ingresar
            }
          </button>
        </form>

        <div class="hint">
          <span class="material-symbols-rounded">info</span>
          Prueba: admin&#64;chathub.com / password
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrap {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: var(--bg-0);
      background-image: radial-gradient(ellipse at 20% 50%, rgba(79,142,247,.07) 0%, transparent 60%),
                        radial-gradient(ellipse at 80% 20%, rgba(167,139,250,.06) 0%, transparent 50%);
    }
    .login-card {
      width: 100%; max-width: 400px; padding: 40px;
      background: var(--bg-1); border: 1px solid var(--border);
      border-radius: var(--r-xl);
      box-shadow: 0 24px 60px rgba(0,0,0,.4);
    }
    .brand { text-align: center; margin-bottom: 32px; }
    .brand-icon {
      width: 56px; height: 56px; border-radius: var(--r-lg);
      background: var(--accent-bg); border: 1px solid rgba(79,142,247,.3);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px;
    }
    .brand-icon .material-symbols-rounded { font-size: 28px; color: var(--accent); }
    .brand h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .brand p  { color: var(--text-2); font-size: 13px; }

    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 12px; font-weight: 500; color: var(--text-2); margin-bottom: 6px; }
    .input-wrap { position: relative; display: flex; align-items: center; }
    .input-wrap > .material-symbols-rounded {
      position: absolute; left: 10px; color: var(--text-3); font-size: 18px; pointer-events: none;
    }
    .input-wrap .input { padding-left: 36px; padding-right: 36px; }
    .toggle-pass {
      position: absolute; right: 8px; background: none; border: none;
      color: var(--text-3); padding: 4px; border-radius: 4px;
    }
    .toggle-pass:hover { color: var(--text-2); }

    .error-msg {
      display: flex; align-items: center; gap: 6px;
      background: var(--red-bg); color: var(--red);
      border-radius: var(--r-md); padding: 10px 12px;
      font-size: 13px; margin-bottom: 16px;
    }
    .error-msg .material-symbols-rounded { font-size: 16px; }

    .submit-btn { width: 100%; justify-content: center; padding: 11px; font-size: 14px; margin-top: 4px; }

    .spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      animation: spin .6s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .hint {
      margin-top: 20px; padding: 10px 12px;
      background: var(--bg-2); border-radius: var(--r-md);
      font-size: 12px; color: var(--text-3);
      display: flex; align-items: center; gap: 6px;
    }
    .hint .material-symbols-rounded { font-size: 15px; color: var(--accent); }
  `]
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
        // this.socket.connect()
        this.router.navigate(['/chat'])
      },
      error: (err) => {
        this.loading.set(false)
        this.error.set(err.error?.error || 'Error al iniciar sesión')
      }
    })
  }
}
