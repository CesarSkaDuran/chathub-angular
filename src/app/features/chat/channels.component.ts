import { Component, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../core/services/api.service'
import { SocketService } from '../../core/services/socket.service'

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="channels-page">
      <div class="page-header">
        <h2>Canales</h2>
        <button class="btn btn-primary" (click)="showForm = !showForm">
          <span class="material-symbols-rounded">add</span> Nuevo canal
        </button>
      </div>

      @if (showForm) {
        <div class="form-card fade-in">
          <h3>Agregar canal WhatsApp</h3>
          <div class="form-grid">
            <div class="field">
              <label>Nombre</label>
              <input class="input" [(ngModel)]="form.name" placeholder="WhatsApp Norte 1">
            </div>
            <div class="field">
              <label>Número (con código de país)</label>
              <input class="input" [(ngModel)]="form.identifier" placeholder="573001234567">
            </div>
            <div class="field">
              <label>Tipo</label>
              <select class="input" [(ngModel)]="form.type">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="webchat">Chat Web</option>
              </select>
            </div>
            <div class="field">
              <label>Sucursal ID</label>
              <input class="input" [(ngModel)]="form.branch_id" type="number" placeholder="1">
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" (click)="create()" [disabled]="creating()">
              {{ creating() ? 'Creando...' : 'Crear canal' }}
            </button>
            <button class="btn btn-ghost" (click)="showForm = false">Cancelar</button>
          </div>
        </div>
      }

      <div class="channels-grid">
        @for (ch of channels(); track ch.id) {
          <div class="channel-card">
            <div class="card-top">
              <span class="ch-badge" [class]="ch.type">
                <span class="material-symbols-rounded icon-fill">{{ chIcon(ch.type) }}</span>
                {{ ch.type }}
              </span>
              <span class="status-dot-lg" [class]="ch.status" title="{{ ch.status }}"></span>
            </div>
            <div class="ch-name">{{ ch.name }}</div>
            <div class="ch-id">{{ ch.identifier }}</div>
            <div class="ch-branch text-muted text-small">{{ ch.branch_name }}</div>

            @if (ch.type === 'whatsapp') {
              <div class="card-actions">
                @if (ch.status === 'connecting' && qrs()[ch.id]) {
                  <div class="qr-wrap">
                    <img [src]="qrs()[ch.id]" alt="QR" class="qr-img">
                    <p class="text-small text-muted">Escanea con WhatsApp</p>
                  </div>
                }
                <button class="btn btn-ghost btn-sm" (click)="reconnect(ch)">
                  <span class="material-symbols-rounded">refresh</span> Reconectar
                </button>
                <button class="btn btn-danger btn-sm" (click)="remove(ch.id)">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .channels-page { flex: 1; overflow-y: auto; padding: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .page-header h2 { font-size: 18px; font-weight: 600; }

    .form-card {
      background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-lg);
      padding: 20px; margin-bottom: 20px;
    }
    .form-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 12px; color: var(--text-2); font-weight: 500; }
    .form-actions { display: flex; gap: 10px; }

    .channels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
    .channel-card {
      background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-lg);
      padding: 16px; display: flex; flex-direction: column; gap: 6px;
    }
    .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .ch-name { font-size: 14px; font-weight: 600; }
    .ch-id   { font-size: 12px; color: var(--text-3); font-family: var(--mono); }
    .ch-branch { margin-top: 2px; }

    .status-dot-lg {
      width: 10px; height: 10px; border-radius: 50%;
    }
    .status-dot-lg.active     { background: var(--green); box-shadow: 0 0 6px var(--green); }
    .status-dot-lg.inactive   { background: var(--text-3); }
    .status-dot-lg.error      { background: var(--red); }
    .status-dot-lg.connecting { background: var(--amber); animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

    .card-actions { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    .qr-wrap { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .qr-img  { width: 160px; height: 160px; border-radius: var(--r-md); border: 2px solid var(--border); }
  `]
})
export class ChannelsComponent implements OnInit {
  channels = signal<any[]>([])
  qrs      = signal<Record<number, string>>({})
  creating = signal(false)
  showForm = false
  form     = { name: '', identifier: '', type: 'whatsapp', branch_id: 1 }

  constructor(private api: ApiService, private socket: SocketService) {}

  ngOnInit() {
    this.load()
    this.socket.channelQr$.subscribe(({ channel_id, qr }) => {
      this.qrs.update(q => ({ ...q, [channel_id]: qr }))
    })
    this.socket.channelStatus$.subscribe(({ channel_id, status }) => {
      this.channels.update(list => list.map(ch => ch.id === channel_id ? { ...ch, status } : ch))
    })
  }

  load() { this.api.getChannels().subscribe(c => this.channels.set(c)) }

  create() {
    this.creating.set(true)
    this.api.createChannel(this.form).subscribe({
      next: ch => { this.channels.update(l => [ch, ...l]); this.showForm = false; this.creating.set(false) },
      error: () => this.creating.set(false)
    })
  }

  reconnect(ch: any) {
    this.api.reconnectChannel(ch.id).subscribe()
    this.channels.update(l => l.map(c => c.id === ch.id ? { ...c, status: 'connecting' } : c))
  }

  remove(id: number) {
    if (!confirm('¿Eliminar este canal?')) return
    this.api.deleteChannel(id).subscribe(() => this.channels.update(l => l.filter(c => c.id !== id)))
  }

  chIcon(type: string) {
    const m: any = { whatsapp: 'chat', instagram: 'photo_camera', email: 'mail', webchat: 'language' }
    return m[type] ?? 'hub'
  }
}
