import { Component, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../../core/services/api.service'

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.scss'
})
export class AgentsComponent implements OnInit {
  agents   = signal<any[]>([])
  creating = signal(false)
  showForm = false
  editingId: number | null = null
  form     = { name: '', email: '', password: '', role: 'agent', branch_id: 1 }

  constructor(private api: ApiService) {}

  ngOnInit() { this.api.getAgents().subscribe(a => this.agents.set(a)) }

  showCreateForm() {
    this.editingId = null
    this.form = { name: '', email: '', password: '', role: 'agent', branch_id: 1 }
    this.showForm = true
  }

  edit(agent: any) {
    this.editingId = agent.id
    this.form = { 
      name: agent.name, 
      email: agent.email, 
      password: '', 
      role: agent.role, 
      branch_id: agent.branch_id 
    }
    this.showForm = true
  }

  cancel() {
    this.showForm = false
    this.editingId = null
    this.form = { name: '', email: '', password: '', role: 'agent', branch_id: 1 }
  }

  save() {
    this.creating.set(true)
    let data: any = { ...this.form }
    if (this.editingId && !data.password) {
      const { password, ...dataWithoutPassword } = data
      data = dataWithoutPassword
    }

    const obs = this.editingId 
      ? this.api.updateAgent(this.editingId, data)
      : this.api.createAgent(data)

    obs.subscribe({
      next: ag => {
        if (this.editingId) {
          this.agents.update(l => l.map(a => a.id === this.editingId ? { ...a, ...ag } : a))
        } else {
          this.agents.update(l => [ag, ...l])
        }
        this.cancel()
        this.creating.set(false)
      },
      error: () => this.creating.set(false)
    })
  }

  remove(id: number) {
    if (!confirm('¿Eliminar este agente?')) return
    this.api.deleteAgent(id).subscribe(() => {
      this.agents.update(l => l.filter(a => a.id !== id))
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
