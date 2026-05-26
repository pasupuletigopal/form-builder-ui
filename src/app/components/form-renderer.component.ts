// src/app/components/form-renderer.component.ts
// FULL FILE — create at this path

import {
    Component, Input, Output, EventEmitter, OnInit, OnChanges,
    SimpleChanges, inject, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FormDefinition, FormControl as FC } from '../models/form-builder.models';
import { ApiService } from '../services/api.service';
import { environment } from '../../environments/environment';

interface FormRecord {
  id: number;
  formId: number;
  recordData: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  _parsed?: Record<string, any>;
}

type ViewMode = 'list' | 'create' | 'edit' | 'view';

@Component({
  selector: 'app-form-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe],
  host: { 'style': 'display:flex;flex-direction:column;flex:1;overflow:hidden;height:100%' },
  template: `
<div class="fr-shell">

  <!-- Top bar -->
  <div class="fr-topbar">
    <button class="fr-back" (click)="goBack.emit()">← Back to Designer</button>
    <div class="fr-topbar__center">
      <h2>{{ form.title || form.name }}</h2>
      <span class="fr-mode-badge">{{ modeLabel }}</span>
    </div>
    <div class="fr-topbar__actions">
      <button class="fr-btn fr-btn--primary" *ngIf="mode !== 'create'"
        (click)="startCreate()">+ New Record</button>
    </div>
  </div>

  <!-- ===== LIST VIEW ===== -->
  <div class="fr-list" *ngIf="mode === 'list'">

    <!-- Toolbar -->
    <div class="fr-list-toolbar">
      <div class="fr-search">
        <input type="text" placeholder="Search records…"
          [(ngModel)]="searchTerm" (input)="loadRecords()" class="fr-search-input" />
      </div>
      <div class="fr-toolbar-right">
        <span class="fr-count">{{ totalRecords }} record(s)</span>
        <button class="fr-btn fr-btn--outline" (click)="exportData()"
          [disabled]="totalRecords === 0">↓ Export JSON</button>
        <button class="fr-btn fr-btn--danger"
          [disabled]="selectedIds.size === 0"
          (click)="bulkDelete()">
          Delete ({{ selectedIds.size }})
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div class="fr-loading" *ngIf="loading">
      <div class="fr-spinner"></div><span>Loading records…</span>
    </div>

    <!-- Empty state -->
    <div class="fr-empty" *ngIf="!loading && records.length === 0">
      <div class="fr-empty__icon">⊞</div>
      <h3>No records yet</h3>
      <p>Click <strong>+ New Record</strong> to add the first entry.</p>
      <button class="fr-btn fr-btn--primary" (click)="startCreate()">+ New Record</button>
    </div>

    <!-- Data table -->
    <div class="fr-table-wrap" *ngIf="!loading && records.length > 0">
      <table class="fr-table">
        <thead>
          <tr>
            <th class="th-check">
              <input type="checkbox" [checked]="isAllSelected()"
                (change)="toggleSelectAll($event)" />
            </th>
            <th class="th-id">#</th>
            <th *ngFor="let col of tableColumns">{{ col.label }}</th>
            <th class="th-date">Created</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let rec of records, let i = index"
            [class.tr-selected]="selectedIds.has(rec.id)">
            <td>
              <input type="checkbox"
                [checked]="selectedIds.has(rec.id)"
                (change)="toggleSelect(rec.id)" />
            </td>
            <td class="td-id">{{ rec.id }}</td>
            <td *ngFor="let col of tableColumns">
              <span class="cell-val">{{ getCellValue(rec, col.field) }}</span>
            </td>
            <td class="td-date">{{ rec.createdAt | date:'dd MMM yy, HH:mm' }}</td>
            <td class="td-actions">
              <button class="action-btn view-btn" (click)="viewRecord(rec)" title="View">⊡</button>
              <button class="action-btn edit-btn" (click)="editRecord(rec)" title="Edit">✏</button>
              <button class="action-btn del-btn"  (click)="deleteRecord(rec)" title="Delete">⊗</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="fr-pagination" *ngIf="!loading && records.length > 0">
      <div class="fr-pagination__left">
        <label class="fr-page-size-label">Show
          <select class="fr-page-size-select" [(ngModel)]="pageSize" (change)="onPageSizeChange()">
            <option *ngFor="let size of pageSizeOptions" [ngValue]="size">{{ size }}</option>
          </select>
          per page
        </label>
      </div>

      <div class="fr-pagination__center">
        <button class="fr-page-btn" [disabled]="currentPage === 1" (click)="goPage(1)" title="First page">«</button>
        <button class="fr-page-btn" [disabled]="currentPage === 1" (click)="goPage(currentPage - 1)" title="Previous page">‹</button>
        <button *ngFor="let p of visiblePages" class="fr-page-btn"
          [class.fr-page-btn--active]="p === currentPage"
          (click)="goPage(p)">{{ p }}</button>
        <button class="fr-page-btn" [disabled]="currentPage === totalPages" (click)="goPage(currentPage + 1)" title="Next page">›</button>
        <button class="fr-page-btn" [disabled]="currentPage === totalPages" (click)="goPage(totalPages)" title="Last page">»</button>
      </div>

      <div class="fr-pagination__right">
        <span class="fr-page-info">
          {{ (currentPage - 1) * pageSize + 1 }}–{{ currentPage * pageSize < totalRecords ? currentPage * pageSize : totalRecords }}
          of {{ totalRecords }}
        </span>
      </div>
    </div>
  </div>

  <!-- ===== FORM VIEW (Create / Edit / View) ===== -->
  <div class="fr-form-view" *ngIf="mode === 'create' || mode === 'edit' || mode === 'view'">

    <div class="fr-form-container"
      [style.background-color]="form.backgroundColor"
      [style.font-family]="form.fontFamily"
      [style.font-size.px]="form.fontSize"
      [style.border-radius.px]="form.borderRadius"
      [style.padding.px]="form.padding"
      [style.max-width.px]="form.maxWidth">

      <div class="fr-form-header">
        <h3 [style.color]="form.primaryColor">
          {{ mode === 'create' ? 'New ' + (form.title || form.name)
           : mode === 'edit'   ? 'Edit Record #' + currentRecord?.id
           :                     'View Record #' + currentRecord?.id }}
        </h3>
        <button class="fr-form-cancel" (click)="cancelForm()">✕ Cancel</button>
      </div>

      <!-- Error banner -->
      <div class="fr-error-banner" *ngIf="submitError">
        ⚠ {{ submitError }}
      </div>

      <!-- Success banner -->
      <div class="fr-success-banner" *ngIf="submitSuccess">
        ✓ {{ submitSuccess }}
      </div>

      <!-- Dynamic Form -->
      <form [formGroup]="dynamicForm" (ngSubmit)="submitForm()">
        <div class="fr-form-grid">
          <div class="fr-form-row" *ngFor="let row of formRows; trackBy: trackRow">
            <ng-container *ngFor="let ctrl of row; trackBy: trackControl">
            <div class="fr-form-cell"
              [style.grid-column]="'span ' + ctrl.colSpan"
              *ngIf="!ctrl.isHidden">

              <!-- Label -->
              <label class="fr-label"
                [style.color]="ctrl.labelColor"
                *ngIf="showLabel(ctrl)">
                {{ ctrl.label || ctrl.fieldName }}
                <span class="fr-required" *ngIf="ctrl.isRequired">*</span>
              </label>

              <!-- TEXT / EMAIL / PASSWORD / NUMBER -->
              <input
                *ngIf="isInputType(ctrl)"
                [type]="getInputType(ctrl)"
                class="fr-input"
                [formControlName]="ctrl.fieldName"
                [placeholder]="ctrl.placeholder || ''"
                [readOnly]="ctrl.isReadOnly || mode === 'view'"
                [ngStyle]="getInputStyle(ctrl)"
                [class.fr-input--error]="isFieldError(ctrl.fieldName)"
              />

              <!-- TEXTAREA -->
              <textarea
                *ngIf="ctrl.controlTypeName === 'MultiTextBox'"
                class="fr-input fr-textarea"
                [formControlName]="ctrl.fieldName"
                [placeholder]="ctrl.placeholder || ''"
                [rows]="ctrl.rows || 3"
                [readOnly]="ctrl.isReadOnly || mode === 'view'"
                [ngStyle]="getInputStyle(ctrl)"
                [class.fr-input--error]="isFieldError(ctrl.fieldName)">
              </textarea>

              <!-- DROPDOWN -->
              <select
                *ngIf="ctrl.controlTypeName === 'DropdownList'"
                class="fr-input fr-select"
                [formControlName]="ctrl.fieldName"
                [ngStyle]="getInputStyle(ctrl)"
                [class.fr-input--error]="isFieldError(ctrl.fieldName)">
                <option value="">{{ ctrl.placeholder || '-- Select --' }}</option>
                <option *ngFor="let item of getSourceItems(ctrl)"
                  [value]="item.value">{{ item.label }}</option>
              </select>

              <!-- MULTI SELECT -->
              <select
                *ngIf="ctrl.controlTypeName === 'MultiSelect'"
                class="fr-input fr-select" multiple
                [formControlName]="ctrl.fieldName"
                [ngStyle]="getInputStyle(ctrl)">
                <option *ngFor="let item of getSourceItems(ctrl)"
                  [value]="item.value">{{ item.label }}</option>
              </select>

              <!-- RADIO GROUP -->
              <div class="fr-radio-group"
                *ngIf="ctrl.controlTypeName === 'RadioButton'">
                <label *ngFor="let item of getSourceItems(ctrl)"
                  class="fr-radio-option">
                  <input type="radio"
                    [formControlName]="ctrl.fieldName"
                    [value]="item.value" />
                  <span>{{ item.label }}</span>
                </label>
              </div>

              <!-- CHECKBOX -->
              <label class="fr-checkbox"
                *ngIf="ctrl.controlTypeName === 'Checkbox'">
                <input type="checkbox"
                  [formControlName]="ctrl.fieldName" />
                <span>{{ ctrl.label }}</span>
              </label>

              <!-- CHECKBOX GROUP -->
              <div class="fr-checkbox-group"
                *ngIf="ctrl.controlTypeName === 'CheckboxGroup'">
                <label *ngFor="let item of getSourceItems(ctrl)"
                  class="fr-checkbox-option">
                  <input type="checkbox"
                    [value]="item.value"
                    (change)="onCheckboxGroupChange(ctrl.fieldName, item.value, $event)" />
                  <span>{{ item.label }}</span>
                </label>
              </div>

              <!-- TOGGLE -->
              <label class="fr-toggle" *ngIf="ctrl.controlTypeName === 'ToggleSwitch'">
                <div class="fr-toggle-ctrl">
                  <input type="checkbox"
                    [formControlName]="ctrl.fieldName" />
                  <span class="fr-toggle-track"></span>
                </div>
                <span>{{ ctrl.placeholder || 'Enable' }}</span>
              </label>

              <!-- DATE -->
              <input type="date"
                *ngIf="ctrl.controlTypeName === 'DatePicker'"
                class="fr-input"
                [formControlName]="ctrl.fieldName"
                [readOnly]="ctrl.isReadOnly || mode === 'view'"
                [ngStyle]="getInputStyle(ctrl)"
                [class.fr-input--error]="isFieldError(ctrl.fieldName)" />

              <!-- DATETIME -->
              <input type="datetime-local"
                *ngIf="ctrl.controlTypeName === 'DateTimePicker'"
                class="fr-input"
                [formControlName]="ctrl.fieldName"
                [readOnly]="ctrl.isReadOnly || mode === 'view'"
                [ngStyle]="getInputStyle(ctrl)" />

              <!-- TIME -->
              <input type="time"
                *ngIf="ctrl.controlTypeName === 'TimePicker'"
                class="fr-input"
                [formControlName]="ctrl.fieldName"
                [readOnly]="ctrl.isReadOnly || mode === 'view'"
                [ngStyle]="getInputStyle(ctrl)" />

              <!-- SLIDER -->
              <div class="fr-slider-wrap"
                *ngIf="ctrl.controlTypeName === 'Slider'">
                <input type="range" class="fr-slider"
                  [formControlName]="ctrl.fieldName"
                  [min]="ctrl.minValue || 0"
                  [max]="ctrl.maxValue || 100" />
                <span class="fr-slider-val">
                  {{ dynamicForm.get(ctrl.fieldName)?.value }}
                </span>
              </div>

              <!-- COLOR PICKER -->
              <div class="fr-color-wrap" *ngIf="ctrl.controlTypeName === 'ColorPicker'">
                <input type="color" class="fr-color"
                  [formControlName]="ctrl.fieldName" />
                <input type="text" class="fr-input"
                  [formControlName]="ctrl.fieldName"                  
                  placeholder="#000000" />
              </div>

              <!-- STATIC LABEL -->
              <div class="fr-static-text"
                *ngIf="ctrl.controlTypeName === 'Label'"
                [ngStyle]="getInputStyle(ctrl)">
                {{ ctrl.defaultValue || ctrl.label }}
              </div>

              <!-- HEADING -->
              <h3 class="fr-heading"
                *ngIf="ctrl.controlTypeName === 'Heading'"
                [ngStyle]="getInputStyle(ctrl)">
                {{ ctrl.defaultValue || ctrl.label }}
              </h3>

              <!-- DIVIDER -->
              <hr *ngIf="ctrl.controlTypeName === 'Divider'" class="fr-divider" />

              <!-- BUTTON -->
              <button
                *ngIf="ctrl.controlTypeName === 'Button'"
                [type]="ctrl.buttonType || 'button'"
                class="fr-dyn-btn"
                [class]="'fr-dyn-btn--' + (ctrl.buttonVariant || 'contained')"
                [disabled]="ctrl.isDisabled || mode === 'view'"
                [ngStyle]="getButtonStyle(ctrl)">
                {{ ctrl.label }}
              </button>

              <!-- Validation error -->
              <div class="fr-field-error"
                *ngIf="isFieldError(ctrl.fieldName)">
                {{ getFieldError(ctrl) }}
              </div>

              <!-- Helper text -->
              <div class="fr-helper" *ngIf="ctrl.helperText">
                {{ ctrl.helperText }}
              </div>
            </div>
            </ng-container>
          </div>
        </div>

        <!-- Form Action Buttons -->
        <div class="fr-form-actions" *ngIf="mode !== 'view'">
          <button type="button" class="fr-btn fr-btn--outline"
            (click)="cancelForm()">Cancel</button>
          <button type="button" class="fr-btn fr-btn--outline"
            (click)="resetForm()" *ngIf="mode === 'create'">Reset</button>
          <button type="submit" class="fr-btn fr-btn--primary"
            [disabled]="submitting"
            [style.background-color]="form.primaryColor">
            <span *ngIf="!submitting">
              {{ mode === 'create' ? '✓ Create Record' : '✓ Update Record' }}
            </span>
            <span *ngIf="submitting">Saving…</span>
          </button>
        </div>

        <!-- View mode actions -->
        <div class="fr-form-actions" *ngIf="mode === 'view'">
          <button type="button" class="fr-btn fr-btn--outline"
            (click)="cancelForm()">← Back to List</button>
          <button type="button" class="fr-btn fr-btn--primary"
            (click)="editRecord(currentRecord!)">
            ✏ Edit This Record
          </button>
        </div>
      </form>
    </div>
  </div>

</div>
  `,
  styles: [`
    .fr-shell { display: flex; flex-direction: column; height: 100%; background: #f0f2f5; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

    /* Top bar */
    .fr-topbar {
      display: flex; align-items: center; padding: 0 20px; height: 52px;
      background: #fff; border-bottom: 1px solid #e5e7eb; gap: 12px; flex-shrink: 0;
    }
    .fr-back {
      padding: 6px 12px; border: 1px solid #e5e7eb; background: transparent;
      border-radius: 6px; font-size: 13px; color: #64748b; cursor: pointer;
      font-family: inherit; white-space: nowrap;
      &:hover { background: #f8fafc; color: #0f172a; }
    }
    .fr-topbar__center { flex: 1; display: flex; align-items: center; gap: 10px;
      h2 { font-size: 15px; font-weight: 600; color: #0f172a; }
    }
    .fr-mode-badge { font-size: 11px; background: #f1f5f9; color: #64748b; padding: 2px 10px; border-radius: 99px; font-weight: 600; }
    .fr-topbar__actions { margin-left: auto; }

    /* Buttons */
    .fr-btn {
      padding: 8px 16px; border-radius: 7px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: none; font-family: inherit; transition: .15s;
    }
    .fr-btn--primary { background: #2563eb; color: white; }
    .fr-btn--primary:hover { background: #1d4ed8; }
    .fr-btn--primary:disabled { opacity: .5; cursor: not-allowed; }
    .fr-btn--outline { background: transparent; border: 1px solid #e5e7eb; color: #374151; }
    .fr-btn--outline:hover { background: #f8fafc; }
    .fr-btn--danger { background: transparent; border: 1px solid #fca5a5; color: #dc2626; }
    .fr-btn--danger:hover:not(:disabled) { background: #fef2f2; }
    .fr-btn--danger:disabled { opacity: .4; cursor: not-allowed; }

    /* List view */
    .fr-list { flex: 1; overflow: hidden; padding: 0; display: flex; flex-direction: column; }
    .fr-list-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 16px 24px 12px; flex-shrink: 0; }
    .fr-search-input {
      padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 7px;
      font-size: 13px; font-family: inherit; outline: none; width: 240px;
      &:focus { border-color: #2563eb; }
    }
    .fr-toolbar-right { display: flex; align-items: center; gap: 10px; }
    .fr-count { font-size: 13px; color: #64748b; white-space: nowrap; }

    /* Loading */
    .fr-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px; color: #64748b; }
    .fr-spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Empty state */
    .fr-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 12px; color: #94a3b8; text-align: center;
      .fr-empty__icon { font-size: 48px; }
      h3 { font-size: 18px; font-weight: 600; color: #374151; }
      p { font-size: 14px; strong { color: #0f172a; } }
    }

    /* Table */
    .fr-table-wrap { flex: 1; overflow: auto; border-radius: 10px; border: 1px solid #e5e7eb; background: #fff; margin: 0 24px; min-height: 0; }
    .fr-table {
      width: 100%; border-collapse: collapse;
      th, td { padding: 11px 14px; text-align: left; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
      th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; background: #f8fafc; position: sticky; top: 0; z-index: 1; }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: #f8fafc; }
      .tr-selected td { background: #eff6ff; }
    }
    .th-check, .td-check { width: 36px; }
    .th-id, .td-id { width: 50px; color: #94a3b8; font-size: 12px; }
    .th-date, .td-date { white-space: nowrap; color: #64748b; font-size: 12px; }
    .th-actions, .td-actions { width: 100px; }
    .td-actions { display: flex; gap: 4px; }
    .cell-val { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .action-btn {
      width: 28px; height: 28px; border: 1px solid #e5e7eb; background: #fff;
      border-radius: 5px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;
    }
    .view-btn:hover { background: #eff6ff; color: #2563eb; border-color: #2563eb; }
    .edit-btn:hover { background: #fefce8; color: #ca8a04; border-color: #ca8a04; }
    .del-btn:hover  { background: #fef2f2; color: #dc2626; border-color: #dc2626; }

    /* Pagination */
    .fr-pagination {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 24px; flex-wrap: wrap; flex-shrink: 0;
      border-top: 1px solid #e5e7eb; background: #f8fafc;
    }
    .fr-pagination__left { display: flex; align-items: center; }
    .fr-pagination__center { display: flex; align-items: center; gap: 4px; }
    .fr-pagination__right { display: flex; align-items: center; }

    .fr-page-size-label {
      font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px;
    }
    .fr-page-size-select {
      padding: 5px 8px; border: 1px solid #e5e7eb; border-radius: 6px;
      font-size: 13px; font-family: inherit; color: #0f172a; background: #fff;
      cursor: pointer; outline: none;
      &:focus { border-color: #2563eb; }
    }

    .fr-page-btn {
      min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid #e5e7eb;
      background: #fff; border-radius: 6px; cursor: pointer; font-size: 13px;
      font-family: inherit; color: #374151; display: flex; align-items: center;
      justify-content: center; transition: .15s;
      &:hover:not(:disabled):not(.fr-page-btn--active) { background: #f1f5f9; border-color: #93c5fd; }
      &:disabled { opacity: .35; cursor: not-allowed; }
    }
    .fr-page-btn--active {
      background: #2563eb; color: #fff; border-color: #2563eb; font-weight: 600;
      &:hover { background: #1d4ed8; }
    }

    .fr-page-info {
      font-size: 13px; color: #64748b; white-space: nowrap;
    }

    /* Form view */
    .fr-form-view { flex: 1; overflow-y: auto; padding: 24px; display: flex; justify-content: center; }
    .fr-form-container { width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,.08); background: #fff; }
    .fr-form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
      h3 { font-size: 20px; font-weight: 700; }
    }
    .fr-form-cancel { padding: 5px 12px; border: 1px solid #e5e7eb; background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px; color: #64748b; font-family: inherit;
      &:hover { background: #fef2f2; color: #dc2626; }
    }
    .fr-error-banner { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px 16px; color: #dc2626; font-size: 13px; margin-bottom: 16px; }
    .fr-success-banner { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 16px; color: #16a34a; font-size: 13px; margin-bottom: 16px; }

    .fr-form-grid { display: flex; flex-direction: column; gap: 16px; }
    .fr-form-row { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
    .fr-form-cell { display: flex; flex-direction: column; gap: 5px; }

    .fr-label { font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: .04em; }
    .fr-required { color: #ef4444; margin-left: 2px; }
    .fr-input {
      width: 100%; padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 14px; font-family: inherit; outline: none; color: #0f172a; background: #fff; transition: .15s;
      &:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      &:disabled, &[readonly] { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
    }
    .fr-input--error { border-color: #ef4444; }
    .fr-input--error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,.1); }

    .fr-textarea { resize: vertical; }
    .fr-select { cursor: pointer; }
    .fr-radio-group { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px 0; }
    .fr-radio-option { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; }
    .fr-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
    .fr-checkbox-group { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px 0; }
    .fr-checkbox-option { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; }
    .fr-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 0;
      .fr-toggle-ctrl { position: relative; width: 42px; height: 24px; input { opacity: 0; width: 0; height: 0; } }
      .fr-toggle-track { position: absolute; inset: 0; background: #d1d5db; border-radius: 99px; transition: .2s;
        &::after { content: ''; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
      }
      input:checked ~ .fr-toggle-track { background: #2563eb; &::after { transform: translateX(18px); } }
    }
    .fr-slider-wrap { display: flex; align-items: center; gap: 12px;
      .fr-slider { flex: 1; accent-color: #2563eb; }
      .fr-slider-val { font-size: 13px; font-weight: 600; color: #2563eb; min-width: 40px; text-align: right; }
    }
    .fr-color-wrap { display: flex; gap: 8px; align-items: center;
      .fr-color { width: 42px; height: 38px; padding: 2px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; }
    }
    .fr-static-text { font-size: 14px; color: #374151; padding: 4px 0; }
    .fr-heading { font-size: 20px; font-weight: 700; color: #0f172a; padding: 4px 0 8px; }
    .fr-divider { border: none; border-top: 1px solid #e5e7eb; margin: 8px 0; }
    .fr-dyn-btn { padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: .15s; }
    .fr-dyn-btn--contained { background: #2563eb; color: white; }
    .fr-dyn-btn--contained:hover { background: #1d4ed8; }
    .fr-dyn-btn--outlined { background: transparent; border: 2px solid #2563eb !important; color: #2563eb; }
    .fr-dyn-btn--text { background: transparent; color: #2563eb; }
    .fr-field-error { font-size: 12px; color: #dc2626; }
    .fr-helper { font-size: 12px; color: #94a3b8; }

    /* Form actions */
    .fr-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9; }
  `]
})
export class FormRendererComponent implements OnInit, OnChanges {
  @Input() form!: FormDefinition;
  @Output() goBack = new EventEmitter<void>();

