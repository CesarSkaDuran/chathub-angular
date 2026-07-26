import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { AppConfigService } from './app-config.service'

@Injectable({ providedIn: 'root' })
export class ApiService {
  private get api() { return this.cfg.apiUrl }

  constructor(private http: HttpClient, private cfg: AppConfigService) {}

  // ── Auth ──────────────────────────────────────────────
  me() { return this.http.get<any>(`${this.api}/auth/me`) }

  // ── Dashboard ─────────────────────────────────────────
  stats() { return this.http.get<any>(`${this.api}/dashboard/stats`) }

  // ── Conversations ─────────────────────────────────────
  getConversations(filters: any = {}) {
    let params = new HttpParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params = params.set(k, String(v)) })
    return this.http.get<any>(`${this.api}/conversations`, { params })
  }

  getConversation(id: number) {
    return this.http.get<any>(`${this.api}/conversations/${id}`)
  }

  assignConversation(id: number, agent_id: number) {
    return this.http.put<any>(`${this.api}/conversations/${id}/assign`, { agent_id })
  }

  updateConversationStatus(id: number, status: string) {
    return this.http.put<any>(`${this.api}/conversations/${id}/status`, { status })
  }

  markRead(id: number) {
    return this.http.put<any>(`${this.api}/conversations/${id}/read`, {})
  }

  deleteConversation(id: number) {
    return this.http.delete<any>(`${this.api}/conversations/${id}`)
  }

  // ── Messages ──────────────────────────────────────────
  getMessages(convId: number, page = 1) {
    return this.http.get<any>(`${this.api}/conversations/${convId}/messages`, {
      params: new HttpParams().set('page', page).set('limit', '50')
    })
  }

  sendMessage(convId: number, body: string, type = 'text') {
    return this.http.post<any>(`${this.api}/conversations/${convId}/messages`, { type, body })
  }

  // ── Channels ──────────────────────────────────────────
  getChannels() { return this.http.get<any[]>(`${this.api}/channels`) }
  createChannel(data: any) { return this.http.post<any>(`${this.api}/channels`, data) }
  updateChannel(id: number, data: any) { return this.http.put<any>(`${this.api}/channels/${id}`, data) }
  deleteChannel(id: number) { return this.http.delete<any>(`${this.api}/channels/${id}`) }
  reconnectChannel(id: number) { return this.http.post<any>(`${this.api}/channels/${id}/reconnect`, {}) }
  getQr(id: number) { return this.http.get<any>(`${this.api}/channels/${id}/qr`) }

  // ── Agents ────────────────────────────────────────────
  getAgents(branch_id?: number) {
    let params = new HttpParams()
    if (branch_id) params = params.set('branch_id', branch_id)
    return this.http.get<any[]>(`${this.api}/agents`, { params })
  }
  createAgent(data: any) { return this.http.post<any>(`${this.api}/agents`, data) }
  updateAgent(id: number, data: any) { return this.http.put<any>(`${this.api}/agents/${id}`, data) }
  deleteAgent(id: number) { return this.http.delete<any>(`${this.api}/agents/${id}`) }
}
