// src/app/components/ai-form-generator.component.ts
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../services/ai.service';
import { AiFormDraft } from '../models/form-builder.models';

@Component({
  selector: 'app-ai-form-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="aig-overlay" (click)="onOverlayClick($event)">
  <div class="aig-modal">

    <div class="aig-header">
      <h3>✨ Generate a form with AI</h3>
      <button class="aig-close" (click)="close.emit()">✕</button>
    </div>

    <div class="aig-body">

      <ng-container *ngIf="!draft">
        <label class="aig-label">Describe the form you want</label>
        <textarea
          class="aig-textarea"
          rows="4"
          placeholder="e.g. Employee onboarding form with name, department dropdown, start date, and an emergency contact section"
          [(ngModel)]="prompt"
          [disabled]="loading"
        ></textarea>

        <div class="aig-chips">
          <button class="aig-chip" *ngFor="let ex of examples" (click)="prompt = ex" [disabled]="loading">
            {{ ex }}
          </button>
        </div>

        <div class="aig-actions">
          <button class="aig-btn aig-btn--outline" (click)="close.emit()" [disabled]="loading">Cancel</button>
          <button class="aig-btn aig-btn--primary" (click)="generate()" [disabled]="loading || !prompt.trim()">
            <span *ngIf="!loading">Generate</span>
            <span *ngIf="loading">Generating…</span>
          </button>
        </div>
      </ng-container>

      <ng-container *ngIf="draft">
        <div class="aig-preview-head">
          <div>
            <div class="aig-preview-title">{{ draft.title || draft.name }}</div>
            <div class="aig-preview-sub" *ngIf="draft.description">{{ draft.description }}</div>
          </div>
          <span class="aig-count">{{ draft.controls.length }} field(s)</span>
        </div>

        <div class="aig-warnings" *ngIf="draft.warnings?.length">
          <div class="aig-warning" *ngFor="let w of draft.warnings">⚠ {{ w }}</div>
        </div>

        <div class="aig-field-list">
          <div class="aig-field-row" *ngFor="let c of draft.controls">
            <span class="aig-field-type">{{ c.controlTypeName }}</span>
            <span class="aig-field-label">{{ c.label }}</span>
            <span class="aig-field-name">{{ c.fieldName }}</span>
            <span class="aig-field-required" *ngIf="c.isRequired">Required</span>
          </div>
        </div>

        <div class="aig-actions">
          <button class="aig-btn aig-btn--outline" (click)="reset()" [disabled]="loading">← Edit prompt</button>
          <button class="aig-btn aig-btn--outline" (click)="generate()" [disabled]="loading">Regenerate</button>
          <button class="aig-btn aig-btn--primary" (click)="useForm()" [disabled]="loading">Use this form</button>
        </div>
      </ng-container>

    </div>
  </div>
</div>
  `,
  styles: [`
    .aig-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex;
      align-items: center; justify-content: center; z-index: 1000; }
    .aig-modal { background: #fff; border-radius: 12px; width: 560px; max-width: 92vw;
      max-height: 86vh; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 20px 50px rgba(0,0,0,.25); }
    .aig-header { display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #e5e7eb; }
    .aig-header h3 { margin: 0; font-size: 16px; }
    .aig-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }
    .aig-body { padding: 20px; overflow-y: auto; }
    .aig-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .aig-textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px;
      padding: 10px 12px; font-family: inherit; font-size: 14px; resize: vertical; }
    .aig-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .aig-chip { font-size: 12px; padding: 5px 10px; border-radius: 99px; border: 1px solid #d1d5db;
      background: #f8fafc; cursor: pointer; color: #475569; }
    .aig-chip:hover { background: #eef2ff; border-color: #6366f1; color: #4338ca; }
    .aig-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .aig-btn { padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      font-family: inherit; border: none; }
    .aig-btn--primary { background: #6366f1; color: #fff; }
    .aig-btn--primary:hover { background: #4f46e5; }
    .aig-btn--primary:disabled { background: #c7d2fe; cursor: not-allowed; }
    .aig-btn--outline { background: transparent; border: 1px solid #d1d5db; color: #374151; }
    .aig-btn--outline:disabled { color: #9ca3af; cursor: not-allowed; }
    .aig-preview-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .aig-preview-title { font-size: 15px; font-weight: 700; color: #0f172a; }
    .aig-preview-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
    .aig-count { font-size: 12px; color: #6366f1; background: #eef2ff; padding: 4px 10px; border-radius: 99px; white-space: nowrap; }
    .aig-warnings { margin-bottom: 10px; }
    .aig-warning { font-size: 12px; color: #b45309; background: #fffbeb; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; }
    .aig-field-list { border: 1px solid #e5e7eb; border-radius: 8px; max-height: 300px; overflow-y: auto; }
    .aig-field-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .aig-field-row:last-child { border-bottom: none; }
    .aig-field-type { font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #6366f1;
      background: #eef2ff; padding: 2px 7px; border-radius: 4px; flex-shrink: 0; }
    .aig-field-label { font-weight: 600; color: #0f172a; }
    .aig-field-name { color: #94a3b8; font-family: monospace; font-size: 12px; }
    .aig-field-required { margin-left: auto; font-size: 11px; color: #dc2626; }
  `]
})
export class AiFormGeneratorComponent {
  private readonly ai = inject(AiService);

  @Output() close = new EventEmitter<void>();
  @Output() formGenerated = new EventEmitter<AiFormDraft>();
  @Output() error = new EventEmitter<string>();

  prompt = '';
  loading = false;
  draft: AiFormDraft | null = null;

  examples: string[] = [
    'Employee onboarding form with name, department dropdown, start date, emergency contact',
    'Customer feedback survey with rating, comments, and contact opt-in',
    'Simple contact form: name, email, phone, message'
  ];

  generate(): void {
    if (!this.prompt.trim()) return;
    this.loading = true;
    this.ai.generateForm(this.prompt.trim()).subscribe({
      next: (draft) => {
        this.loading = false;
        this.draft = draft;
      },
      error: () => {
        this.loading = false;
        this.error.emit('AI form generation failed. Please try again.');
      }
    });
  }

  useForm(): void {
    if (!this.draft) return;
    this.formGenerated.emit(this.draft);
  }

  reset(): void {
    this.draft = null;
  }

  onOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.close.emit();
  }
}
