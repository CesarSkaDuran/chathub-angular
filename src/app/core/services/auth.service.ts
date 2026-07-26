import { Injectable, signal } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'
import { tap } from 'rxjs'
import { AppConfigService } from './app-config.service'

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'supervisor' | 'agent'
  branch_id: number
  branch_name: string
  branch_slug: string
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private get api() { return this.cfg.apiUrl }
  currentUser = signal<User | null>(null)

  constructor(private http: HttpClient, private router: Router, private cfg: AppConfigService) {
    const stored = localStorage.getItem('chathub_user')
    if (stored) this.currentUser.set(JSON.parse(stored))
  }

  login(email: string, password: string) {
    return this.http.post<{ token: string; user: User }>(`${this.api}/auth/login`, { email, password })
      .pipe(tap(res => {
        localStorage.setItem('chathub_token', res.token)
        localStorage.setItem('chathub_user', JSON.stringify(res.user))
        this.currentUser.set(res.user)
      }))
  }

  logout() {
    this.http.post(`${this.api}/auth/logout`, {}).subscribe()
    localStorage.removeItem('chathub_token')
    localStorage.removeItem('chathub_user')
    this.currentUser.set(null)
    this.router.navigate(['/login'])
  }

  getToken() { return localStorage.getItem('chathub_token') }
  isLoggedIn() { return !!this.getToken() }
  isSupervisor() { return ['admin', 'supervisor'].includes(this.currentUser()?.role ?? '') }
  isAdmin() { return this.currentUser()?.role === 'admin' }
}
