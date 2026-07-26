import { Component, OnInit, signal } from '@angular/core'
import { ApiService } from '../../core/services/api.service'

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
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
