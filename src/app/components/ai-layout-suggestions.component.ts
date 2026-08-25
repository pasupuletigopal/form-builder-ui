// src/app/components/ai-layout-suggestions.component.ts
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../services/ai.service';
import { AiLayoutSuggestion, FormControl } from '../models/form-builder.models';

interface RowPreviewCell {
  fieldName: string;
  label: string;
  colSpan: number;
  changed: boolean;
}

interface SuggestionRow {
  suggestion: AiLayoutSuggestion;
  original: FormControl;
  include: boolean;
  changed: boolean;
}

@Component({
  selector: 'app-ai-layout-suggestions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="als-overlay" (click)="onOverlayClick($event)">
  <div class="als-modal">

    <div class="als-header">
      <h3>✨ Layout suggestions</h3>
      <button class="als-close" (click)="close.emit()">✕</button>
    </div>

    <div class="als-body">

      <div class="als-loading" *ngIf="loading">
        <div class="als-spinner"></div>
        <span>Analyzing your form layout…</span>
      </div>

      <ng-container *ngIf="!loading && rows.length">
        <p class="als-summary" *ngIf="summary">{{ summary }}</p>

        <div class="als-preview-label">Current layout</div>
        <div class="als-grid">
          <div class="als-row" *ngFor="let row of currentRows">
            <div class="als-cell" *ngFor="let cell of row" [style.grid-column]="'span ' + cell.colSpan">
              {{ cell.label || cell.fieldName }}
            </div>
          </div>
        </div>

        <div class="als-preview-label als-preview-label--suggested">Suggested layout</div>
        <div class="als-grid">
          <div class="als-row" *ngFor="let row of suggestedRows">
            <div class="als-cell" *ngFor="let cell of row" [class.als-cell--changed]="cell.changed"
                 [style.grid-column]="'span ' + cell.colSpan">
              {{ cell.label || cell.fieldName }}
            </div>
          </div>
        </div>

        <div class="als-list">
          <div class="als-list-row" *ngFor="let r of suggestionRows">
            <label class="als-checkbox">
              <input type="checkbox" [(ngModel)]="r.include" [ngModelOptions]="{standalone: true}" />
            </label>
            <span class="als-field-name">{{ r.original.label || r.original.fieldName }}</span>
            <span class="als-field-change" *ngIf="r.changed">
              colSpan {{ r.original.colSpan }} → {{ r.suggestion.colSpan }},
              row {{ r.original.rowIndex }} → {{ r.suggestion.rowIndex }}
            </span>
            <span class="als-field-nochange" *ngIf="!r.changed">no change</span>
            <span class="als-field-reason" *ngIf="r.suggestion.reason">{{ r.suggestion.reason }}</span>
          </div>
        </div>
      </ng-container>

      <div class="als-empty" *ngIf="!loading && !rows.length && attempted">
        Couldn't generate layout suggestions. Try again.
      </div>

      <div class="als-actions">
        <button class="als-btn als-btn--outline" (click)="close.emit()">Cancel</button>
        <button class="als-btn als-btn--outline" (click)="load()" [disabled]="loading">Regenerate</button>
        <button class="als-btn als-btn--primary" (click)="applySelected()"
                [disabled]="loading || !anySelected()">
          Apply selected
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .als-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex;
      align-items: center; justify-content: center; z-index: 1000; }
    .als-modal { background: #fff; border-radius: 12px; width: 680px; max-width: 94vw;
      max-height: 88vh; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 20px 50px rgba(0,0,0,.25); }
    .als-header { display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #e5e7eb; }
    .als-header h3 { margin: 0; font-size: 16px; }
    .als-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }
    .als-body { padding: 20px; overflow-y: auto; }
    .als-loading { display: flex; align-items: center; gap: 10px; padding: 30px 0; color: #64748b; font-size: 14px; }
    .als-spinner { width: 18px; height: 18px; border: 2px solid #e5e7eb; border-top-color: #6366f1;
      border-radius: 50%; animation: als-spin .7s linear infinite; }
    @keyframes als-spin { to { transform: rotate(360deg); } }
    .als-summary { font-size: 13px; color: #475569; margin: 0 0 14px; }
    .als-preview-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      color: #94a3b8; margin: 14px 0 6px; }
    .als-preview-label--suggested { color: #6366f1; }
    .als-grid { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; margin-bottom: 4px; }
    .als-row { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; margin-bottom: 6px; }
    .als-row:last-child { margin-bottom: 0; }
    .als-cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 6px 8px;
      font-size: 11px; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .als-cell--changed { background: #eef2ff; border-color: #a5b4fc; color: #4338ca; font-weight: 600; }
    .als-list { border: 1px solid #e5e7eb; border-radius: 8px; margin-top: 16px; max-height: 220px; overflow-y: auto; }
    .als-list-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    .als-list-row:last-child { border-bottom: none; }
    .als-field-name { font-weight: 600; color: #0f172a; min-width: 120px; }
    .als-field-change { color: #4338ca; }
    .als-field-nochange { color: #94a3b8; font-style: italic; }
    .als-field-reason { color: #94a3b8; margin-left: auto; text-align: right; max-width: 220px; }
    .als-empty { padding: 24px 0; text-align: center; color: #94a3b8; font-size: 13px; }
    .als-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .als-btn { padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      font-family: inherit; border: none; }
    .als-btn--primary { background: #6366f1; color: #fff; }
    .als-btn--primary:disabled { background: #c7d2fe; cursor: not-allowed; }
    .als-btn--outline { background: transparent; border: 1px solid #d1d5db; color: #374151; }
    .als-btn--outline:disabled { color: #9ca3af; cursor: not-allowed; }
  `]
})
export class AiLayoutSuggestionsComponent implements OnInit {
  private readonly ai = inject(AiService);

  @Input() controls: FormControl[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() error = new EventEmitter<string>();
  @Output() apply = new EventEmitter<AiLayoutSuggestion[]>();

  loading = false;
  attempted = false;
  summary = '';
  rows: SuggestionRow[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.controls.length) return;
    this.loading = true;
    this.attempted = true;
    this.ai.suggestLayout(this.controls).subscribe({
      next: (result) => {
        this.loading = false;
        this.summary = result.summary || '';
        const byField = new Map(this.controls.map(c => [c.fieldName, c]));
        this.rows = result.suggestions
          .filter(s => byField.has(s.fieldName))
          .map(s => {
            const original = byField.get(s.fieldName)!;
            const changed = original.rowIndex !== s.rowIndex
              || original.colIndex !== s.colIndex
              || original.colSpan !== s.colSpan
              || original.sortOrder !== s.sortOrder;
            return { suggestion: s, original, include: changed, changed };
          });
      },
      error: () => {
        this.loading = false;
        this.error.emit('Layout suggestion failed. Please try again.');
      }
    });
  }

  get suggestionRows(): SuggestionRow[] {
    return this.rows;
  }

  private buildRows(getCell: (r: SuggestionRow) => RowPreviewCell, useSuggested: boolean): RowPreviewCell[][] {
    const grouped = new Map<number, { sortOrder: number; cell: RowPreviewCell }[]>();
    for (const r of this.rows) {
      const rowIndex = useSuggested ? r.suggestion.rowIndex : r.original.rowIndex;
      const sortOrder = useSuggested ? r.suggestion.sortOrder : r.original.sortOrder;
      if (!grouped.has(rowIndex)) grouped.set(rowIndex, []);
      grouped.get(rowIndex)!.push({ sortOrder, cell: getCell(r) });
    }
    return Array.from(grouped.keys())
      .sort((a, b) => a - b)
      .map(k => grouped.get(k)!.sort((a, b) => a.sortOrder - b.sortOrder).map(x => x.cell));
  }

  get currentRows(): RowPreviewCell[][] {
    return this.buildRows(r => ({
      fieldName: r.original.fieldName,
      label: r.original.label || r.original.fieldName,
      colSpan: r.original.colSpan,
      changed: false
    }), false);
  }

  get suggestedRows(): RowPreviewCell[][] {
    return this.buildRows(r => ({
      fieldName: r.original.fieldName,
      label: r.original.label || r.original.fieldName,
      colSpan: r.suggestion.colSpan,
      changed: r.changed
    }), true);
  }

  anySelected(): boolean {
    return this.rows.some(r => r.include);
  }

  applySelected(): void {
    const selected = this.rows.filter(r => r.include).map(r => r.suggestion);
    if (!selected.length) return;
    this.apply.emit(selected);
  }

  onOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.close.emit();
  }
}