  private api   = inject(ApiService);
  private fb    = inject(FormBuilder);
  private http  = inject(HttpClient);
  private cdr   = inject(ChangeDetectorRef);
  private apiBase = environment.apiBase;

  mode: ViewMode = 'list';
  records: FormRecord[] = [];
  currentRecord?: FormRecord;

  loading   = false;
  submitting = false;
  submitError = '';
  submitSuccess = '';

  totalRecords = 0;
  currentPage  = 1;
  pageSize     = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  get totalPages() { return Math.ceil(this.totalRecords / this.pageSize) || 1; }

  visiblePages: number[] = [];

  searchTerm = '';
  selectedIds = new Set<number>();
  dynamicForm!: FormGroup;

  hasConnector = false;
  connectorPkColumn = 'Id';
  connectorConnectionId?: number;
  externalColumns: string[] = [];

  formRows: FC[][] = [];

  // Runtime-loaded dropdown items for API/Database-type data sources
  private dbSourceItems = new Map<number, { value: string; label: string }[]>();

  get modeLabel() {
    return { list: 'Records', create: 'New Record', edit: 'Edit', view: 'View' }[this.mode];
  }

  get tableColumns(): { field: string; label: string }[] {
    if (this.hasConnector && this.externalColumns.length > 0) {
      return this.externalColumns
        .filter(c => c !== this.connectorPkColumn)
        .slice(0, 5)
        .map(c => ({ field: c, label: c }));
    }
    return (this.form?.controls || [])
      .filter(c => !['Button','Divider','Heading','Label','Spacer','HtmlContent'].includes(c.controlTypeName))
      .slice(0, 5)
      .map(c => ({ field: c.fieldName, label: c.label || c.fieldName }));
  }

