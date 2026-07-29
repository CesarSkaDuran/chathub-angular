import { Component, ElementRef, EventEmitter, HostListener, Output, signal } from '@angular/core'

interface EmojiCategory {
  label: string
  icon: string
  emojis: string[]
}

const CATEGORIES: EmojiCategory[] = [
  {
    label: 'Caritas',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','😂','🤣','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨',
      '😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕',
      '🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁',
      '☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣',
      '😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹',
    ],
  },
  {
    label: 'Gestos',
    icon: '👍',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
      '🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🙏','✍️','💅',
      '🤳','💪','🦾','🦵','🦿','🦶','👂','👃','👀','👁️','👅','👄',
    ],
  },
  {
    label: 'Corazones',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
      '💘','💝','💟','♥️','💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️‍🗨️','🗨️','🗯️','💭',
    ],
  },
  {
    label: 'Objetos',
    icon: '🎉',
    emojis: [
      '🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱',
      '🔥','⭐','🌟','✨','⚡','☀️','🌈','☕','🍕','🍔','🍟','🌮','🍩','🍦','🍺','🍷',
      '📱','💻','⌚','📷','🎥','🎧','🎮','📞','✅','❌','⚠️','❗','❓','💡','🔒','🔑',
    ],
  },
]

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  template: `
    <div class="emoji-picker">
      <div class="emoji-tabs">
        @for (cat of categories; track cat.label) {
          <button
            class="emoji-tab"
            [class.active]="activeCategory().label === cat.label"
            (click)="activeCategory.set(cat)"
            [title]="cat.label">
            {{ cat.icon }}
          </button>
        }
      </div>
      <div class="emoji-grid">
        @for (emoji of activeCategory().emojis; track emoji) {
          <button class="emoji-btn" (click)="select(emoji)">{{ emoji }}</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .emoji-picker {
      width: 300px;
      max-height: 320px;
      display: flex;
      flex-direction: column;
      background: var(--bg-1);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }

    .emoji-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      background: var(--bg-2);
      flex-shrink: 0;
    }

    .emoji-tab {
      flex: 1;
      padding: 8px 0;
      font-size: 16px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      opacity: 0.6;
      transition: all 0.15s;

      &:hover {
        opacity: 1;
        background: var(--bg-3);
      }

      &.active {
        opacity: 1;
        border-bottom-color: var(--accent);
      }
    }

    .emoji-grid {
      flex: 1;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
      padding: 8px;
    }

    .emoji-btn {
      background: transparent;
      border: none;
      font-size: 20px;
      line-height: 1;
      padding: 6px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.1s;

      &:hover {
        background: var(--bg-3);
      }
    }
  `]
})
export class EmojiPickerComponent {
  @Output() emojiSelected = new EventEmitter<string>()

  categories = CATEGORIES
  activeCategory = signal(CATEGORIES[0])

  constructor(private el: ElementRef) {}

  select(emoji: string) {
    this.emojiSelected.emit(emoji)
  }

  contains(target: EventTarget | null): boolean {
    return this.el.nativeElement.contains(target)
  }
}
