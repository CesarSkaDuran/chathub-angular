import { Injectable } from '@angular/core'
import { environment } from '../../../environments/environment'

interface RuntimeConfig {
  apiUrl?: string
  socketUrl?: string
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  apiUrl = environment.apiUrl
  socketUrl = environment.socketUrl

  async load(): Promise<void> {
    try {
      const res = await fetch('/assets/config.json')
      if (!res.ok) return
      const config: RuntimeConfig = await res.json()
      if (config.apiUrl) this.apiUrl = config.apiUrl
      if (config.socketUrl) this.socketUrl = config.socketUrl
      console.log('[AppConfig] Cargado:', this.apiUrl, this.socketUrl)
    } catch (e) {
      console.warn('[AppConfig] No se pudo cargar config.json, usando environment.ts')
    }
  }
}
