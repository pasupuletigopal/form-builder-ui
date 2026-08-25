// src/app/services/ai.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse, AiFormDraft, FormControl,
  AiLayoutSuggestionResult, AiValidationSuggestion,
  AiReportQuerySuggestion, AiDashboardSummary,
  AiAssistantHistoryItem, AiAssistantResponse
} from '../models/form-builder.models';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/api`;

  /** Feature 1: prompt → draft form (name + controls) for the AI Form Generator. */
  generateForm(prompt: string): Observable<AiFormDraft> {
    return this.http
      .post<ApiResponse<AiFormDraft>>(`${this.base}/ai/generate-form`, { prompt })
      .pipe(map(r => r.data));
  }

  /** Feature 2: re-flow rowIndex/colIndex/colSpan/sortOrder for a whole form's controls. */
  suggestLayout(controls: FormControl[]): Observable<AiLayoutSuggestionResult> {
    const payload = controls.map(c => ({
      fieldName: c.fieldName,
      label: c.label,
      controlTypeName: c.controlTypeName,
      controlTypeCategory: c.controlTypeCategory,
      colSpan: c.colSpan,
      rowIndex: c.rowIndex,
      colIndex: c.colIndex,
      sortOrder: c.sortOrder
    }));
    return this.http
      .post<ApiResponse<AiLayoutSuggestionResult>>(`${this.base}/ai/suggest-layout`, { controls: payload })
      .pipe(map(r => r.data));
  }

  /** Feature 3: suggest validation config for a single control. */
  suggestValidations(control: FormControl): Observable<AiValidationSuggestion> {
    const payload = {
      fieldName: control.fieldName,
      label: control.label,
      controlTypeName: control.controlTypeName,
      dataTypeName: control.dataTypeName,
      placeholder: control.placeholder,
      helperText: control.helperText
    };
    return this.http
      .post<ApiResponse<AiValidationSuggestion>>(`${this.base}/ai/suggest-validations`, payload)
      .pipe(map(r => r.data));
  }

  /** Feature 5: NL description → partial report QueryConfig, scoped to tables already chosen. */
  suggestReportQuery(payload: {
    prompt: string;
    primaryTable: string;
    joins: { table: string; alias: string; joinType: string; leftColumn: string; rightColumn: string }[];
    availableColumns: Record<string, string[]>;
  }): Observable<AiReportQuerySuggestion> {
    return this.http
      .post<ApiResponse<AiReportQuerySuggestion>>(`${this.base}/ai/suggest-report-query`, payload)
      .pipe(map(r => r.data));
  }

  /** Feature 6: summarize a dashboard's current widget data. */
  summarizeDashboard(payload: {
    dashboardName: string;
    widgets: { title: string; widgetType: string; data: any }[];
  }): Observable<AiDashboardSummary> {
    return this.http
      .post<ApiResponse<AiDashboardSummary>>(`${this.base}/ai/summarize-dashboard`, payload)
      .pipe(map(r => r.data));
  }

  /** Feature 7: cross-cutting assistant — one message in, one reply (+ optional action) out. */
  assistant(message: string, history: AiAssistantHistoryItem[]): Observable<AiAssistantResponse> {
    return this.http
      .post<ApiResponse<AiAssistantResponse>>(`${this.base}/ai/assistant`, { message, history })
      .pipe(map(r => r.data));
  }
}
