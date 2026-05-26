// src/app/components/data-source-editor.component.ts
// FULL FILE — replace or create at this path

import {
  Component, OnInit, Input, Output, EventEmitter, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../services/api.service';
import { DataSource, DataSourceItem } from '../models/form-builder.models';
import { environment } from '../../environments/environment';

type EditorItem = DataSourceItem & { _uid: string };

interface SavedConnection {
  id: number;
  name: string;
  serverName: string;
  authType: string;
}

@Component({
  selector: 'app-data-source-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="dse-overlay" (click)="onOverlayClick($event)">
  <div class="dse-modal">

    <!-- Header -->
    <div class="dse-header">
      <div class="dse-header__left">
        <span class="dse-icon">⊟</span>
        <div>
          <h2>{{ isEdit ? 'Edit Data Source' : 'New Data Source' }}</h2>
          <p>{{ isEdit ? 'Update items and settings' : 'Create a reusable list for dropdowns and radio buttons' }}</p>
        </div>
      </div>
      <button class="dse-close" (click)="cancel()">✕</button>
    </div>

    <!-- Tabs -->
    <div class="dse-tabs">
      <button [class.active]="tab === 'general'" (click)="tab='general'">General</button>
      <button [class.active]="tab === 'items'" (click)="tab='items'"
        *ngIf="form.sourceType === 'Static'">
        Items <span class="dse-count">{{ form.items.length }}</span>
      </button>
      <button [class.active]="tab === 'api'" (click)="tab='api'"
        *ngIf="form.sourceType === 'API'">API Config</button>
      <button [class.active]="tab === 'database'" (click)="tab='database'"
        *ngIf="form.sourceType === 'Database'">Database Config</button>
      <button [class.active]="tab === 'preview'" (click)="tab='preview'; previewDbItems()"
        *ngIf="form.sourceType === 'Database'">Preview Data</button>
    </div>

    <!-- Body -->
    <div class="dse-body">

      <!-- GENERAL TAB -->
      <div *ngIf="tab === 'general'" class="dse-tab-content">
        <div class="dse-form-group">
          <label>Source Name <span class="required">*</span></label>
          <input type="text" [(ngModel)]="form.name"
            placeholder="e.g. Countries, Status, Priority"
            [class.error]="submitted && !form.name" />
          <span class="err-msg" *ngIf="submitted && !form.name">Name is required</span>
        </div>

        <div class="dse-form-group">
          <label>Description</label>
          <input type="text" [(ngModel)]="form.description"
            placeholder="What is this list used for?" />
        </div>

        <div class="dse-form-group">
          <label>Source Type</label>
          <div class="dse-type-cards">
            <div class="dse-type-card"
              [class.selected]="form.sourceType === 'Static'"
              (click)="form.sourceType = 'Static'">
              <span class="tc-icon">⊞</span>
              <span class="tc-name">Static</span>
              <span class="tc-desc">Fixed list managed here</span>
            </div>
            <div class="dse-type-card"
              [class.selected]="form.sourceType === 'API'"
              (click)="form.sourceType = 'API'">
              <span class="tc-icon">⊡</span>
              <span class="tc-name">API</span>
              <span class="tc-desc">Fetch from REST endpoint</span>
            </div>
            <div class="dse-type-card"
              [class.selected]="form.sourceType === 'Database'"
              (click)="form.sourceType = 'Database'; tab = 'database'">
              <span class="tc-icon">⊟</span>
              <span class="tc-name">Database</span>
              <span class="tc-desc">Load from external DB table</span>
            </div>
          </div>
        </div>

        <div class="dse-form-row" *ngIf="form.sourceType !== 'Database'">
          <div class="dse-form-group half">
            <label>Value Field</label>
            <input type="text" [(ngModel)]="form.valueField"
              placeholder="value" />
            <span class="field-hint">JSON key used as option value</span>
          </div>
          <div class="dse-form-group half">
            <label>Label Field</label>
            <input type="text" [(ngModel)]="form.labelField"
              placeholder="label" />
            <span class="field-hint">JSON key used as display text</span>
          </div>
        </div>
      </div>

      <!-- ITEMS TAB -->
      <div *ngIf="tab === 'items'" class="dse-tab-content">

        <!-- Toolbar -->
        <div class="items-toolbar">
          <div class="items-search">
            <input type="text" placeholder="Filter items…"
              [(ngModel)]="itemSearch" class="items-search-input" />
          </div>
          <div class="items-actions">
            <button class="btn-sm" (click)="addItem()">+ Add Item</button>
            <button class="btn-sm btn-sm--outline" (click)="importCsv()"
              title="Paste comma-separated values">Import CSV</button>
            <button class="btn-sm btn-sm--danger"
              [disabled]="selectedItems.size === 0"
              (click)="deleteSelected()">
              Delete ({{ selectedItems.size }})
            </button>
          </div>
        </div>

        <!-- CSV Import area (toggled) -->
        <div class="csv-import" *ngIf="showCsvImport">
          <textarea rows="4" [(ngModel)]="csvText"
            placeholder="Paste CSV — one per line: value,label&#10;IN,India&#10;US,United States"></textarea>
          <div class="csv-actions">
            <button class="btn-sm" (click)="processCsv()">Import</button>
            <button class="btn-sm btn-sm--outline" (click)="showCsvImport=false">Cancel</button>
          </div>
        </div>

        <!-- Header row -->
        <div class="items-grid-header">
          <label class="items-check">
            <input type="checkbox" [checked]="isAllSelected()"
              (change)="toggleSelectAll($event)" />
          </label>
          <span>Value</span>
          <span>Label</span>
          <span>Default</span>
          <span>Order</span>
          <span>Actions</span>
        </div>

        <!-- Items -->
        <div class="items-grid-body">
          <div class="items-row"
            *ngFor="let item of filteredItems(); let i = index"
            [class.row-selected]="selectedItems.has(item._uid)"
            [class.row-default]="item.isDefault">

            <label class="items-check">
              <input type="checkbox"
                [checked]="selectedItems.has(item._uid)"
                (change)="toggleSelect(item._uid)" />
            </label>

            <input type="text" class="items-cell-input"
              [(ngModel)]="item.value"
              placeholder="value" />

            <input type="text" class="items-cell-input"
              [(ngModel)]="item.label"
              placeholder="Display label" />

            <div class="items-cell-center">
              <label class="toggle-sm">
                <input type="radio" [name]="'default_' + form.name"
                  [value]="true"
                  [checked]="item.isDefault"
                  (change)="setDefault(item)" />
                <span class="toggle-sm-track"></span>
              </label>
            </div>

            <div class="items-cell-order">
              <button class="order-btn" (click)="moveItem(i, -1)"
                [disabled]="i === 0">↑</button>
              <span class="order-num">{{ i + 1 }}</span>
              <button class="order-btn" (click)="moveItem(i, 1)"
                [disabled]="i === filteredItems().length - 1">↓</button>
            </div>

            <div class="items-cell-actions">
              <button class="icon-action danger"
                (click)="removeItem(item._uid)">⊗</button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div class="items-empty" *ngIf="form.items.length === 0">
          <p>No items yet. Click <strong>+ Add Item</strong> or <strong>Import CSV</strong>.</p>
        </div>

        <!-- Summary -->
        <div class="items-footer" *ngIf="form.items.length > 0">
          <span>{{ form.items.length }} item(s) total</span>
          <span *ngIf="defaultItem()">
            Default: <strong>{{ defaultItem()?.label }}</strong>
          </span>
        </div>
      </div>

      <!-- API CONFIG TAB -->
      <div *ngIf="tab === 'api'" class="dse-tab-content">
        <div class="dse-form-group">
          <label>API Endpoint URL <span class="required">*</span></label>
          <input type="text" [(ngModel)]="form.apiUrl"
            placeholder="https://api.example.com/countries" />
        </div>
        <div class="dse-form-group">
          <label>HTTP Method</label>
          <select [(ngModel)]="form.apiMethod">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>
        <div class="dse-form-group">
          <label>API Headers (JSON)</label>
          <textarea rows="3" [(ngModel)]="form.apiHeaders"
            placeholder='{"Authorization": "Bearer your-token-here"}'
            style="font-family:monospace;font-size:12px"></textarea>
          <span class="field-hint">Optional — JSON object of headers to send with the request (e.g. Bearer token, API key)</span>
        </div>
        <div class="api-note">
          <span class="note-icon">ℹ</span>
          The API response should return an array of objects.
          Set the <strong>Value Field</strong> and <strong>Label Field</strong>
          in the General tab to map your JSON keys.
        </div>
      </div>

      <!-- DATABASE CONFIG TAB -->
      <div *ngIf="tab === 'database'" class="dse-tab-content">

        <!-- Connection -->
        <div class="dse-form-group">
          <label>External Connection <span class="required">*</span></label>
          <select [(ngModel)]="form.externalConnectionId" (change)="onConnectionChange()">
            <option [ngValue]="undefined">-- Select a saved connection --</option>
            <option *ngFor="let conn of savedConnections" [ngValue]="conn.id">
              {{ conn.name }} ({{ conn.serverName }})
            </option>
          </select>
          <span class="field-hint">Choose a saved connection from Connection Manager</span>
        </div>

        <!-- Database -->
        <div class="dse-form-group" *ngIf="form.externalConnectionId">
          <label>Database</label>
          <div class="dse-input-row">
            <input type="text" [(ngModel)]="form.databaseName"
              placeholder="e.g. AppDB" />
            <button class="dse-browse-btn" (click)="loadDatabases()"
              [disabled]="loadingDbs">{{ loadingDbs ? '…' : '⊞' }}</button>
          </div>
          <div class="dse-dropdown" *ngIf="dbList.length > 0 && showDbDropdown">
            <div class="dse-dropdown-item" *ngFor="let db of dbList"
              (click)="selectDb(db)">{{ db }}</div>
          </div>
        </div>

        <!-- Table -->
        <div class="dse-form-group" *ngIf="form.databaseName">
          <label>Table <span class="required">*</span></label>
          <div class="dse-input-row">
            <input type="text" [(ngModel)]="form.tableName"
              placeholder="e.g. Languages" />
            <button class="dse-browse-btn" (click)="loadTables()"
              [disabled]="loadingTables">{{ loadingTables ? '…' : '⊞' }}</button>
          </div>
          <div class="dse-dropdown" *ngIf="tableList.length > 0 && showTableDropdown">
            <div class="dse-dropdown-item" *ngFor="let t of tableList"
              (click)="selectTable(t)">{{ t }}</div>
          </div>
        </div>

        <!-- Schema -->
        <div class="dse-form-group" *ngIf="form.databaseName">
          <label>Schema</label>
          <input type="text" [(ngModel)]="form.schemaName" placeholder="dbo" />
        </div>

        <!-- Value & Label Columns -->
        <div class="dse-form-row" *ngIf="form.tableName">
          <div class="dse-form-group half">
            <label>Value Column <span class="required">*</span></label>
            <div class="dse-input-row">
              <input type="text" [(ngModel)]="form.valueColumn"
                placeholder="e.g. Id" />
              <button class="dse-browse-btn" (click)="loadColumns()"
                [disabled]="loadingCols">{{ loadingCols ? '…' : '⊞' }}</button>
            </div>
            <div class="dse-dropdown" *ngIf="columnList.length > 0 && showColDropdown === 'value'">
              <div class="dse-dropdown-item" *ngFor="let c of columnList"
                (click)="selectValueColumn(c)">{{ c }}</div>
            </div>
            <span class="field-hint">Column used as the option value (stored in DB)</span>
          </div>
          <div class="dse-form-group half">
            <label>Label Column <span class="required">*</span></label>
            <div class="dse-input-row">
              <input type="text" [(ngModel)]="form.labelColumn"
                placeholder="e.g. Name" />
              <button class="dse-browse-btn" (click)="loadColumnsForLabel()"
                [disabled]="loadingCols">{{ loadingCols ? '…' : '⊞' }}</button>
            </div>
            <div class="dse-dropdown" *ngIf="columnList.length > 0 && showColDropdown === 'label'">
              <div class="dse-dropdown-item" *ngFor="let c of columnList"
                (click)="selectLabelColumn(c)">{{ c }}</div>
            </div>
            <span class="field-hint">Column used as the display text</span>
          </div>
        </div>

        <!-- Filter & Order -->
        <div class="dse-form-group" *ngIf="form.tableName">
          <label>Filter (SQL WHERE)</label>
          <input type="text" [(ngModel)]="form.filterExpression"
            placeholder="e.g. IsActive = 1" />
          <span class="field-hint">Optional WHERE clause to filter rows</span>
        </div>
        <div class="dse-form-group" *ngIf="form.tableName">
          <label>Order By</label>
          <input type="text" [(ngModel)]="form.orderByExpression"
            placeholder="e.g. Name ASC" />
        </div>

        <div class="api-note" *ngIf="form.tableName && form.valueColumn && form.labelColumn">
          <span class="note-icon">✓</span>
          At runtime, the dropdown will query:
          <code>SELECT [{{ form.valueColumn }}], [{{ form.labelColumn }}] FROM [{{ form.databaseName }}].[{{ form.schemaName || 'dbo' }}].[{{ form.tableName }}]{{ form.filterExpression ? ' WHERE ' + form.filterExpression : '' }}{{ form.orderByExpression ? ' ORDER BY ' + form.orderByExpression : '' }}</code>
        </div>
      </div>

      <!-- PREVIEW DATA TAB -->
      <div *ngIf="tab === 'preview'" class="dse-tab-content">
        <div class="api-note" *ngIf="dbPreviewLoading">
          <span class="note-icon">⟳</span> Loading preview data…
        </div>
        <div class="api-note" *ngIf="dbPreviewError">
          <span class="note-icon">✗</span> {{ dbPreviewError }}
        </div>
        <div *ngIf="dbPreviewItems.length > 0 && !dbPreviewLoading">
          <div class="items-grid-header">
            <span>Value</span>
            <span>Label</span>
          </div>
          <div class="items-grid-body" style="max-height:300px;overflow-y:auto">
            <div class="items-row" *ngFor="let item of dbPreviewItems">
              <span class="items-cell-input" style="border:none;background:transparent">{{ item.value }}</span>
              <span class="items-cell-input" style="border:none;background:transparent">{{ item.label }}</span>
            </div>
          </div>
          <div class="items-footer">
            <span>{{ dbPreviewItems.length }} item(s) returned</span>
          </div>
        </div>
        <div class="items-empty" *ngIf="dbPreviewItems.length === 0 && !dbPreviewLoading && !dbPreviewError">
          <p>Click <strong>Preview Data</strong> tab to load items from the external table.</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="dse-footer">
      <div class="dse-footer__left">
        <span class="save-status" *ngIf="saveStatus">{{ saveStatus }}</span>
      </div>
      <div class="dse-footer__right">
        <button class="btn-cancel" (click)="cancel()">Cancel</button>
        <button class="btn-save" (click)="save()" [disabled]="saving">
          <span *ngIf="!saving">{{ isEdit ? '✓ Update' : '✓ Create' }}</span>
          <span *ngIf="saving">Saving…</span>
        </button>
      </div>
    </div>

  </div>
</div>
  `,
  styles: [`
    .dse-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; padding: 16px;
      backdrop-filter: blur(4px);
    }
    .dse-modal {
      background: #fff; border-radius: 16px;
      width: 100%; max-width: 700px;
      max-height: 90vh; display: flex; flex-direction: column;
      box-shadow: 0 24px 48px rgba(0,0,0,.2);
      animation: slideUp .22s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes slideUp {
      from { opacity:0; transform: scale(.94) translateY(20px); }
      to   { opacity:1; transform: none; }
    }
    /* Header */
    .dse-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 22px 24px 16px; border-bottom: 1px solid #e5e7eb;
    }
    .dse-header__left { display: flex; gap: 14px; align-items: flex-start; }
    .dse-icon { font-size: 28px; color: #2563eb; line-height: 1; }
    .dse-header h2 { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0; }
    .dse-header p  { font-size: 13px; color: #64748b; margin: 3px 0 0; }
    .dse-close {
      width: 30px; height: 30px; border: none; background: #f1f5f9;
      border-radius: 50%; cursor: pointer; font-size: 14px; color: #64748b;
      &:hover { background: #fef2f2; color: #ef4444; }
    }
    /* Tabs */
    .dse-tabs {
      display: flex; padding: 0 24px;
      border-bottom: 1px solid #e5e7eb; background: #f8fafc;
      button {
        padding: 10px 16px; border: none; background: transparent;
        font-size: 13px; font-weight: 500; color: #64748b; cursor: pointer;
        border-bottom: 2px solid transparent; transition: .15s;
        font-family: inherit; display: flex; align-items: center; gap: 6px;
        &.active { color: #2563eb; border-bottom-color: #2563eb; }
        &:hover:not(.active) { color: #0f172a; }
      }
    }
    .dse-count {
      background: #dbeafe; color: #1d4ed8;
      font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 99px;
    }
    /* Body */
    .dse-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .dse-tab-content { display: flex; flex-direction: column; gap: 16px; }
    .dse-form-group {
      display: flex; flex-direction: column; gap: 5px;
      label { font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: .04em; }
      input, select, textarea {
        padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
        font-size: 14px; font-family: inherit; outline: none; color: #0f172a;
        transition: .15s;
        &:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
        &.error { border-color: #ef4444; }
      }
      &.half { flex: 1; }
    }
    .dse-form-row { display: flex; gap: 12px; }
    .required { color: #ef4444; }
    .err-msg { font-size: 12px; color: #ef4444; }
    .field-hint { font-size: 11px; color: #94a3b8; }
    /* Source Type Cards */
    .dse-type-cards { display: flex; gap: 12px; }
    .dse-type-card {
      flex: 1; border: 2px solid #e5e7eb; border-radius: 10px;
      padding: 14px; cursor: pointer; display: flex; flex-direction: column; gap: 3px;
      transition: .15s;
      .tc-icon { font-size: 20px; }
      .tc-name { font-size: 14px; font-weight: 600; color: #0f172a; }
      .tc-desc { font-size: 12px; color: #64748b; }
      &.selected { border-color: #2563eb; background: #eff6ff; .tc-name { color: #1d4ed8; } }
      &:hover:not(.selected) { border-color: #93c5fd; }
    }
    /* Items toolbar */
    .items-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      gap: 10px; flex-wrap: wrap;
    }
    .items-search-input {
      padding: 7px 12px; border: 1px solid #e5e7eb; border-radius: 7px;
      font-size: 13px; font-family: inherit; outline: none; width: 200px;
      &:focus { border-color: #2563eb; }
    }
    .items-actions { display: flex; gap: 8px; }
    .btn-sm {
      padding: 6px 14px; border: none; background: #2563eb; color: white;
      border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;
      font-family: inherit; transition: .15s;
      &:hover { background: #1d4ed8; }
      &:disabled { opacity: .4; cursor: not-allowed; }
      &.btn-sm--outline { background: transparent; border: 1px solid #d1d5db; color: #374151; &:hover { background: #f1f5f9; } }
      &.btn-sm--danger  { background: transparent; border: 1px solid #fca5a5; color: #dc2626; &:hover:not(:disabled) { background: #fef2f2; } }
    }
    /* CSV Import */
    .csv-import {
      background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;
      textarea { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace; font-size: 13px; resize: vertical; outline: none; }
      .csv-actions { display: flex; gap: 8px; margin-top: 8px; }
    }
    /* Items grid */
    .items-grid-header, .items-row {
      display: grid;
      grid-template-columns: 28px 1fr 1.3fr 60px 80px 50px;
      align-items: center; gap: 8px;
      padding: 6px 8px;
    }
    .items-grid-header {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      color: #94a3b8; background: #f8fafc; border-radius: 6px;
    }
    .items-row {
      border-bottom: 1px solid #f1f5f9; transition: .1s;
      &:hover { background: #f8fafc; }
      &.row-selected { background: #eff6ff; }
      &.row-default { border-left: 3px solid #2563eb; }
    }
    .items-check input { cursor: pointer; width: 14px; height: 14px; }
    .items-cell-input {
      width: 100%; padding: 6px 9px; border: 1px solid #e5e7eb; border-radius: 6px;
      font-size: 13px; font-family: inherit; outline: none;
      &:focus { border-color: #2563eb; }
    }
    .items-cell-center { display: flex; justify-content: center; }
    .toggle-sm { position: relative; width: 34px; height: 20px; cursor: pointer;
      input { opacity: 0; width: 0; height: 0; }
      .toggle-sm-track { position: absolute; inset: 0; background: #d1d5db; border-radius: 99px; transition: .2s;
        &::after { content: ''; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; background: white; border-radius: 50%; transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
      }
      input:checked + .toggle-sm-track { background: #2563eb; &::after { transform: translateX(14px); } }
    }
    .items-cell-order { display: flex; align-items: center; gap: 3px; }
    .order-btn {
      width: 20px; height: 20px; border: 1px solid #e5e7eb; background: white;
      border-radius: 4px; cursor: pointer; font-size: 11px; padding: 0;
      &:hover:not(:disabled) { background: #2563eb; color: white; border-color: #2563eb; }
      &:disabled { opacity: .3; cursor: not-allowed; }
    }
    .order-num { font-size: 12px; color: #94a3b8; min-width: 20px; text-align: center; }
    .items-cell-actions { display: flex; gap: 4px; justify-content: center; }
    .icon-action {
      width: 26px; height: 26px; border: none; background: transparent;
      border-radius: 4px; cursor: pointer; font-size: 14px; color: #94a3b8;
      &.danger:hover { background: #fef2f2; color: #dc2626; }
    }
    .items-empty {
      padding: 32px; text-align: center; color: #94a3b8; font-size: 14px;
      strong { color: #374151; }
    }
    .items-footer {
      display: flex; justify-content: space-between; padding: 10px 8px 0;
      font-size: 12px; color: #64748b;
      strong { color: #0f172a; }
    }
    /* API Note */
    .api-note {
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
      padding: 12px 16px; font-size: 13px; color: #1e40af; display: flex; gap: 8px;
      .note-icon { font-size: 16px; flex-shrink: 0; }
      strong { color: #1d4ed8; }
    }
    /* Footer */
    .dse-footer {
      padding: 16px 24px; border-top: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: center;
    }
    .save-status { font-size: 13px; color: #16a34a; font-weight: 500; }
    .dse-footer__right { display: flex; gap: 10px; }
    .btn-cancel {
      padding: 9px 18px; border: 1px solid #e5e7eb; background: white;
      border-radius: 8px; font-size: 13px; font-weight: 500, cursor: pointer;
      font-family: inherit; color: #374151;
      &:hover { background: #f8fafc; }
    }
    .btn-save {
      padding: 9px 22px; border: none; background: #2563eb; color: white;
      border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
      font-family: inherit; transition: .15s;
      &:hover:not(:disabled) { background: #1d4ed8; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    /* DB browse helpers */
    .dse-input-row {
      display: flex; gap: 0; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden;
      &:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      input { flex: 1; padding: 9px 12px; border: none; outline: none; font-size: 14px; font-family: inherit; color: #0f172a; }
    }
    .dse-browse-btn {
      padding: 9px 12px; border: none; border-left: 1px solid #e2e8f0;
      background: #f8fafc; cursor: pointer; font-size: 14px; color: #64748b; transition: .15s;
      &:hover:not(:disabled) { background: #eff6ff; color: #2563eb; }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }
    .dse-dropdown {
      background: white; border: 1px solid #e2e8f0; border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 180px; overflow-y: auto; margin-top: 4px;
    }
    .dse-dropdown-item {
      padding: 8px 14px; font-size: 13px; cursor: pointer; color: #0f172a;
      &:hover { background: #eff6ff; color: #2563eb; }
    }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; word-break: break-all; }
  `]
})
export class DataSourceEditorComponent implements OnInit {
  @Input() dataSource?: DataSource;
  @Output() saved   = new EventEmitter<DataSource>();
  @Output() closed  = new EventEmitter<void>();

  private api = inject(ApiService);
  private http = inject(HttpClient);
  private apiBase = environment.apiBase;

  tab: 'general' | 'items' | 'api' | 'database' | 'preview' = 'general';
  submitted = false;
  saving = false;
  saveStatus = '';
  showCsvImport = false;
  csvText = '';
  itemSearch = '';
  selectedItems = new Set<string>();

  // Database source state
  savedConnections: SavedConnection[] = [];
  dbList: string[] = [];
  tableList: string[] = [];
  columnList: string[] = [];
  showDbDropdown = false;
  showTableDropdown = false;
  showColDropdown: 'value' | 'label' | null = null;
  loadingDbs = false;
  loadingTables = false;
  loadingCols = false;
  dbPreviewItems: { value: string; label: string }[] = [];
  dbPreviewLoading = false;
  dbPreviewError = '';

  get isEdit(): boolean { return !!this.dataSource?.id; }

  form: Omit<DataSource, 'items'> & { items: EditorItem[] } = {
    id: 0, name: '', description: '', sourceType: 'Static',
    apiUrl: '', apiMethod: 'GET', apiHeaders: '',
    valueField: 'value', labelField: 'label',
    isActive: true, items: [],
    externalConnectionId: undefined, databaseName: '', schemaName: 'dbo',
    tableName: '', valueColumn: '', labelColumn: '',
    filterExpression: '', orderByExpression: ''
  };

  previewItems: Array<{ value: string, label: string }> = [];

  ngOnInit() {
    if (this.dataSource) {
      this.form = {
        ...this.dataSource,
        items: this.dataSource.items.map(i => ({ ...i, _uid: this.uid() }))
      };
    }
    this.loadSavedConnections();
  }

  private loadSavedConnections() {
    this.http.get<any>(`${this.apiBase}/api/connections`).subscribe({
      next: res => { this.savedConnections = res.data || []; },
      error: () => {}
    });
  }

  // ---- Items management ----
  filteredItems(): EditorItem[] {
    if (!this.itemSearch) return this.form.items;
    const s = this.itemSearch.toLowerCase();
    return this.form.items.filter(i =>
      i.value.toLowerCase().includes(s) || i.label.toLowerCase().includes(s));
  }

  addItem() {
    const next = this.form.items.length + 1;
    this.form.items.push({
      id: 0,
      value: `option${next}`, label: `Option ${next}`,
      sortOrder: this.form.items.length,
      isDefault: this.form.items.length === 0,
      isActive: true, _uid: this.uid()
    });
  }

  removeItem(uid: string) {
    this.form.items = this.form.items.filter((i): i is EditorItem => i._uid !== uid);
    this.selectedItems.delete(uid);
  }

  setDefault(item: EditorItem) {
    this.form.items.forEach(i => i.isDefault = false);
    item.isDefault = true;
  }

  defaultItem() { return this.form.items.find(i => i.isDefault); }

  moveItem(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this.form.items.length) return;
    [this.form.items[idx], this.form.items[newIdx]] =
      [this.form.items[newIdx], this.form.items[idx]];
    this.form.items.forEach((i, n) => i.sortOrder = n);
  }

  // ---- Selection ----
  toggleSelect(uid: string) {
    this.selectedItems.has(uid) ? this.selectedItems.delete(uid)
                                : this.selectedItems.add(uid);
  }
  isAllSelected() {
    return this.form.items.length > 0 &&
           this.form.items.every(i => this.selectedItems.has(i._uid));
  }
  toggleSelectAll(e: Event) {
    if ((e.target as HTMLInputElement).checked)
      this.form.items.forEach(i => this.selectedItems.add(i._uid));
    else
      this.selectedItems.clear();
  }
  deleteSelected() {
    this.form.items = this.form.items.filter((i): i is EditorItem => !this.selectedItems.has(i._uid));
    this.selectedItems.clear();
  }

  // ---- CSV Import ----
  importCsv() { this.showCsvImport = true; }

  processCsv() {
    const lines = this.csvText.trim().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      const parts = line.split(',');
      const value = parts[0]?.trim();
      const label = parts[1]?.trim() || value;
      if (value) {
        this.form.items.push({
          id: 0,
          value, label,
          sortOrder: this.form.items.length,
          isDefault: false, isActive: true, _uid: this.uid()
        });
      }
    });
    this.csvText = '';
    this.showCsvImport = false;
  }

  // ---- Preview Data ----
  private getDbHeaders(): Record<string, string> {
    if (this.form.externalConnectionId) {
      return { 'X-Connection-Id': String(this.form.externalConnectionId) };
    }
    return {};
  }

  previewDbItems() {
    // If this is a saved data source, use the backend resolved-items endpoint
    if (this.form.id) {
      this.dbPreviewLoading = true;
      this.dbPreviewError = '';
      this.dbPreviewItems = [];

      this.http.get<any>(`${this.apiBase}/api/datasources/${this.form.id}/items`).subscribe({
        next: res => {
          this.dbPreviewLoading = false;
          const rows = res.data || res || [];
          this.dbPreviewItems = (Array.isArray(rows) ? rows : []).map((r: any) => ({
            value: String(r.value ?? r.Value ?? ''),
            label: String(r.label ?? r.Label ?? '')
          }));
          if (this.dbPreviewItems.length === 0) {
            this.dbPreviewError = 'No items returned. Check Database Config settings.';
          }
        },
        error: err => {
          this.dbPreviewLoading = false;
          this.dbPreviewError = err?.error?.message || 'Failed to load preview data.';
        }
      });
      return;
    }

    // For unsaved data sources, validate config is complete
    const missing: string[] = [];
    if (!this.form.externalConnectionId) missing.push('Connection');
    if (!this.form.databaseName) missing.push('Database');
    if (!this.form.tableName) missing.push('Table');
    if (!this.form.valueColumn) missing.push('Value Column');
    if (!this.form.labelColumn) missing.push('Label Column');

    if (missing.length > 0) {
      this.dbPreviewError = `Please save the data source first, or configure ${missing.join(', ')} in the Database Config tab.`;
      return;
    }
    this.dbPreviewError = 'Please save the data source first to preview items.';
  }

  // ---- Database browsing ----

  onConnectionChange() {
    this.form.databaseName = '';
    this.form.tableName = '';
    this.form.valueColumn = '';
    this.form.labelColumn = '';
    this.dbList = [];
    this.tableList = [];
    this.columnList = [];
  }

  loadDatabases() {
    if (!this.form.externalConnectionId) return;
    this.loadingDbs = true;
    this.http.get<any>(`${this.apiBase}/api/external/databases`, {
      headers: this.getDbHeaders()
    }).subscribe({
      next: res => {
        this.loadingDbs = false;
        this.dbList = res.data || [];
        this.showDbDropdown = true;
      },
      error: () => { this.loadingDbs = false; this.dbList = []; }
    });
  }

  selectDb(db: string) {
    this.form.databaseName = db;
    this.showDbDropdown = false;
    this.form.tableName = '';
    this.form.valueColumn = '';
    this.form.labelColumn = '';
    this.tableList = [];
    this.columnList = [];
  }

  loadTables() {
    if (!this.form.databaseName) return;
    this.loadingTables = true;
    this.http.get<any>(
      `${this.apiBase}/api/external/databases/${this.form.databaseName}/tables`,
      { headers: this.getDbHeaders(), params: { schema: this.form.schemaName || 'dbo' } }
    ).subscribe({
      next: res => {
        this.loadingTables = false;
        this.tableList = res.data || [];
        this.showTableDropdown = true;
      },
      error: () => { this.loadingTables = false; }
    });
  }

  selectTable(table: string) {
    this.form.tableName = table;
    this.showTableDropdown = false;
    this.form.valueColumn = '';
    this.form.labelColumn = '';
    this.columnList = [];
  }

  loadColumns() {
    if (!this.form.tableName || !this.form.databaseName) return;
    this.loadingCols = true;
    this.http.get<any>(
      `${this.apiBase}/api/external/databases/${this.form.databaseName}/tables/${this.form.tableName}/columns`,
      { headers: this.getDbHeaders(), params: { schema: this.form.schemaName || 'dbo' } }
    ).subscribe({
      next: res => {
        this.loadingCols = false;
        this.columnList = res.data || [];
        this.showColDropdown = 'value';
      },
      error: () => { this.loadingCols = false; }
    });
  }

  selectValueColumn(col: string) {
    this.form.valueColumn = col;
    this.showColDropdown = null;
  }

  loadColumnsForLabel() {
    if (!this.form.tableName || !this.form.databaseName) return;
    this.loadingCols = true;
    this.http.get<any>(
      `${this.apiBase}/api/external/databases/${this.form.databaseName}/tables/${this.form.tableName}/columns`,
      { headers: this.getDbHeaders(), params: { schema: this.form.schemaName || 'dbo' } }
    ).subscribe({
      next: res => {
        this.loadingCols = false;
        this.columnList = res.data || [];
        this.showColDropdown = 'label';
      },
      error: () => { this.loadingCols = false; }
    });
  }

  selectLabelColumn(col: string) {
    this.form.labelColumn = col;
    this.showColDropdown = null;
  }

  // ---- Save / Cancel ----
  async save() {
    this.submitted = true;
    if (!this.form.name?.trim()) { this.tab = 'general'; return; }

    this.saving = true;
    this.saveStatus = '';

    const payload: Partial<DataSource> = {
      name: this.form.name,
      description: this.form.description,
      sourceType: this.form.sourceType,
      apiUrl: this.form.apiUrl,
      apiMethod: this.form.apiMethod,
      apiHeaders: this.form.sourceType === 'API' ? (this.form.apiHeaders || undefined) : undefined,
      valueField: this.form.valueField || 'value',
      labelField: this.form.labelField || 'label',
      isActive: true,
      items: this.form.sourceType === 'Static' ? this.form.items.map((i, idx) => ({
        id: i.id || 0,
        value: i.value,
        label: i.label,
        sortOrder: idx,
        isDefault: i.isDefault,
        isActive: true
      })) : [],
      externalConnectionId: this.form.sourceType === 'Database' ? this.form.externalConnectionId : undefined,
      databaseName: this.form.sourceType === 'Database' ? this.form.databaseName : undefined,
      schemaName: this.form.sourceType === 'Database' ? (this.form.schemaName || 'dbo') : undefined,
      tableName: this.form.sourceType === 'Database' ? this.form.tableName : undefined,
      valueColumn: this.form.sourceType === 'Database' ? this.form.valueColumn : undefined,
      labelColumn: this.form.sourceType === 'Database' ? this.form.labelColumn : undefined,
      filterExpression: this.form.sourceType === 'Database' ? this.form.filterExpression : undefined,
      orderByExpression: this.form.sourceType === 'Database' ? this.form.orderByExpression : undefined,
    };

    const obs = this.isEdit
      ? this.api.updateDataSource(this.form.id, payload)
      : this.api.createDataSource(payload);

    obs.subscribe({
      next: ds => {
        this.saving = false;
        this.saveStatus = '✓ Saved successfully';
        setTimeout(() => this.saved.emit(ds), 600);
      },
      error: () => {
        this.saving = false;
        this.saveStatus = '✗ Save failed';
      }
    });
  }

  cancel() { this.closed.emit(); }

  onOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('dse-overlay')) this.cancel();
  }

  private uid() { return Math.random().toString(36).slice(2); }
}