    ngOnInit() {
        this.buildForm();
        this.checkConnector();
        this.loadDatabaseSourceItems();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['form'] && changes['form'].currentValue?.id !== changes['form'].previousValue?.id) {
            if (this.mode === 'list') {   // ← only rebuild when not actively editing
                this.buildForm();
            }
        }
    }

  // ---- Form building ----
    
    buildForm() {
        if (!this.form?.controls) return;
        const group: Record<string, any> = {};
        this.form.controls.forEach(ctrl => {
            if (['Button', 'Divider', 'Heading', 'Label', 'Spacer', 'HtmlContent']
                .includes(ctrl.controlTypeName)) return;

            const validators = [];
            if (ctrl.isRequired) validators.push(Validators.required);
            if (ctrl.minLength) validators.push(Validators.minLength(ctrl.minLength));
            if (ctrl.maxLength) validators.push(Validators.maxLength(ctrl.maxLength));
            if (ctrl.pattern) validators.push(Validators.pattern(ctrl.pattern));
            if (ctrl.controlTypeName === 'EmailBox') validators.push(Validators.email);

            group[ctrl.fieldName] = [ctrl.defaultValue ?? '', validators];
        });
        this.dynamicForm = this.fb.group(group);
        this.formRows = this.computeFormRows();
    }

  private computeFormRows(): FC[][] {
    const controls = (this.form?.controls || []).sort((a, b) => a.sortOrder - b.sortOrder);
    const rows = new Map<number, FC[]>();
    controls.forEach(c => {
      if (!rows.has(c.rowIndex)) rows.set(c.rowIndex, []);
      rows.get(c.rowIndex)!.push(c);
    });
    return Array.from(rows.keys()).sort((a, b) => a - b).map(k => rows.get(k)!);
  }

  checkConnector() {
    this.http.get<any>(`${this.apiBase}/api/forms/${this.form.id}/connector`)
      .subscribe({
        next: res => {
          if (res.data) {
            this.hasConnector      = true;
            this.connectorPkColumn = res.data.primaryKeyColumn || 'Id';
            this.connectorConnectionId = res.data.externalConnectionId || undefined;
          }
          this.loadRecords();
        },
        error: () => this.loadRecords()
      });
  }

  // ---- CRUD Operations ----

  private getConnectorHeaders(): Record<string, string> {
    if (this.connectorConnectionId) {
      return { 'X-Connection-Id': String(this.connectorConnectionId) };
    }
    return {};
  }

  loadRecords() {
    this.loading = true;

    const url = this.hasConnector
      ? `${this.apiBase}/api/forms/${this.form.id}/ext-records`
      : `${this.apiBase}/api/forms/${this.form.id}/records`;

    this.http.get<any>(url, {
      headers: this.hasConnector ? this.getConnectorHeaders() : {},
      params: {
        page: this.currentPage,
        pageSize: this.pageSize,
        ...(this.searchTerm ? { search: this.searchTerm } : {})
      }
    }).subscribe({
      next: res => {
        const data = res.data;
        this.totalRecords = data.totalCount;

        if (this.hasConnector) {
          this.externalColumns = data.columns || [];
          this.connectorPkColumn = data.primaryKeyColumn || this.connectorPkColumn;
          this.records = data.items.map((r: Record<string, any>) => ({
            id: r[this.connectorPkColumn],
            formId: this.form.id,
            recordData: JSON.stringify(r),
            status: 'Active',
            createdAt: r['CreatedAt'] || r['created_at'] || new Date().toISOString(),
            updatedAt: r['UpdatedAt'] || r['updated_at'] || new Date().toISOString(),
            _parsed: r
          }));
        } else {
          this.records = data.items.map((r: any) => ({
            ...r,
            _parsed: JSON.parse(r.recordData || '{}')
          }));
        }
        this.loading = false;
        this.updateVisiblePages();
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || '';
        if (this.hasConnector && msg.includes('X-Connection-Id')) {
          this.submitError = 'External connection not linked. Please go to the Connector tab, re-enter credentials if needed, and click Save Connector.';
        }
      }
    });
  }

  startCreate() {
    this.mode = 'create';
    this.currentRecord = undefined;
    this.buildForm();
    this.submitError = '';
    this.submitSuccess = '';
  }

  viewRecord(rec: FormRecord) {
    this.currentRecord = rec;
    this.mode = 'view';
    this.buildForm();
    const parsed = rec._parsed ?? JSON.parse(rec.recordData || '{}');
    this.dynamicForm.patchValue(this.coerceValuesForForm(parsed));
    this.dynamicForm.disable();
  }

  editRecord(rec: any) {
    this.currentRecord = rec;
    this.mode = 'edit';
    this.submitError = '';
    this.submitSuccess = '';
    this.buildForm();
    const parsed = rec._parsed ?? JSON.parse(rec.recordData || '{}');
    this.dynamicForm.patchValue(this.coerceValuesForForm(parsed));
  }

  submitForm() {
    this.submitError = '';
    if (this.dynamicForm.invalid) {
      this.dynamicForm.markAllAsTouched();
      this.submitError = 'Please fix the validation errors below.';
      return;
    }

    this.submitting = true;

    let obs;
    if (this.hasConnector) {
      const headers = this.getConnectorHeaders();
      if (this.mode === 'create') {
        obs = this.http.post<any>(
          `${this.apiBase}/api/forms/${this.form.id}/ext-records`,
          this.dynamicForm.value,
          { headers }
        );
      } else {
        const pk = this.currentRecord?._parsed?.[this.connectorPkColumn]
          ?? this.currentRecord?.id;
        obs = this.http.put<any>(
          `${this.apiBase}/api/forms/${this.form.id}/ext-records/${pk}`,
          this.dynamicForm.value,
          { headers }
        );
      }
    } else {
      const data = JSON.stringify(this.dynamicForm.value);
      if (this.mode === 'create') {
        obs = this.http.post<any>(
          `${this.apiBase}/api/forms/${this.form.id}/records`,
          { formId: this.form.id, recordData: data }
        );
      } else {
        obs = this.http.put<any>(
          `${this.apiBase}/api/forms/${this.form.id}/records/${this.currentRecord!.id}`,
          { recordData: data }
        );
      }
    }

    obs.subscribe({
      next: () => {
        this.submitting = false;
        this.submitSuccess = this.mode === 'create'
          ? 'Record created successfully!' : 'Record updated successfully!';
        setTimeout(() => {
          this.mode = 'list';
          this.loadRecords();
          this.submitSuccess = '';
        }, 1200);
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err?.error?.message || 'Failed to save. Please try again.';
      }
    });
  }

  deleteRecord(rec: any) {
    if (!confirm(`Delete this record?`)) return;
    const pk = this.hasConnector
      ? (rec._parsed?.[this.connectorPkColumn] ?? rec.id)
      : rec.id;

    const url = this.hasConnector
      ? `${this.apiBase}/api/forms/${this.form.id}/ext-records/${pk}`
      : `${this.apiBase}/api/forms/${this.form.id}/records/${rec.id}`;

    this.http.delete<any>(url, {
      headers: this.hasConnector ? this.getConnectorHeaders() : {}
    }).subscribe({ next: () => this.loadRecords() });
  }

  bulkDelete() {
    if (!confirm(`Delete ${this.selectedIds.size} selected records?`)) return;
    const ids = Array.from(this.selectedIds);

    const url = this.hasConnector
      ? `${this.apiBase}/api/forms/${this.form.id}/ext-records/bulk`
      : `${this.apiBase}/api/forms/${this.form.id}/records/bulk`;

    this.http.delete<any>(url, {
      body: ids,
      headers: this.hasConnector ? this.getConnectorHeaders() : {}
    }).subscribe({ next: () => { this.selectedIds.clear(); this.loadRecords(); } });
  }

  exportData() {
    const url = this.hasConnector
      ? `${this.apiBase}/api/forms/${this.form.id}/ext-records/export`
      : `${this.apiBase}/api/forms/${this.form.id}/records/export`;

    this.http.get<any>(url, {
      headers: this.hasConnector ? this.getConnectorHeaders() : {}
    }).subscribe(res => {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.form.name}_records.json`;
        a.click();
      });
  }

  cancelForm() {
    this.mode = 'list';
    this.dynamicForm.enable();
    this.submitError = '';
    this.submitSuccess = '';
  }

  resetForm() { this.dynamicForm.reset(); }

  goPage(page: number) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.selectedIds.clear();
    this.loadRecords();
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.selectedIds.clear();
    this.loadRecords();
  }

  // ---- Selection ----
  toggleSelect(id: number) {
    this.selectedIds.has(id) ? this.selectedIds.delete(id) : this.selectedIds.add(id);
  }
  isAllSelected() {
    return this.records.length > 0 && this.records.every(r => this.selectedIds.has(r.id));
  }
  toggleSelectAll(e: Event) {
    if ((e.target as HTMLInputElement).checked) this.records.forEach(r => this.selectedIds.add(r.id));
    else this.selectedIds.clear();
  }

  // ---- Helpers ----
  getCellValue(rec: FormRecord, field: string): string {
    const val = rec._parsed?.[field];
    if (val === undefined || val === null) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  }

  trackRow(index: number, row: FC[]): number {
    return row.length > 0 ? row[0].rowIndex : index;
  }

  trackControl(index: number, ctrl: FC): string {
    return ctrl.fieldName;
  }

  getSourceItems(ctrl: FC): { value: string; label: string }[] {
    // If this control has a dataSourceId with runtime-loaded items (API or Database), use those
    if (ctrl.dataSourceId && this.dbSourceItems.has(ctrl.dataSourceId)) {
      return this.dbSourceItems.get(ctrl.dataSourceId)!;
    }
    return ctrl.dataSourceItems || [];
  }

  /**
   * For controls whose data source is of type 'API' or 'Database',
   * fetch the resolved items at runtime via the datasource items endpoint.
   */
  private loadDatabaseSourceItems() {
    if (!this.form?.controls) return;

    const selectTypes = ['DropdownList', 'MultiSelect', 'RadioButton', 'CheckboxGroup'];
    const dsIds = new Set<number>();

    this.form.controls.forEach(ctrl => {
      if (selectTypes.includes(ctrl.controlTypeName) && ctrl.dataSourceId
          && (!ctrl.dataSourceItems || ctrl.dataSourceItems.length === 0)) {
        dsIds.add(ctrl.dataSourceId);
      }
    });

    dsIds.forEach(dsId => {
      this.http.get<any>(`${this.apiBase}/api/datasources/${dsId}/items`).subscribe({
        next: res => {
          const rows = res.data || res || [];
          const items = (Array.isArray(rows) ? rows : []).map((r: any) => ({
            value: String(r.value ?? r.Value ?? ''),
            label: String(r.label ?? r.Label ?? r.text ?? r.Text ?? '')
          }));
          if (items.length > 0) {
            this.dbSourceItems.set(dsId, items);
            this.cdr.detectChanges();
          }
        },
        error: () => {}
      });
    });
  }

  /**
   * Coerce values from the database to match form control types.
   * HTML <select> [value] and <input type="radio"> [value] are always strings,
   * so numeric DB values must be matched against option values.
   * Handles bit/boolean → YesNo mapping (1/0, true/false → option values).
   */
  private coerceValuesForForm(data: Record<string, any>): Record<string, any> {
    if (!data || !this.form?.controls) return data;

    const selectTypes = new Set(['DropdownList', 'RadioButton', 'MultiSelect']);
    const result: Record<string, any> = { ...data };

    this.form.controls.forEach(ctrl => {
      const val = result[ctrl.fieldName];
      if (val === undefined || val === null) return;

      if (selectTypes.has(ctrl.controlTypeName)) {
        const items = ctrl.dataSourceItems || [];

        if (ctrl.controlTypeName === 'MultiSelect' && Array.isArray(val)) {
          result[ctrl.fieldName] = val.map((v: any) => this.matchOptionValue(v, items));
        } else if (!Array.isArray(val)) {
          result[ctrl.fieldName] = this.matchOptionValue(val, items);
        }
      }
    });

    return result;
  }

  /**
   * Match a DB value to the closest option value string.
   * Handles: number 1/0, boolean true/false, string "true"/"false" etc.
   */
  private matchOptionValue(val: any, items: { value: string }[]): string {
    const strVal = String(val);

    // Direct match
    if (items.some(i => i.value === strVal)) return strVal;

    // Boolean/bit coercion: DB sends 1/0 or true/false
    const isTruthy = val === true || val === 1 || strVal === '1' || strVal.toLowerCase() === 'true';
    const isFalsy  = val === false || val === 0 || strVal === '0' || strVal.toLowerCase() === 'false';

    if (isTruthy || isFalsy) {
      const truthyValues = ['true', 'yes', '1', 'True', 'Yes'];
      const falsyValues  = ['false', 'no', '0', 'False', 'No'];
      const candidates = isTruthy ? truthyValues : falsyValues;

      for (const candidate of candidates) {
        const match = items.find(i => i.value === candidate || i.value.toLowerCase() === candidate.toLowerCase());
        if (match) return match.value;
      }
    }

    // Case-insensitive match
    const ciMatch = items.find(i => i.value.toLowerCase() === strVal.toLowerCase());
    if (ciMatch) return ciMatch.value;

    return strVal;
  }

  isInputType(ctrl: FC): boolean {
    return ['TextBox','EmailBox','PasswordBox','NumberBox'].includes(ctrl.controlTypeName);
  }

  getInputType(ctrl: FC): string {
    if (ctrl.controlTypeName === 'EmailBox')    return 'email';
    if (ctrl.controlTypeName === 'PasswordBox') return 'password';
    if (ctrl.controlTypeName === 'NumberBox')   return 'number';
    return 'text';
  }

  showLabel(ctrl: FC): boolean {
    return !['Checkbox','Divider','Spacer','Label','Button','LinkButton','IconButton'].includes(ctrl.controlTypeName);
  }

  isFieldError(fieldName: string): boolean {
    const ctrl = this.dynamicForm?.get(fieldName);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  getFieldError(ctrl: FC): string {
    const fc: AbstractControl | null = this.dynamicForm?.get(ctrl.fieldName);
    if (!fc?.errors) return '';
    if (fc.errors['required'])  return `${ctrl.label || ctrl.fieldName} is required`;
    if (fc.errors['email'])     return 'Please enter a valid email address';
    if (fc.errors['minlength']) return `Minimum ${ctrl.minLength} characters required`;
    if (fc.errors['maxlength']) return `Maximum ${ctrl.maxLength} characters allowed`;
    if (fc.errors['pattern'])   return `Invalid format`;
    return 'Invalid value';
  }

  onCheckboxGroupChange(fieldName: string, value: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const current: string[] = this.dynamicForm.get(fieldName)?.value || [];
    const updated = checked ? [...current, value] : current.filter((v: string) => v !== value);
    this.dynamicForm.get(fieldName)?.setValue(updated);
  }

  getInputStyle(ctrl: FC): Record<string, string> {
    return {
      ...(ctrl.fontFamily    ? { fontFamily: ctrl.fontFamily }               : {}),
      ...(ctrl.fontSize      ? { fontSize: `${ctrl.fontSize}px` }            : {}),
      ...(ctrl.fontWeight    ? { fontWeight: ctrl.fontWeight }               : {}),
      ...(ctrl.textColor     ? { color: ctrl.textColor }                     : {}),
      ...(ctrl.backgroundColor ? { backgroundColor: ctrl.backgroundColor }  : {}),
      ...(ctrl.borderColor   ? { borderColor: ctrl.borderColor }             : {}),
      ...(ctrl.borderRadius  ? { borderRadius: `${ctrl.borderRadius}px` }   : {}),
    };
  }

  getButtonStyle(ctrl: FC): Record<string, string> {
    if (ctrl.controlColor && ctrl.buttonVariant === 'contained')
      return { backgroundColor: ctrl.controlColor, color: ctrl.textColor || '#fff' };
    if (ctrl.controlColor && ctrl.buttonVariant === 'outlined')
      return { borderColor: ctrl.controlColor, color: ctrl.controlColor };
    return {};
  }

  private updateVisiblePages() {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = this.currentPage - half;
    let end = this.currentPage + half;

    if (start < 1) {
      start = 1;
      end = Math.min(maxVisible, this.totalPages);
    }
    if (end > this.totalPages) {
      end = this.totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }

    this.visiblePages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
}
