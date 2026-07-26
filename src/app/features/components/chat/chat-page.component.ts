import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { ConversationListComponent } from '../conversation/conversation-list.component'

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [RouterOutlet, ConversationListComponent],
  template: `
    <div class="chat-page">
      <app-conversation-list />
      <router-outlet />
    </div>
  `,
  styles: [`
    .chat-page { display: flex; flex: 1; overflow: hidden; height: 100%; }
  `]
})
export class ChatPageComponent {}
