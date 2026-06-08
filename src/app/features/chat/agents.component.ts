import { Component, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../core/services/api.service'

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="agents-page">
      <div class="page-header">
        <h2>Agentes</h2>
        <button class="btn btn-primary" (click)="showForm = !showForm">
          <span class="material-symbols-rounded">person_add</span> Nuevo agente
        </button>
      </div>

      @if (showForm) {
        <div class="form-card fade-in">
          <h3>Nuevo agente</h3>
          <div class="form-grid">
            <div class="field">
              <label>Nombre</label>
              <input class="input" [(ngModel)]="form.name" placeholder="Juan Pérez">
            </div>
            <div class="field">
              <label>Email</label>
              <input class="input" [(ngModel)]="form.email" type="email" placeholder="juan@empresa.com">
            </div>
            <div class="field">
              <label>Contraseña</label>
              <input class="input" [(ngModel)]="form.password" type="password" placeholder="••••••••">
            </div>
            <div class="field">
              <label>Rol</label>
              <select class="input" [(ngModel)]="form.role">
                <option value="agent">Agente</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="field">
              <label>Sucursal ID</label>
              <input class="input" [(ngModel)]="form.branch_id" type="number" placeholder="1">
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" (click)="create()" [disabled]="creating()">
              {{ creating() ? 'Creando...' : 'Crear agente' }}
            </button>
            <button class="btn btn-ghost" (click)="showForm = false">Cancelar</button>
          </div>
        </div>
      }

      <div class="agents-table">
        <div class="table-header">
          <span>Agente</span>
          <span>Rol</span>
          <span>Sucursal</span>
          <span>Estado</span>
        </div>
        @for (ag of agents(); track ag.id) {
          <div class="table-row">
            <div class="ag-info">
              <div class="avatar sm">{{ initials(ag.name) }}</div>
              <div>
                <div class="ag-name">{{ ag.name }}</div>
                <div class="ag-email text-muted text-xs">{{ ag.email }}</div>
              </div>
            </div>
            <span class="role-badge" [class]="ag.role">{{ roleLabel(ag.role) }}</span>
            <span class="text-small text-muted">{{ ag.branch_name }}</span>
            <span class="active-dot" [class.active]="ag.is_active"></span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .agents-page { flex: 1; overflow-y: auto; padding: 24px; }
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

    .agents-table { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; }
    .table-header {
      display: grid; grid-template-columns: 2fr 1fr 1fr 80px;
      padding: 10px 16px; background: var(--bg-2);
      font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .5px;
    }
    .table-row {
      display: grid; grid-template-columns: 2fr 1fr 1fr 80px;
      padding: 12px 16px; align-items: center; border-top: 1px solid var(--border);
      transition: background .12s;
    }
    .table-row:hover { background: var(--bg-2); }

    .ag-info { display: flex; align-items: center; gap: 10px; }
    .ag-name  { font-size: 13.5px; font-weight: 500; }
    .ag-email { margin-top: 1px; }

    .role-badge {
      display: inline-flex; padding: 2px 8px; border-radius: 99px;
      font-size: 11px; font-weight: 500;
    }
    .role-badge.admin      { background: var(--purple-bg); color: var(--purple); }
    .role-badge.supervisor { background: var(--accent-bg); color: var(--accent); }
    .role-badge.agent      { background: var(--bg-3);      color: var(--text-2); }

    .active-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--text-3);
    }
    .active-dot.active { background: var(--green); }
  `]
})
export class AgentsComponent implements OnInit {
  agents   = signal<any[]>([])
  creating = signal(false)
  showForm = false
  form     = { name: '', email: '', password: '', role: 'agent', branch_id: 1 }

  constructor(private api: ApiService) {}

  ngOnInit() { this.api.getAgents().subscribe(a => this.agents.set(a)) }

  create() {
    this.creating.set(true)
    this.api.createAgent(this.form).subscribe({
      next: ag => { this.agents.update(l => [ag, ...l]); this.showForm = false; this.creating.set(false) },
      error: () => this.creating.set(false)
    })
  }

  initials(name: string) {
    return name?.split(' ').slice(0,2).map((n: string) => n[0]).join('').toUpperCase() ?? '?'
  }

  roleLabel(role: string) {
    const m: any = { admin: 'Admin', supervisor: 'Supervisor', agent: 'Agente' }
    return m[role] ?? role
  }
}
