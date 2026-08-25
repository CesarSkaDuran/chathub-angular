import { Component, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../core/services/api.service'

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent {
  startDate = signal<string>(toISODate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
  endDate   = signal<string>(toISODate(new Date()))
  prompt    = signal<string>('')

  metrics   = signal<any>(null)
  report    = signal<string>('')
  loading   = signal(false)
  generating = signal(false)
  error     = signal<string>('')

  constructor(private api: ApiService) {}

  loadMetrics() {
    this.loading.set(true)
    this.error.set('')
    this.metrics.set(null)

    this.api.getReportsMetrics({
      start_date: this.startDate(),
      end_date: this.endDate(),
    }).subscribe({
      next: (res) => {
        this.metrics.set(res)
        this.loading.set(false)
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Error cargando métricas')
        this.loading.set(false)
      }
    })
  }

  generateReport() {
    if (!this.metrics()) this.loadMetrics()

    this.generating.set(true)
    this.error.set('')

    this.api.generateReport({
      start_date: this.startDate(),
      end_date: this.endDate(),
      prompt_extra: this.prompt(),
    }).subscribe({
      next: (res) => {
        this.report.set(res.report)
        this.metrics.set(res.metrics)
        this.generating.set(false)
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Error generando el informe')
        this.generating.set(false)
      }
    })
  }

  formatDuration(seconds: number) {
    if (!seconds) return '0s'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.round(seconds % 60)
    const parts = []
    if (h) parts.push(`${h}h`)
    if (m) parts.push(`${m}m`)
    if (s || !parts.length) parts.push(`${s}s`)
    return parts.join(' ')
  }
}
