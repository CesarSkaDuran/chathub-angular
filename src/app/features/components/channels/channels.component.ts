import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../../core/services/api.service'
import { SocketService } from '../../../core/services/socket.service'

interface Channel {
  id: number
  name: string
  identifier: string
  type: 'whatsapp' | 'email' | 'webchat'
  branch_id: number
  branch_name?: string
  status: 'active' | 'inactive' | 'error' | 'connecting'
}

interface ChannelHealth {
  healthy: boolean
  needs_repair: boolean
  issues: string[]
  stuck_pending: number
  undelivered: number
  runtime_status: string
  latest_inbound_at: string | null
}

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChannelsComponent implements OnInit {
  private api = inject(ApiService)
  private socket = inject(SocketService)

  channels = signal<Channel[]>([])
  qrs = signal<Record<number, string>>({})
  health = signal<Record<number, ChannelHealth>>({})
  healthErrors = signal<Record<number, string>>({})
  checkingHealth = signal<Record<number, boolean>>({})
  repairing = signal<Record<number, boolean>>({})
  creating = signal(false)
  showForm = false
  editingId: number | null = null
  form = { name: '', identifier: '', type: 'whatsapp' as Channel['type'], branch_id: 1 }

  // ✅ Estado del modal
  qrModalOpen = signal(false)
  qrModalImage = signal<string | null>(null)
  qrModalLoading = signal(false)
  qrModalError = signal<string | null>(null)
  qrModalChannelId = signal<number | null>(null)
  qrModalChannelName = signal<string>('')

  ngOnInit() {
    this.load()

    this.socket.channelQr$.subscribe(({ channel_id, qr }) => {
      console.log('🔌 QR recibido por socket:', channel_id)

      // Actualizar siempre el QR en el mapa
      this.qrs.update(q => ({ ...q, [channel_id]: qr }))

      // Actualizar el modal si está abierto para este canal
      if (this.qrModalOpen() && this.qrModalChannelId() === channel_id) {
        this.qrModalImage.set(qr)
        this.qrModalLoading.set(false)
        this.qrModalError.set(null)
      }

      this.updateStatus(channel_id, 'connecting')
    })

    this.socket.channelStatus$.subscribe(({ channel_id, status }) => {
      this.updateStatus(channel_id, status)
    })
  }

  load() {
    this.api.getChannels().subscribe(c => this.channels.set(c as Channel[]))
  }

  // ✅ Abrir modal del QR
  openQrModal(channelId: number) {
    const channel = this.channels().find(c => c.id === channelId)
    if (!channel) return

    this.qrModalChannelId.set(channelId)
    this.qrModalChannelName.set(channel.name)
    this.qrModalOpen.set(true)

    // Si ya tenemos el QR guardado, mostrarlo directamente
    const existingQr = this.qrs()[channelId]
    if (existingQr) {
      this.qrModalImage.set(existingQr)
      this.qrModalError.set(null)
      this.qrModalLoading.set(false)
    } else {
      // Si no, generar uno nuevo
      this.qrModalImage.set(null)
      this.qrModalError.set(null)
      this.qrModalLoading.set(true)
      this.generateQr(channelId, true)
    }
  }

  // ✅ Cerrar modal
  closeQrModal() {
    this.qrModalOpen.set(false)
    this.qrModalImage.set(null)
    this.qrModalError.set(null)
    this.qrModalLoading.set(false)
    this.qrModalChannelId.set(null)
    this.qrModalChannelName.set('')
  }

  // ✅ Reintentar generar QR
  retryQr() {
    const id = this.qrModalChannelId()
    if (id) {
      this.qrModalError.set(null)
      this.qrModalLoading.set(true)
      this.generateQr(id, true)
    }
  }

  // ✅ Descargar QR
  downloadQr() {
    const img = this.qrModalImage()
    const name = this.qrModalChannelName()
    if (!img) return

    const link = document.createElement('a')
    link.href = img
    link.download = `qr-${name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.click()
  }

  showCreateForm() {
    this.editingId = null
    this.form = { name: '', identifier: '', type: 'whatsapp', branch_id: 1 }
    this.showForm = true
  }

  edit(channel: Channel) {
    this.editingId = channel.id
    this.form = {
      name: channel.name,
      identifier: channel.identifier,
      type: channel.type,
      branch_id: channel.branch_id
    }
    this.showForm = true
  }

  cancel() {
    this.showForm = false
    this.editingId = null
    this.form = { name: '', identifier: '', type: 'whatsapp', branch_id: 1 }
  }

  save() {
    this.creating.set(true)
    const obs = this.editingId
      ? this.api.updateChannel(this.editingId, this.form)
      : this.api.createChannel(this.form)

    obs.subscribe({
      next: ch => {
        if (this.editingId) {
          this.channels.update(l => l.map(c => c.id === this.editingId ? { ...c, ...ch } : c))
        } else {
          this.channels.update(l => [ch as Channel, ...l])
        }
        this.cancel()
        this.creating.set(false)
      },
      error: () => this.creating.set(false)
    })
  }

  reconnect(ch: Channel) {
    this.api.reconnectChannel(ch.id).subscribe({
      next: () => this.updateStatus(ch.id, 'connecting')
    })
  }

  diagnose(ch: Channel) {
    this.checkingHealth.update(state => ({ ...state, [ch.id]: true }))
    this.healthErrors.update(state => {
      const { [ch.id]: _, ...rest } = state
      return rest
    })
    this.api.getChannelHealth(ch.id).subscribe({
      next: result => {
        this.health.update(state => ({ ...state, [ch.id]: result as ChannelHealth }))
        this.checkingHealth.update(state => ({ ...state, [ch.id]: false }))
      },
      error: err => {
        const message = err.status === 404
          ? 'El backend no tiene disponible el diagnóstico. Sube los archivos de la API y reinicia el servidor.'
          : err.status === 403
            ? 'Tu usuario no tiene permiso para diagnosticar canales.'
            : err.status === 0
              ? 'No fue posible comunicarse con el servidor.'
              : err.error?.error || 'No se pudo diagnosticar el canal.'
        this.healthErrors.update(state => ({ ...state, [ch.id]: message }))
        this.checkingHealth.update(state => ({ ...state, [ch.id]: false }))
      }
    })
  }

  repair(ch: Channel) {
    const issues = this.health()[ch.id]?.issues || []
    const detail = issues.length ? `\n\nProblemas detectados:\n- ${issues.join('\n- ')}` : ''
    if (!confirm(`¿Reparar el canal "${ch.name}"?\n\nSe cerrará su sesión actual y será necesario escanear un QR nuevo. Los chats y mensajes no se eliminarán.${detail}`)) return

    this.repairing.update(state => ({ ...state, [ch.id]: true }))
    this.api.repairChannel(ch.id).subscribe({
      next: () => {
        this.repairing.update(state => ({ ...state, [ch.id]: false }))
        this.health.update(state => {
          const { [ch.id]: _, ...rest } = state
          return rest
        })
        this.updateStatus(ch.id, 'connecting')
        this.qrModalChannelId.set(ch.id)
        this.qrModalChannelName.set(ch.name)
        this.qrModalImage.set(null)
        this.qrModalError.set(null)
        this.qrModalLoading.set(true)
        this.qrModalOpen.set(true)
      },
      error: () => this.repairing.update(state => ({ ...state, [ch.id]: false }))
    })
  }

  // ✅ Generar QR (con soporte para modal)
  generateQr(id: number, forModal: boolean = false) {
    this.updateStatus(id, 'connecting')

    // Primero reconectar para generar un nuevo QR
    this.api.reconnectChannel(id).subscribe({
      next: () => {
        // El QR llegará por socket.io, no por HTTP
        if (forModal) {
          this.qrModalLoading.set(true)
          this.qrModalError.set(null)
        }
      },
      error: (err) => {
        console.error('Error iniciando reconexión:', err)
        this.updateStatus(id, 'error')

        if (forModal) {
          this.qrModalError.set(err.status === 0
            ? 'No se pudo conectar con el servidor'
            : `Error ${err.status}: ${err.message || 'No se pudo generar el QR'}`)
          this.qrModalLoading.set(false)
        }
      }
    })
  }

  remove(id: number) {
    if (!confirm('¿Eliminar este canal?')) return
    this.api.deleteChannel(id).subscribe(() => {
      this.channels.update(l => l.filter(c => c.id !== id))
      this.qrs.update(q => {
        const { [id]: _, ...rest } = q
        return rest
      })
    })
  }

  chIcon(type: string) {
    const m: Record<string, string> = {
      whatsapp: 'chat',
      instagram: 'photo_camera',
      email: 'mail',
      webchat: 'language'
    }
    return m[type] ?? 'hub'
  }

  private updateStatus(channelId: number, status: Channel['status']) {
    this.channels.update(list =>
      list.map(ch => ch.id === channelId ? { ...ch, status } : ch)
    )
  }
}
