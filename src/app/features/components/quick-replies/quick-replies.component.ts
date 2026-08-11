import { Component, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../../core/services/api.service'

@Component({
  selector: 'app-quick-replies',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './quick-replies.component.html',
  styleUrl: './quick-replies.component.scss'
})
export class QuickRepliesComponent implements OnInit {
  replies  = signal<any[]>([])
  creating = signal(false)
  showForm = false
  editingId: number | null = null
  form     = { shortcut: '', content: '', branch_id: 1 }

  constructor(private api: ApiService) {}

  ngOnInit() { this.load() }

  load() {
    this.api.getQuickReplies().subscribe(r => this.replies.set(r))
  }

  showCreateForm() {
    this.editingId = null
    this.form = { shortcut: '', content: '', branch_id: 1 }
    this.showForm = true
  }

  edit(reply: any) {
    this.editingId = reply.id
    this.form = { shortcut: reply.shortcut, content: reply.content, branch_id: reply.branch_id || 1 }
    this.showForm = true
  }

  cancel() {
    this.showForm = false
    this.editingId = null
    this.form = { shortcut: '', content: '', branch_id: 1 }
  }

  save() {
    this.creating.set(true)
    const data = { ...this.form }

    const obs = this.editingId
      ? this.api.updateQuickReply(this.editingId, data)
      : this.api.createQuickReply(data)

    obs.subscribe({
      next: reply => {
        if (this.editingId) {
          this.replies.update(l => l.map(r => r.id === this.editingId ? { ...r, ...reply } : r))
        } else {
          this.replies.update(l => [reply, ...l])
        }
        this.cancel()
        this.creating.set(false)
      },
      error: () => this.creating.set(false)
    })
  }

  remove(id: number) {
    if (!confirm('¿Eliminar esta respuesta rápida?')) return
    this.api.deleteQuickReply(id).subscribe(() => {
      this.replies.update(l => l.filter(r => r.id !== id))
    })
  }
}
