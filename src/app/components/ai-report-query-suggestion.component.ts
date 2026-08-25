// src/app/components/ai-report-query-suggestion.component.ts
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../services/ai.service';
import { AiReportQuerySuggestion } from '../models/form-builder.models';

export interface ReportJoinInput {
  table: string; alias: string; joinType: string; leftColumn: string; rightColumn: string;
}

@Component({
  selector: 'app-ai-report-query-suggestion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="arq-overlay" (click)="onOverlayClick($event)">
  <div class="arq-modal">

    <div class="arq-header">
      <h3>✨ Describe the report you want</h3>
      <button class="arq-close" (click)="close.emit()">✕</button>
    </div>

    <div class="arq-body">

      <ng-container *ngIf="!suggestion">
        <label class="arq-label">
          What should this report show? (using {{ primaryTable }}{{ joins.length ? ' + ' + joins.length + ' joined table(s)' : '' }})
        </label>
        <textarea class="arq-textarea" rows="3"
          placeholder="e.g. Total order amount by customer for the last 90 days, top 20 by amount"
          [(ngModel)]="prompt" [disabled]="loading"></textarea>

        <div class="arq-actions">
          <button class="arq-btn arq-btn--outline" (click)="close.emit()" [disabled]="loading">Cancel</button>
          <button class="arq-btn arq-btn--primary" (click)="generate()" [disabled]="loading || !prompt.trim()">
            <span *ngIf="!loading">Generate</span>
            <span *ngIf="loading">Thinking…</span>
          </button>
        </div>
      </ng-container>

      <ng-container *ngIf="suggestion">
        <p class="arq-reason" *ngIf="suggestion.reason">{{ suggestion.reason }}</p>

        <div class="arq-warnings" *ngIf="suggestion.warnings?.length">
          <div class="arq-warning" *ngFor="let w of suggestion.warnings">⚠ {{ w }}</div>
        </div>

        <div class="arq-section-label">Columns</div>
        <div class="arq-chip-list">
          <span class="arq-chip" *ngFor="let c of suggestion.columns">
            {{ c.aggregation ? c.aggregation + '(' + c.column + ')' : c.column }}
            <span class="arq-chip-table">{{ c.table }}</span>
          </span>
          <span class="arq-empty-note" *ngIf="!suggestion.columns.length">No columns suggested</span>
        </div>

        <div class="arq-section-label" *ngIf="suggestion.filters.length">Filters</div>
        <div class="arq-chip-list" *ngIf="suggestion.filters.length">
          <span class="arq-chip" *ngFor="let f of suggestion.filters">
            {{ f.table }}.{{ f.column }} {{ f.operator }} "{{ f.value }}"
          </span>
        </div>

        <div class="arq-section-label" *ngIf="suggestion.groupBy.length">Group by</div>
        <div class="arq-chip-list" *ngIf="suggestion.groupBy.length">
          <span class="arq-chip" *ngFor="let g of suggestion.groupBy">{{ g }}</span>
        </div>

        <div class="arq-section-label" *ngIf="suggestion.orderBy.length">Sort</div>
        <div class="arq-chip-list" *ngIf="suggestion.orderBy.length">
          <span class="arq-chip" *ngFor="let o of suggestion.orderBy">
            {{ o.table }}.{{ o.column }} {{ o.direction }}
          </span>
        </div>

        <div class="arq-section-label">Row limit</div>
        <div class="arq-chip-list"><span class="arq-chip">TOP {{ suggestion.topN }}</span></div>

        <div class="arq-actions">
          <button class="arq-btn arq-btn--outline" (click)="suggestion = null">← Edit prompt</button>
          <button class="arq-btn arq-btn--outline" (click)="generate()" [disabled]="loading">Regenerate</button>
          <button class="arq-btn arq-btn--primary" (click)="apply.emit(suggestion)">Apply to builder</button>
        </div>
      </ng-container>

    </div>
  </div>
</div>
  `,
  styles: [`
    .arq-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex;
      align-items: center; justify-content: center; z-index: 1000; }
    .arq-modal { background: #fff; border-radius: 12px; width: 520px; max-width: 92vw;
      max-height: 86vh; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 20px 50px rgba(0,0,0,.25); }
    .arq-header { display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #e5e7eb; }
    .arq-header h3 { margin: 0; font-size: 15px; }
    .arq-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }
    .arq-body { padding: 20px; overflow-y: auto; }
    .arq-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .arq-textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px;
      padding: 10px 12px; font-family: inherit; font-size: 14px; resize: vertical; }
    .arq-reason { font-size: 13px; color: #475569; margin: 0 0 14px; }
    .arq-warnings { margin-bottom: 10px; }
    .arq-warning { font-size: 12px; color: #b45309; background: #fffbeb; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; }
    .arq-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      color: #94a3b8; margin: 14px 0 6px; }
    .arq-section-label:first-of-type { margin-top: 0; }
    .arq-chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .arq-chip { font-size: 12px; padding: 5px 10px; border-radius: 6px; background: #eef2ff; color: #4338ca;
      display: inline-flex; align-items: center; gap: 6px; }
    .arq-chip-table { font-size: 10px; color: #94a3b8; background: #fff; padding: 1px 5px; border-radius: 4px; }
    .arq-empty-note { font-size: 12px; color: #94a3b8; font-style: italic; }
    .arq-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .arq-btn { padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      font-family: inherit; border: none; }
    .arq-btn--primary { background: #6366f1; color: #fff; }
    .arq-btn--primary:disabled { background: #c7d2fe; cursor: not-allowed; }
    .arq-btn--outline { background: transparent; border: 1px solid #d1d5db; color: #374151; }
    .arq-btn--outline:disabled { color: #9ca3af; cursor: not-allowed; }
  `]
})
export class AiReportQuerySuggestionComponent {
  private readonly ai = inject(AiService);

  @Input() primaryTable = '';
  @Input() joins: ReportJoinInput[] = [];
  @Input() availableColumns: Record<string, string[]> = {};

  @Output() close = new EventEmitter<void>();
  @Output() error = new EventEmitter<string>();
  @Output() apply = new EventEmitter<AiReportQuerySuggestion>();

  prompt = '';
  loading = false;
  suggestion: AiReportQuerySuggestion | null = null;

  generate(): void {
    if (!this.prompt.trim()) return;
    this.loading = true;
    this.ai.suggestReportQuery({
      prompt: this.prompt.trim(),
      primaryTable: this.primaryTable,
      joins: this.joins,
      availableColumns: this.availableColumns
    }).subscribe({
      next: (s) => { this.loading = false; this.suggestion = s; },
      error: () => {
        this.loading = false;
        this.error.emit('Report query suggestion failed. Please try again.');
      }
    });
  }

  onOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.close.emit();
  }
}
