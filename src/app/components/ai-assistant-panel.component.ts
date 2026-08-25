// src/app/components/ai-assistant-panel.component.ts
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../services/ai.service';
import { AiAssistantAction, AiAssistantHistoryItem } from '../models/form-builder.models';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-ai-assistant-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<button class="aap-fab" (click)="open = !open" [class.aap-fab--open]="open">
  <span *ngIf="!open">✨</span>
  <span *ngIf="open">✕</span>
</button>

<div class="aap-panel" *ngIf="open">
  <div class="aap-header">
    <span>✨ Assistant</span>
    <button class="aap-clear" (click)="clearChat()" title="Clear conversation">↺</button>
  </div>

  <div class="aap-messages">
    <div class="aap-empty" *ngIf="!messages.length">
      Ask me to build a form, jump to a screen, or optimize a form's layout.
      <div class="aap-suggestions">
        <button class="aap-suggestion" *ngFor="let s of suggestions" (click)="sendSuggestion(s)">{{ s }}</button>
      </div>
    </div>

    <div class="aap-msg" *ngFor="let m of messages" [class.aap-msg--user]="m.role === 'user'">
      {{ m.text }}
    </div>

    <div class="aap-msg aap-msg--typing" *ngIf="loading">
      <span></span><span></span><span></span>
    </div>
  </div>

  <div class="aap-input-row">
    <input type="text" class="aap-input" placeholder="Ask the assistant…"
      [(ngModel)]="draft" (keyup.enter)="send()" [disabled]="loading" />
    <button class="aap-send" (click)="send()" [disabled]="loading || !draft.trim()">➤</button>
  </div>
</div>
  `,
  styles: [`
    .aap-fab { position: fixed; bottom: 24px; right: 24px; width: 52px; height: 52px; border-radius: 50%;
      background: #6366f1; color: #fff; border: none; font-size: 20px; cursor: pointer;
      box-shadow: 0 6px 20px rgba(99,102,241,.4); z-index: 1100; display: flex; align-items: center; justify-content: center; }
    .aap-fab:hover { background: #4f46e5; }
    .aap-fab--open { background: #475569; }

    .aap-panel { position: fixed; bottom: 88px; right: 24px; width: 340px; height: 460px;
      background: #fff; border-radius: 14px; box-shadow: 0 20px 50px rgba(0,0,0,.25);
      display: flex; flex-direction: column; overflow: hidden; z-index: 1100; }
    .aap-header { display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: #6366f1; color: #fff; font-size: 13px; font-weight: 700; }
    .aap-clear { background: none; border: none; color: #fff; opacity: .8; cursor: pointer; font-size: 14px; }
    .aap-clear:hover { opacity: 1; }

    .aap-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
    .aap-empty { font-size: 12px; color: #94a3b8; text-align: center; padding: 20px 6px; }
    .aap-suggestions { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    .aap-suggestion { font-size: 12px; padding: 7px 10px; border-radius: 8px; border: 1px solid #e2e8f0;
      background: #f8fafc; color: #475569; cursor: pointer; text-align: left; }
    .aap-suggestion:hover { background: #eef2ff; border-color: #a5b4fc; color: #4338ca; }

    .aap-msg { max-width: 85%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4;
      background: #f1f5f9; color: #0f172a; align-self: flex-start; }
    .aap-msg--user { background: #6366f1; color: #fff; align-self: flex-end; }
    .aap-msg--typing { display: flex; gap: 4px; align-items: center; padding: 10px 14px; }
    .aap-msg--typing span { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; animation: aap-bounce 1.2s infinite; }
    .aap-msg--typing span:nth-child(2) { animation-delay: .15s; }
    .aap-msg--typing span:nth-child(3) { animation-delay: .3s; }
    @keyframes aap-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }

    .aap-input-row { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #f1f5f9; }
    .aap-input { flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px;
      font-size: 13px; font-family: inherit; outline: none; }
    .aap-input:focus { border-color: #6366f1; }
    .aap-send { width: 36px; height: 36px; border-radius: 8px; border: none; background: #6366f1;
      color: #fff; cursor: pointer; font-size: 14px; }
    .aap-send:disabled { background: #c7d2fe; cursor: not-allowed; }
  `]
})
export class AiAssistantPanelComponent {
  private readonly ai = inject(AiService);

  @Output() action = new EventEmitter<AiAssistantAction>();
  @Output() error = new EventEmitter<string>();

  open = false;
  draft = '';
  loading = false;
  messages: ChatMessage[] = [];

  suggestions: string[] = [
    'Generate a new form for me',
    'Take me to Analytics',
    'Optimize the layout of the form I have open'
  ];

  sendSuggestion(s: string): void {
    this.draft = s;
    this.send();
  }

  clearChat(): void {
    this.messages = [];
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.loading) return;

    this.messages.push({ role: 'user', text });
    this.draft = '';
    this.loading = true;

    const history: AiAssistantHistoryItem[] = this.messages
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.text }));

    this.ai.assistant(text, history).subscribe({
      next: (res) => {
        this.loading = false;
        this.messages.push({ role: 'assistant', text: res.reply });
        if (res.action) this.action.emit(res.action);
      },
      error: () => {
        this.loading = false;
        this.error.emit('Assistant is unavailable right now.');
        this.messages.push({ role: 'assistant', text: "Sorry, I couldn't process that." });
      }
    });
  }
}
