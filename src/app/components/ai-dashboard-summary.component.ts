// src/app/components/ai-dashboard-summary.component.ts
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiService } from '../services/ai.service';
import { AiDashboardSummary } from '../models/form-builder.models';

@Component({
  selector: 'app-ai-dashboard-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="ads-overlay" (click)="onOverlayClick($event)">
  <div class="ads-modal">

    <div class="ads-header">
      <h3>✨ Dashboard summary — {{ dashboardName }}</h3>
      <button class="ads-close" (click)="close.emit()">✕</button>
    </div>

    <div class="ads-body">

      <div class="ads-loading" *ngIf="loading">
        <div class="ads-spinner"></div>
        <span>Reading your widgets…</span>
      </div>

      <ng-container *ngIf="!loading && summary">
        <p class="ads-summary-text">{{ summary.summary }}</p>

        <div class="ads-warnings" *ngIf="summary.warnings?.length">
          <div class="ads-warning" *ngFor="let w of summary.warnings">⚠ {{ w }}</div>
        </div>

        <div class="ads-insights" *ngIf="summary.insights?.length">
          <div class="ads-insights-label">Key points</div>
          <ul>
            <li *ngFor="let i of summary.insights">{{ i }}</li>
          </ul>
        </div>
      </ng-container>

      <div class="ads-empty" *ngIf="!loading && !summary && attempted">
        Couldn't generate a summary. Try again.
      </div>

      <div class="ads-actions">
        <button class="ads-btn ads-btn--outline" (click)="close.emit()">Close</button>
        <button class="ads-btn ads-btn--primary" (click)="load()" [disabled]="loading">Regenerate</button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .ads-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex;
      align-items: center; justify-content: center; z-index: 1000; }
    .ads-modal { background: #fff; border-radius: 12px; width: 460px; max-width: 92vw;
      max-height: 86vh; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 20px 50px rgba(0,0,0,.25); }
    .ads-header { display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #e5e7eb; }
    .ads-header h3 { margin: 0; font-size: 15px; }
    .ads-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }
    .ads-body { padding: 20px; overflow-y: auto; }
    .ads-loading { display: flex; align-items: center; gap: 10px; padding: 30px 0; color: #64748b; font-size: 14px; }
    .ads-spinner { width: 18px; height: 18px; border: 2px solid #e5e7eb; border-top-color: #6366f1;
      border-radius: 50%; animation: ads-spin .7s linear infinite; }
    @keyframes ads-spin { to { transform: rotate(360deg); } }
    .ads-summary-text { font-size: 14px; color: #0f172a; line-height: 1.5; margin: 0 0 14px; }
    .ads-warnings { margin-bottom: 10px; }
    .ads-warning { font-size: 12px; color: #b45309; background: #fffbeb; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; }
    .ads-insights-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      color: #94a3b8; margin-bottom: 6px; }
    .ads-insights ul { margin: 0; padding-left: 18px; }
    .ads-insights li { font-size: 13px; color: #374151; margin-bottom: 6px; line-height: 1.4; }
    .ads-empty { padding: 24px 0; text-align: center; color: #94a3b8; font-size: 13px; }
    .ads-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .ads-btn { padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      font-family: inherit; border: none; }
    .ads-btn--primary { background: #6366f1; color: #fff; }
    .ads-btn--primary:disabled { background: #c7d2fe; cursor: not-allowed; }
    .ads-btn--outline { background: transparent; border: 1px solid #d1d5db; color: #374151; }
  `]
})
export class AiDashboardSummaryComponent implements OnInit {
  private readonly ai = inject(AiService);

  @Input() dashboardName = '';
  @Input() widgets: { title: string; widgetType: string; data: any }[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() error = new EventEmitter<string>();

  loading = false;
  attempted = false;
  summary: AiDashboardSummary | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.attempted = true;
    this.ai.summarizeDashboard({ dashboardName: this.dashboardName, widgets: this.widgets }).subscribe({
      next: (s) => { this.loading = false; this.summary = s; },
      error: () => {
        this.loading = false;
        this.error.emit('Dashboard summary failed. Please try again.');
      }
    });
  }

  onOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.close.emit();
  }
}
