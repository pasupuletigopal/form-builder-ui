// src/app/components/ai-validation-suggestions.component.ts
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../services/ai.service';
import { FormControl, ValidationRule, AiValidationSuggestion } from '../models/form-builder.models';

export interface ApplyValidationEvent {
  isRequired: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: string;
  maxValue?: string;
  pattern?: string;
  ruleNames: string[];
}

interface RuleChoice {
  name: string;
  displayName: string;
  alreadyApplied: boolean;
  include: boolean;
}

@Component({
  selector: 'app-ai-validation-suggestions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="avs-overlay" (click)="onOverlayClick($event)">
  <div class="avs-modal">

    <div class="avs-header">
      <h3>✨ Suggested validation — {{ control.label || control.fieldName }}</h3>
      <button class="avs-close" (click)="close.emit()">✕</button>
    </div>

    <div class="avs-body">

      <div class="avs-loading" *ngIf="loading">
        <div class="avs-spinner"></div>
        <span>Thinking about this field…</span>
      </div>

      <ng-container *ngIf="!loading && suggestion">
        <p class="avs-reason" *ngIf="suggestion.reason">{{ suggestion.reason }}</p>

        <div class="avs-warnings" *ngIf="suggestion.warnings?.length">
          <div class="avs-warning" *ngFor="let w of suggestion.warnings">⚠ {{ w }}</div>
        </div>

        <div class="avs-toggle-row">
          <label class="avs-checkbox">
            <input type="checkbox" [(ngModel)]="applyRequired" [ngModelOptions]="{standalone: true}" />
            Mark as required
          </label>
        </div>

        <div class="avs-row" *ngIf="suggestion.minLength !== undefined || suggestion.maxLength !== undefined">
          <label class="avs-checkbox">
            <input type="checkbox" [(ngModel)]="applyLength" [ngModelOptions]="{standalone: true}" />
            Length: {{ suggestion.minLength ?? '—' }} to {{ suggestion.maxLength ?? '—' }} characters
          </label>
        </div>

        <div class="avs-row" *ngIf="suggestion.minValue !== undefined || suggestion.maxValue !== undefined">
          <label class="avs-checkbox">
            <input type="checkbox" [(ngModel)]="applyRange" [ngModelOptions]="{standalone: true}" />
            Range: {{ suggestion.minValue ?? '—' }} to {{ suggestion.maxValue ?? '—' }}
          </label>
        </div>

        <div class="avs-row" *ngIf="suggestion.pattern">
          <label class="avs-checkbox">
            <input type="checkbox" [(ngModel)]="applyPattern" [ngModelOptions]="{standalone: true}" />
            Pattern: <code>{{ suggestion.pattern }}</code>
          </label>
        </div>

        <div class="avs-rules" *ngIf="ruleChoices.length">
          <div class="avs-rules-label">Validation rules to attach</div>
          <label class="avs-checkbox avs-rule" *ngFor="let r of ruleChoices">
            <input type="checkbox" [(ngModel)]="r.include" [ngModelOptions]="{standalone: true}"
                   [disabled]="r.alreadyApplied" />
            {{ r.displayName }}
            <span class="avs-rule-tag" *ngIf="r.alreadyApplied">already applied</span>
          </label>
        </div>
      </ng-container>

      <div class="avs-empty" *ngIf="!loading && !suggestion && attempted">
        Couldn't generate a suggestion. Try again.
      </div>

      <div class="avs-actions">
        <button class="avs-btn avs-btn--outline" (click)="close.emit()">Cancel</button>
        <button class="avs-btn avs-btn--outline" (click)="load()" [disabled]="loading">Regenerate</button>
        <button class="avs-btn avs-btn--primary" (click)="applyChosen()" [disabled]="loading || !suggestion">
          Apply
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .avs-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex;
      align-items: center; justify-content: center; z-index: 1000; }
    .avs-modal { background: #fff; border-radius: 12px; width: 460px; max-width: 92vw;
      max-height: 86vh; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 20px 50px rgba(0,0,0,.25); }
    .avs-header { display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px; border-bottom: 1px solid #e5e7eb; }
    .avs-header h3 { margin: 0; font-size: 15px; }
    .avs-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }
    .avs-body { padding: 20px; overflow-y: auto; }
    .avs-loading { display: flex; align-items: center; gap: 10px; padding: 30px 0; color: #64748b; font-size: 14px; }
    .avs-spinner { width: 18px; height: 18px; border: 2px solid #e5e7eb; border-top-color: #6366f1;
      border-radius: 50%; animation: avs-spin .7s linear infinite; }
    @keyframes avs-spin { to { transform: rotate(360deg); } }
    .avs-reason { font-size: 13px; color: #475569; margin: 0 0 14px; }
    .avs-warnings { margin-bottom: 10px; }
    .avs-warning { font-size: 12px; color: #b45309; background: #fffbeb; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; }
    .avs-toggle-row, .avs-row { margin-bottom: 10px; }
    .avs-checkbox { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; cursor: pointer; }
    .avs-checkbox code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
    .avs-rules { margin-top: 14px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
    .avs-rules-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      color: #94a3b8; margin-bottom: 8px; }
    .avs-rule { margin-bottom: 8px; }
    .avs-rule-tag { font-size: 11px; color: #94a3b8; font-style: italic; }
    .avs-empty { padding: 24px 0; text-align: center; color: #94a3b8; font-size: 13px; }
    .avs-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .avs-btn { padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
      font-family: inherit; border: none; }
    .avs-btn--primary { background: #6366f1; color: #fff; }
    .avs-btn--primary:disabled { background: #c7d2fe; cursor: not-allowed; }
    .avs-btn--outline { background: transparent; border: 1px solid #d1d5db; color: #374151; }
    .avs-btn--outline:disabled { color: #9ca3af; cursor: not-allowed; }
  `]
})
export class AiValidationSuggestionsComponent implements OnInit {
  private readonly ai = inject(AiService);

  @Input() control!: FormControl;
  @Input() validationRules: ValidationRule[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() error = new EventEmitter<string>();
  @Output() apply = new EventEmitter<ApplyValidationEvent>();

  loading = false;
  attempted = false;
  suggestion: AiValidationSuggestion | null = null;

  applyRequired = false;
  applyLength = false;
  applyRange = false;
  applyPattern = false;
  ruleChoices: RuleChoice[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.attempted = true;
    this.ai.suggestValidations(this.control).subscribe({
      next: (s) => {
        this.loading = false;
        this.suggestion = s;
        this.applyRequired = s.isRequired;
        this.applyLength = s.minLength !== undefined || s.maxLength !== undefined;
        this.applyRange = s.minValue !== undefined || s.maxValue !== undefined;
        this.applyPattern = !!s.pattern;

        const appliedIds = new Set(this.control.validations.map(v => v.validationRuleId));
        this.ruleChoices = s.validationRuleNames.map(name => {
          const rule = this.validationRules.find(r => r.name === name);
          const alreadyApplied = !!rule && appliedIds.has(rule.id);
          return {
            name,
            displayName: rule?.displayName ?? name,
            alreadyApplied,
            include: !alreadyApplied
          };
        });
      },
      error: () => {
        this.loading = false;
        this.error.emit('Validation suggestion failed. Please try again.');
      }
    });
  }

  applyChosen(): void {
    if (!this.suggestion) return;
    const event: ApplyValidationEvent = {
      isRequired: this.applyRequired,
      minLength: this.applyLength ? this.suggestion.minLength : undefined,
      maxLength: this.applyLength ? this.suggestion.maxLength : undefined,
      minValue: this.applyRange ? this.suggestion.minValue : undefined,
      maxValue: this.applyRange ? this.suggestion.maxValue : undefined,
      pattern: this.applyPattern ? this.suggestion.pattern : undefined,
      ruleNames: this.ruleChoices.filter(r => r.include && !r.alreadyApplied).map(r => r.name)
    };
    this.apply.emit(event);
  }

  onOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.close.emit();
  }
}
