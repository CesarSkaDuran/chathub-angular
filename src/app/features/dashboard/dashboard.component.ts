import { Component, OnInit, signal } from '@angular/core'
import { ApiService } from '../../core/services/api.service'

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="dashboard">
      <div class="dash-header">
        <h2>Dashboard</h2>
        <span class="text-muted text-small">Resumen de hoy</span>
      </div>

      @if (loading()) {
        <div class="dash-loading">
          <div class="spinner-ring"></div>
        </div>
      } @else {
        <!-- KPI cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon open"><span class="material-symbols-rounded icon-fill">chat_bubble</span></div>
            <div class="kpi-val">{{ stats()?.open ?? 0 }}</div>
            <div class="kpi-label">Abiertas</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon pending"><span class="material-symbols-rounded icon-fill">pending</span></div>
            <div class="kpi-val">{{ stats()?.pending ?? 0 }}</div>
            <div class="kpi-label">Pendientes</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon resolved"><span class="material-symbols-rounded icon-fill">check_circle</span></div>
            <div class="kpi-val">{{ stats()?.resolved_today ?? 0 }}</div>
            <div class="kpi-label">Resueltas hoy</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon unassigned"><span class="material-symbols-rounded icon-fill">person_off</span></div>
            <div class="kpi-val">{{ stats()?.unassigned ?? 0 }}</div>
            <div class="kpi-label">Sin asignar</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon messages"><span class="material-symbols-rounded icon-fill">forum</span></div>
            <div class="kpi-val">{{ stats()?.messages_today ?? 0 }}</div>
            <div class="kpi-label">Mensajes hoy</div>
          </div>
        </div>

        <!-- By channel -->
        <div class="section">
          <h3 class="section-title">Conversaciones por canal</h3>
          <div class="channel-list">
            @for (ch of stats()?.by_channel ?? []; track ch.id) {
              <div class="channel-row">
                <div class="ch-info">
                  <span class="ch-badge" [class]="ch.type">
                    <span class="material-symbols-rounded icon-fill">{{ chIcon(ch.type) }}</span>
                    {{ ch.name }}
                  </span>
                  <span class="status-dot" [class]="ch.channel_status" title="{{ ch.channel_status }}"></span>
                </div>
                <div class="ch-bar-wrap">
                  <div class="ch-bar" [style.width.%]="barWidth(ch.open_count)"></div>
                </div>
                <span class="ch-count">{{ ch.open_count }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard { flex: 1; overflow-y: auto; padding: 24px; }
    .dash-header { margin-bottom: 24px; }
    .dash-header h2 { font-size: 18px; font-weight: 600; }
    .dash-loading { display: flex; justify-content: center; padding: 60px; }
    .spinner-ring {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid var(--bg-3); border-top-color: var(--accent);
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; margin-bottom: 28px; }
    .kpi-card {
      background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-lg);
      padding: 18px; display: flex; flex-direction: column; gap: 8px;
    }
    .kpi-icon {
      width: 38px; height: 38px; border-radius: var(--r-md);
      display: flex; align-items: center; justify-content: center;
    }
    .kpi-icon .material-symbols-rounded { font-size: 20px; }
    .kpi-icon.open       { background: var(--green-bg); color: var(--green); }
    .kpi-icon.pending    { background: var(--amber-bg); color: var(--amber); }
    .kpi-icon.resolved   { background: var(--bg-3);     color: var(--text-2); }
    .kpi-icon.unassigned { background: var(--red-bg);   color: var(--red); }
    .kpi-icon.messages   { background: var(--accent-bg);color: var(--accent); }
    .kpi-val   { font-size: 28px; font-weight: 700; line-height: 1; }
    .kpi-label { font-size: 12px; color: var(--text-3); }

    .section { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 18px; }
    .section-title { font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 14px; text-transform: uppercase; letter-spacing: .5px; }

    .channel-list { display: flex; flex-direction: column; gap: 10px; }
    .channel-row  { display: flex; align-items: center; gap: 12px; }
    .ch-info { display: flex; align-items: center; gap: 8px; width: 200px; flex-shrink: 0; }
    .status-dot {
      width: 7px; height: 7px; border-radius: 50%;
    }
    .status-dot.active   { background: var(--green); }
    .status-dot.inactive { background: var(--text-3); }
    .status-dot.error    { background: var(--red); }
    .status-dot.connecting { background: var(--amber); }
    .ch-bar-wrap { flex: 1; height: 6px; background: var(--bg-3); border-radius: 99px; overflow: hidden; }
    .ch-bar      { height: 100%; background: var(--accent); border-radius: 99px; transition: width .4s; }
    .ch-count    { font-size: 13px; font-weight: 600; width: 30px; text-align: right; }
  `]
})
export class DashboardComponent implements OnInit {
  stats   = signal<any>(null)
  loading = signal(true)

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.stats().subscribe(s => {
      this.stats.set(s)
      this.loading.set(false)
    })
  }

  chIcon(type: string) {
    const m: any = { whatsapp: 'chat', instagram: 'photo_camera', email: 'mail', webchat: 'language' }
    return m[type] ?? 'hub'
  }

  barWidth(count: number) {
    const max = Math.max(...(this.stats()?.by_channel ?? []).map((c: any) => c.open_count), 1)
    return Math.round((count / max) * 100)
  }
}
