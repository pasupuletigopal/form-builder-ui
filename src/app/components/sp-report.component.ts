// src/app/components/sp-report.component.ts

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface SavedConnection {
  id: number;
  name: string;
  serverName: string;
  authType: 'Windows' | 'SqlServer';
  username?: string;
  description?: string;
  isActive: boolean;
  lastTestOk?: boolean;
}

interface SpOrView {
  name: string;
  schema: string;
  type: 'StoredProcedure' | 'View';
  fullName: string;
}

interface SpParameter {
  name: string;
  dataType: string;
  maxLength: number;
  isOutput: boolean;
  hasDefault: boolean;
  defaultValue?: string;
  // UI canvas state
  value: string;
  controlType: 'text' | 'number' | 'date' | 'datetime' | 'dropdown' | 'checkbox';
  label: string;
  placeholder: string;
  colSpan: number;
  rowIndex: number;
  isRequired: boolean;
  _selected?: boolean;
}

interface ViewFilter {
  column: string;
  operator: 'eq' | 'neq' | 'contains' | 'startswith' | 'gt' | 'lt' | 'gte' | 'lte' | 'isnull' | 'isnotnull';
  value: string;
  dataType: string;
}

interface SavedSpReport {
  id: number;
  name: string;
  description?: string;
  connectionId: number;
  connectionName?: string;
  databaseName: string;
  schemaName: string;
  objectName: string;
  objectType: 'StoredProcedure' | 'View';
  parameterConfig?: string;
  lastRunAt?: string;
  lastRowCount?: number;
}

interface RunResult {
  rows: Record<string, any>[];
  totalCount: number;
  durationMs: number;
  columns: string[];
  generatedSql: string;
}

type ViewMode = 'list' | 'designer';

@Component({
  selector: 'app-sp-report',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  host: { 'style': 'display:flex;flex-direction:column;flex:1;min-height:0' },
  template: `
<div class="sp-shell">

  <!-- ======= LIST VIEW ======= -->
  <div class="sp-list-view" *ngIf="view === 'list'">

    <div class="sp-header">
      <div>
        <h1>Stored Procedures &amp; Views</h1>
        <p>Browse, configure parameters on canvas, and execute stored procedures and views from local or external databases</p>
      </div>
    </div>

    <!-- Saved SP Reports -->
    <div class="sp-saved-section" *ngIf="savedReports.length > 0">
      <div class="sp-section-label">Saved SP Reports</div>
      <div class="sp-saved-cards">
        <div class="sp-saved-card" *ngFor="let sr of savedReports">
          <div class="sp-saved-card__header">
            <div class="sp-saved-card__icon">{{ sr.objectType === 'StoredProcedure' ? '\u2699' : '\uD83D\uDC41' }}</div>
            <div class="sp-saved-card__info">
              <div class="sp-saved-card__name">{{ sr.name }}</div>
              <div class="sp-saved-card__obj">{{ sr.objectName }}</div>
            </div>
            <span class="sp-type-badge"
              [class.badge--sp]="sr.objectType === 'StoredProcedure'"
              [class.badge--view]="sr.objectType === 'View'">
              {{ sr.objectType === 'StoredProcedure' ? 'SP' : 'VIEW' }}
            </span>
          </div>
          <div class="sp-saved-card__meta">
            <span class="sp-chip" *ngIf="sr.lastRowCount !== undefined">{{ sr.lastRowCount | number }} rows</span>
            <span class="sp-chip" *ngIf="sr.lastRunAt">{{ sr.lastRunAt | date:'dd MMM HH:mm' }}</span>
          </div>
          <div class="sp-saved-card__actions">
            <button class="sp-act-btn sp-act-btn--run" (click)="openSavedReport(sr)">
              \u25B6 Run
            </button>
            <button class="sp-act-btn sp-act-btn--del" (click)="deleteSavedReport(sr)">
              \u2297
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Connection & Database selector -->
    <div class="sp-section-label" style="margin-top:8px">Browse Database Objects</div>
    <div class="sp-conn-bar">
      <div class="sp-field">
        <label>Connection</label>
        <select [(ngModel)]="selectedConnectionId" (change)="onConnectionChange()">
          <option [ngValue]="0">-- Select Connection --</option>
          <option *ngFor="let c of connections" [ngValue]="c.id">{{ c.name }} ({{ c.serverName }})</option>
        </select>
      </div>
      <div class="sp-field">
        <label>Database</label>
        <div class="sp-input-row">
          <input type="text" [(ngModel)]="selectedDatabase" placeholder="e.g. MyDatabase" />
          <button class="sp-browse-btn" (click)="browseDatabases()" [disabled]="!selectedConnectionId || loadingDbs">
            {{ loadingDbs ? '\u2026' : '\u229E' }}
          </button>
        </div>
        <div class="sp-dropdown" *ngIf="dbList.length > 0 && showDbList">
          <div *ngFor="let d of dbList" (click)="selectDatabase(d)">{{ d }}</div>
        </div>
      </div>
      <div class="sp-field sp-field--sm">
        <label>Schema</label>
        <input type="text" [(ngModel)]="selectedSchema" placeholder="dbo" />
      </div>
      <div class="sp-field sp-field--action">
        <label>&nbsp;</label>
        <button class="sp-btn sp-btn--primary"
          (click)="loadSpAndViews()"
          [disabled]="!selectedConnectionId || !selectedDatabase || loadingList">
          {{ loadingList ? 'Loading\u2026' : '\u229E Load SPs & Views' }}
        </button>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="sp-filter-bar" *ngIf="spList.length > 0">
      <input type="text" class="sp-search"
        [(ngModel)]="listSearch" placeholder="Search stored procedures & views\u2026" />
      <div class="sp-type-filter">
        <button [class.active]="typeFilter === 'all'" (click)="typeFilter='all'">All ({{ spList.length }})</button>
        <button [class.active]="typeFilter === 'sp'" (click)="typeFilter='sp'">
          Stored Procedures ({{ spCount }})
        </button>
        <button [class.active]="typeFilter === 'view'" (click)="typeFilter='view'">
          Views ({{ viewCount }})
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div class="sp-loading" *ngIf="loadingList">
      <div class="sp-spinner"></div><span>Loading stored procedures & views\u2026</span>
    </div>

    <!-- Empty -->
    <div class="sp-empty" *ngIf="!loadingList && spList.length === 0 && selectedDatabase">
      <div class="sp-empty-icon">\u229E</div>
      <h3>No items found</h3>
      <p>Select a connection and database, then click "Load SPs & Views"</p>
    </div>

    <!-- SP / View Cards -->
    <div class="sp-cards" *ngIf="!loadingList && filteredSpList.length > 0">
      <div class="sp-card" *ngFor="let item of filteredSpList"
        [class.sp-card--sp]="item.type === 'StoredProcedure'"
        [class.sp-card--view]="item.type === 'View'">
        <div class="sp-card__header">
          <div class="sp-card__icon">{{ item.type === 'StoredProcedure' ? '\u2699' : '\uD83D\uDC41' }}</div>
          <div class="sp-card__info">
            <div class="sp-card__name">{{ item.name }}</div>
            <div class="sp-card__schema">[{{ item.schema }}]</div>
          </div>
          <span class="sp-type-badge"
            [class.badge--sp]="item.type === 'StoredProcedure'"
            [class.badge--view]="item.type === 'View'">
            {{ item.type === 'StoredProcedure' ? 'SP' : 'VIEW' }}
          </span>
        </div>
        <div class="sp-card__actions">
          <button class="sp-act-btn sp-act-btn--run" (click)="openDesigner(item)">
            \u25B6 Configure &amp; Run
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ======= DESIGNER VIEW ======= -->
  <div class="sp-designer" *ngIf="view === 'designer'">

    <!-- Top bar -->
    <div class="sp-designer-bar">
      <button class="sp-back-btn" (click)="backToList()">\u2190 Back</button>
      <div class="sp-designer-title">
        <span class="sp-designer-icon">{{ selectedItem!.type === 'StoredProcedure' ? '\u2699' : '\uD83D\uDC41' }}</span>
        <h2>{{ selectedItem!.fullName }}</h2>
        <span class="sp-type-pill"
          [class.pill--sp]="selectedItem!.type === 'StoredProcedure'"
          [class.pill--view]="selectedItem!.type === 'View'">
          {{ selectedItem!.type === 'StoredProcedure' ? 'Stored Procedure' : 'View' }}
        </span>
      </div>
      <div class="sp-bar-spacer"></div>
      <input type="text" class="sp-report-name-input"
        [(ngModel)]="reportName" placeholder="Report name (for saving)" />
      <button class="sp-btn sp-btn--outline sp-btn--sm" (click)="saveSpReport()" [disabled]="savingReport">
        {{ savingReport ? 'Saving\u2026' : '\uD83D\uDCBE Save' }}
      </button>
      <button class="sp-btn sp-btn--outline sp-btn--sm" (click)="copySql()" *ngIf="lastSql">
        {{ '{' }}{{ '}' }} Copy SQL
      </button>
    </div>

    <!-- Designer body -->
    <div class="sp-designer-body">

      <!-- Parameter Canvas Section -->
      <div class="sp-params-section"
        *ngIf="selectedItem!.type === 'StoredProcedure' && parameters.length > 0">

        <!-- Mode toggle -->
        <div class="sp-mode-bar">
          <button [class.active]="paramMode === 'input'" (click)="paramMode='input'">\u270F Input Mode</button>
          <button [class.active]="paramMode === 'design'" (click)="paramMode='design'">\u2B1A Design Mode</button>
        </div>

        <div class="sp-params-panel">
          <!-- Canvas -->
          <div class="sp-canvas-wrap">
            <div class="sp-params-header">
              <h3>Report Parameters</h3>
              <span class="sp-param-count">{{ parameters.length }} parameter(s)</span>
            </div>

            <div class="sp-canvas">
              <div class="sp-canvas-row" *ngFor="let row of getParameterRows(); let ri = index">
                <div class="sp-canvas-cell"
                  *ngFor="let param of row"
                  [style.grid-column]="'span ' + param.colSpan"
                  [class.sp-cell-selected]="paramMode === 'design' && selectedParam === param"
                  (click)="paramMode === 'design' ? selectParam(param) : null"
                  [attr.draggable]="paramMode === 'design'"
                  (dragstart)="paramMode === 'design' ? onParamDragStart($event, param) : null"
                  (dragover)="onParamDragOver($event)"
                  (drop)="paramMode === 'design' ? onParamDrop($event, param) : null">

                  <div class="sp-param-control">
                    <label class="sp-param-label">
                      {{ param.label || param.name }}
                      <span class="sp-param-req" *ngIf="param.isRequired">*</span>
                    </label>

                    <input *ngIf="param.controlType === 'text'"
                      type="text" class="sp-param-input"
                      [(ngModel)]="param.value"
                      [placeholder]="param.placeholder || 'Enter ' + param.name" />

                    <input *ngIf="param.controlType === 'number'"
                      type="number" class="sp-param-input"
                      [(ngModel)]="param.value"
                      [placeholder]="param.placeholder || '0'" />

                    <input *ngIf="param.controlType === 'date'"
                      type="date" class="sp-param-input"
                      [(ngModel)]="param.value" />

                    <input *ngIf="param.controlType === 'datetime'"
                      type="datetime-local" class="sp-param-input"
                      [(ngModel)]="param.value" />

                    <label *ngIf="param.controlType === 'checkbox'" class="sp-checkbox-wrap">
                      <input type="checkbox"
                        [checked]="param.value === '1' || param.value === 'true'"
                        (change)="param.value = $any($event.target).checked ? '1' : '0'" />
                      <span>{{ param.label || param.name }}</span>
                    </label>

                    <div class="sp-param-meta">
                      <span class="sp-param-type">{{ param.dataType }}</span>
                      <span class="sp-param-output" *ngIf="param.isOutput">OUTPUT</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Parameter property editor (design mode only) -->
          <div class="sp-param-props" *ngIf="paramMode === 'design' && selectedParam">
            <div class="sp-props-title">Parameter Settings</div>
            <div class="sp-prop-group">
              <label>Label</label>
              <input type="text" [(ngModel)]="selectedParam.label" />
            </div>
            <div class="sp-prop-group">
              <label>Placeholder</label>
              <input type="text" [(ngModel)]="selectedParam.placeholder" />
            </div>
            <div class="sp-prop-group">
              <label>Control Type</label>
              <select [(ngModel)]="selectedParam.controlType">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="datetime">DateTime</option>
                <option value="checkbox">Checkbox</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>
            <div class="sp-prop-group">
              <label>Column Span (1-12)</label>
              <div class="sp-col-span-picker">
                <button *ngFor="let n of colSpanOptions"
                  [class.picked]="selectedParam.colSpan === n"
                  (click)="selectedParam.colSpan = n">{{ n }}</button>
              </div>
            </div>
            <div class="sp-prop-group">
              <label>Row Index</label>
              <input type="number" [(ngModel)]="selectedParam.rowIndex" min="0" />
            </div>
            <div class="sp-prop-group">
              <label>Required</label>
              <label class="sp-toggle">
                <input type="checkbox" [(ngModel)]="selectedParam.isRequired" />
                <span class="sp-toggle-track"></span>
              </label>
            </div>
            <div class="sp-prop-group">
              <label>Default Value</label>
              <input type="text" [(ngModel)]="selectedParam.value" />
            </div>
          </div>
        </div>
      </div>

      <!-- View filter form -->
      <div class="sp-view-filters" *ngIf="selectedItem!.type === 'View'">
        <div class="sp-view-filters__header">
          <div class="sp-view-filters__title">
            <span class="sp-view-filters__icon">\uD83D\uDC41</span>
            <h3>View Filters</h3>
          </div>
          <p class="sp-view-filters__hint">Add WHERE-clause filters before executing. Leave empty to load all rows.</p>
        </div>

        <div class="sp-view-filters__topn">
          <label>Top N rows</label>
          <input type="number" [(ngModel)]="viewTopN" min="0" max="100000" placeholder="1000" />
          <span class="sp-view-filters__topn-hint">(0 = all rows)</span>
        </div>

        <div class="sp-view-filter-row" *ngFor="let f of viewFilters; let i = index">
          <input type="text" [(ngModel)]="f.column" placeholder="Column name" class="sp-vf-col" />
          <select [(ngModel)]="f.operator" class="sp-vf-op">
            <option value="eq">= Equals</option>
            <option value="neq">\u2260 Not Equals</option>
            <option value="contains">Contains</option>
            <option value="startswith">Starts With</option>
            <option value="gt">&gt; Greater</option>
            <option value="lt">&lt; Less</option>
            <option value="gte">\u2265 Greater/Eq</option>
            <option value="lte">\u2264 Less/Eq</option>
            <option value="isnull">IS NULL</option>
            <option value="isnotnull">IS NOT NULL</option>
          </select>
          <input type="text" [(ngModel)]="f.value" placeholder="Value"
            class="sp-vf-val"
            *ngIf="f.operator !== 'isnull' && f.operator !== 'isnotnull'" />
          <button class="sp-vf-remove" (click)="removeViewFilter(i)" title="Remove">\u2715</button>
        </div>

        <button class="sp-btn sp-btn--outline sp-btn--sm" (click)="addViewFilter()">+ Add Filter</button>
      </div>

      <!-- SP with no parameters -->
      <div class="sp-view-info"
        *ngIf="selectedItem!.type === 'StoredProcedure' && parameters.length === 0 && !loadingParams">
        <div class="sp-view-info-icon">\u2699</div>
        <p>This stored procedure has no input parameters. Click <strong>Execute</strong> to run it.</p>
      </div>

      <!-- Loading params -->
      <div class="sp-loading" *ngIf="loadingParams" style="padding:40px">
        <div class="sp-spinner"></div><span>Loading parameters\u2026</span>
      </div>

      <!-- Execute bar -->
      <div class="sp-execute-bar">
        <button class="sp-btn sp-btn--primary sp-btn--lg" (click)="execute()" [disabled]="executing">
          {{ executing ? 'Executing\u2026' : '\u25B6 Execute' }}
        </button>
        <span class="sp-exec-info" *ngIf="lastResult">
          {{ lastResult.totalCount | number }} rows in {{ lastResult.durationMs }}ms
        </span>
      </div>

      <!-- Error -->
      <div class="sp-error" *ngIf="execError && !executing">
        <span>\u26A0 {{ execError }}</span>
      </div>

      <!-- SQL preview -->
      <div class="sp-sql-box" *ngIf="lastSql && showSqlPreview">
        <div class="sp-sql-header">
          <span>Generated SQL</span>
          <button (click)="showSqlPreview = false">\u2715</button>
        </div>
        <pre>{{ lastSql }}</pre>
      </div>

      <!-- ===== Results Grid ===== -->
      <div class="sp-results" *ngIf="lastResult && !executing">

        <!-- Grid toolbar -->
        <div class="sp-grid-toolbar">
          <input type="text" class="sp-grid-search"
            [(ngModel)]="gridSearch" placeholder="Filter results\u2026"
            (ngModelChange)="gridPage = 1; markGridDirty()" />
          <div class="sp-grid-toolbar-right">
            <label class="sp-page-size-label">
              Page Size:
              <select [(ngModel)]="gridPageSize" (change)="onPageSizeChange()">
                <option [value]="10">10</option>
                <option [value]="25">25</option>
                <option [value]="50">50</option>
                <option [value]="100">100</option>
                <option [value]="250">250</option>
                <option [value]="500">500</option>
              </select>
            </label>
            <span class="sp-grid-info">
              Showing {{ paginatedRows.length }} of {{ filteredRows.length | number }} rows
            </span>
            <button class="sp-btn sp-btn--outline sp-btn--sm"
              (click)="showSqlPreview = !showSqlPreview">
              {{ '{' }}{{ '}' }} SQL
            </button>
            <button class="sp-btn sp-btn--outline sp-btn--sm" (click)="exportCsv()">
              \u2193 CSV
            </button>
            <button class="sp-btn sp-btn--outline sp-btn--sm" (click)="exportExcel()">
              \u2193 Excel
            </button>
          </div>
        </div>

        <!-- Column filter row -->
        <div class="sp-col-filters">
          <div class="sp-col-filter sp-col-filter--rownum"></div>
          <div class="sp-col-filter" *ngFor="let col of lastResult.columns">
            <input type="text" [placeholder]="col"
              [(ngModel)]="columnFilters[col]"
              (ngModelChange)="gridPage = 1; markGridDirty()"
              class="sp-col-filter-input" />
          </div>
        </div>

        <!-- Data table -->
        <div class="sp-grid-wrap">
          <table class="sp-grid">
            <thead>
              <tr>
                <th class="sp-th-rownum">#</th>
                <th *ngFor="let col of lastResult.columns"
                  (click)="sortByCol(col)"
                  [class.sorted]="sortCol === col"
                  [class.sort-asc]="sortCol === col && sortDir === 'asc'"
                  [class.sort-desc]="sortCol === col && sortDir === 'desc'">
                  {{ col }}
                  <span class="sp-sort-arrow" *ngIf="sortCol === col">
                    {{ sortDir === 'asc' ? '\u2191' : '\u2193' }}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of paginatedRows; let i = index">
                <td class="sp-td-rownum">{{ (gridPage - 1) * gridPageSize + i + 1 }}</td>
                <td *ngFor="let col of lastResult.columns"
                  [title]="row[col]?.toString() || ''">
                  {{ formatCell(row[col]) }}
                </td>
              </tr>
              <tr *ngIf="paginatedRows.length === 0">
                <td [attr.colspan]="lastResult.columns.length + 1" class="sp-no-rows">
                  No matching rows
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="sp-pager">
          <button [disabled]="gridPage <= 1" (click)="gridPage = 1; markGridDirty()" title="First page">\u00AB</button>
          <button [disabled]="gridPage <= 1" (click)="gridPage = gridPage - 1; markGridDirty()">\u2039 Prev</button>

          <button *ngFor="let p of visiblePageNumbers"
            [class.sp-page-active]="p === gridPage"
            [disabled]="p === gridPage"
            (click)="gridPage = p; markGridDirty()">{{ p }}</button>

          <span class="sp-pager-info">
            of {{ totalGridPages }}
          </span>
          <button [disabled]="gridPage >= totalGridPages" (click)="gridPage = gridPage + 1; markGridDirty()">Next \u203A</button>
          <button [disabled]="gridPage >= totalGridPages" (click)="gridPage = totalGridPages; markGridDirty()" title="Last page">\u00BB</button>
        </div>
      </div>

      <!-- Executing spinner -->
      <div class="sp-loading" *ngIf="executing" style="padding:60px">
        <div class="sp-spinner"></div><span>Executing query\u2026</span>
      </div>

    </div>
  </div>

  <!-- Save Report Modal -->
  <div class="sp-overlay" *ngIf="showSaveModal" (click)="onOverlayClick($event)">
    <div class="sp-modal">
      <div class="sp-modal-header">
        <h3>Save SP Report</h3>
        <button (click)="showSaveModal = false">\u2715</button>
      </div>
      <div class="sp-modal-body">
        <div class="sp-prop-group">
          <label>Report Name *</label>
          <input type="text" [(ngModel)]="reportName" placeholder="e.g. Monthly Sales Report" />
        </div>
        <div class="sp-prop-group">
          <label>Description</label>
          <input type="text" [(ngModel)]="reportDescription" placeholder="Optional description" />
        </div>
      </div>
      <div class="sp-modal-footer">
        <button class="sp-btn sp-btn--outline" (click)="showSaveModal = false">Cancel</button>
        <button class="sp-btn sp-btn--primary" (click)="confirmSaveReport()" [disabled]="!reportName || savingReport">
          {{ savingReport ? 'Saving\u2026' : '\u2713 Save' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="sp-toast" [class.show]="toastVisible" [class.err]="toastError">{{ toastMsg }}</div>

</div>
  `,
  styles: [`
    .sp-shell { flex:1; display:flex; flex-direction:column; background:#f0f2f5; font-family:inherit; min-height:0; }

    /* ===== LIST VIEW ===== */
    .sp-list-view { flex:1; overflow-y:auto; padding:28px 32px; min-height:0; }
    .sp-header { margin-bottom:20px;
      h1 { font-size:22px; font-weight:600; margin:0 0 4px; color:var(--color-text-primary,#0f172a); }
      p  { font-size:13px; color:var(--color-text-secondary,#64748b); margin:0; }
    }
    .sp-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--color-text-secondary,#64748b); margin-bottom:10px; }

    .sp-saved-section { margin-bottom:24px; }
    .sp-saved-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:10px; }
    .sp-saved-card { background:white; border:0.5px solid var(--color-border-tertiary,#e5e7eb); border-radius:10px; padding:14px 16px; transition:.15s;
      &:hover { border-color:#93c5fd; box-shadow:0 2px 10px rgba(37,99,235,.06); }
    }
    .sp-saved-card__header { display:flex; gap:10px; align-items:center; margin-bottom:6px; }
    .sp-saved-card__icon { font-size:18px; flex-shrink:0; }
    .sp-saved-card__info { flex:1; min-width:0; }
    .sp-saved-card__name { font-size:13px; font-weight:600; color:var(--color-text-primary,#0f172a); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sp-saved-card__obj { font-size:11px; font-family:monospace; color:#2563eb; }
    .sp-saved-card__meta { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
    .sp-chip { font-size:10px; background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:99px; }
    .sp-saved-card__actions { display:flex; gap:6px; }

    .sp-conn-bar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; padding:16px 18px; background:white; border:0.5px solid var(--color-border-tertiary,#e5e7eb); border-radius:12px; align-items:flex-end; }
    .sp-field { display:flex; flex-direction:column; gap:5px; flex:1; min-width:160px; position:relative;
      label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--color-text-secondary,#64748b); }
      input, select { padding:9px 12px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:8px; font-size:13px; font-family:inherit; outline:none; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
        &:focus { border-color:#2563eb; }
      }
    }
    .sp-field--sm { max-width:100px; }
    .sp-field--action { min-width:auto; flex:0; }
    .sp-input-row { display:flex; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:8px; overflow:hidden;
      &:focus-within { border-color:#2563eb; }
      input { flex:1; padding:9px 12px; border:none; outline:none; font-size:13px; font-family:inherit; color:var(--color-text-primary,#0f172a); background:transparent; }
    }
    .sp-browse-btn { padding:9px 12px; border:none; border-left:1px solid var(--color-border-secondary,#e2e8f0); background:var(--color-background-secondary,#f8fafc); cursor:pointer; color:var(--color-text-secondary,#64748b); font-size:14px;
      &:hover:not(:disabled) { background:#eff6ff; color:#2563eb; }
      &:disabled { opacity:.4; cursor:not-allowed; }
    }
    .sp-dropdown { position:absolute; top:100%; left:0; right:0; z-index:100; background:var(--color-background-primary,white); border:0.5px solid var(--color-border-secondary,#e2e8f0); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.1); max-height:180px; overflow-y:auto; margin-top:4px;
      div { padding:8px 12px; font-size:13px; cursor:pointer; color:var(--color-text-primary,#0f172a);
        &:hover { background:#eff6ff; color:#2563eb; }
      }
    }

    .sp-filter-bar { display:flex; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
    .sp-search { padding:8px 14px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:8px; font-size:13px; font-family:inherit; outline:none; width:280px; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
      &:focus { border-color:#2563eb; }
    }
    .sp-type-filter { display:flex; background:var(--color-background-secondary,#f1f5f9); border-radius:8px; padding:3px; gap:3px;
      button { padding:6px 14px; border:none; background:transparent; border-radius:6px; font-size:12px; font-weight:500; color:var(--color-text-secondary,#64748b); cursor:pointer; font-family:inherit; transition:.15s; white-space:nowrap;
        &.active { background:white; color:var(--color-text-primary,#0f172a); font-weight:600; box-shadow:0 1px 4px rgba(0,0,0,.08); }
        &:hover:not(.active) { color:var(--color-text-primary,#0f172a); }
      }
    }

    .sp-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
    .sp-card { background:white; border:0.5px solid var(--color-border-tertiary,#e5e7eb); border-radius:12px; padding:16px 18px; transition:.15s;
      &:hover { border-color:#93c5fd; box-shadow:0 2px 12px rgba(37,99,235,.08); }
    }
    .sp-card__header { display:flex; gap:10px; align-items:center; margin-bottom:10px; }
    .sp-card__icon { font-size:22px; flex-shrink:0; }
    .sp-card--sp .sp-card__icon { color:#2563eb; }
    .sp-card--view .sp-card__icon { color:#7c3aed; }
    .sp-card__info { flex:1; }
    .sp-card__name { font-size:14px; font-weight:600; color:var(--color-text-primary,#0f172a); font-family:monospace; }
    .sp-card__schema { font-size:11px; color:var(--color-text-secondary,#64748b); }
    .sp-type-badge { font-size:10px; font-weight:700; padding:2px 10px; border-radius:99px;
      &.badge--sp { background:#dbeafe; color:#1d4ed8; }
      &.badge--view { background:#ede9fe; color:#6d28d9; }
    }
    .sp-card__actions { display:flex; gap:8px; }
    .sp-act-btn { padding:6px 14px; border:0.5px solid var(--color-border-secondary,#e2e8f0); background:white; border-radius:7px; cursor:pointer; font-size:12px; font-family:inherit; color:var(--color-text-secondary,#64748b); transition:.15s;
      &:hover { background:var(--color-background-secondary,#f8fafc); }
      &.sp-act-btn--run:hover { background:#eff6ff; color:#2563eb; border-color:#2563eb; }
      &.sp-act-btn--del:hover { background:#fef2f2; color:#dc2626; border-color:#dc2626; }
    }

    .sp-btn { padding:8px 16px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:none; font-family:inherit; transition:.15s; }
    .sp-btn--primary { background:#2563eb; color:white; &:hover { background:#1d4ed8; } &:disabled { opacity:.5; cursor:not-allowed; } }
    .sp-btn--outline { background:transparent; border:1.5px solid var(--color-border-secondary,#e2e8f0); color:var(--color-text-secondary,#64748b);
      &:hover { background:var(--color-background-secondary,#f8fafc); } &:disabled { opacity:.4; cursor:not-allowed; }
    }
    .sp-btn--sm { padding:6px 14px; font-size:12px; }
    .sp-btn--lg { padding:10px 28px; font-size:14px; font-weight:600; }

    .sp-loading { display:flex; align-items:center; gap:12px; padding:40px; color:var(--color-text-secondary,#64748b); font-size:13px; justify-content:center; }
    .sp-spinner { width:28px; height:28px; border:2.5px solid var(--color-border-tertiary,#e5e7eb); border-top-color:#2563eb; border-radius:50%; animation:sp-spin .8s linear infinite; }
    @keyframes sp-spin { to { transform:rotate(360deg); } }
    .sp-empty { text-align:center; padding:60px 20px; color:var(--color-text-secondary,#94a3b8);
      .sp-empty-icon { font-size:48px; }
      h3 { font-size:18px; font-weight:500; margin:12px 0 8px; color:var(--color-text-primary,#374151); }
      p { font-size:13px; }
    }

    /* ===== DESIGNER VIEW ===== */
    .sp-designer { flex:1; display:flex; flex-direction:column; min-height:0; }
    .sp-designer-bar { display:flex; align-items:center; gap:10px; padding:0 16px; height:50px; background:white; border-bottom:0.5px solid var(--color-border-tertiary,#e5e7eb); flex-shrink:0; }
    .sp-back-btn { padding:5px 10px; border:0.5px solid var(--color-border-secondary,#e2e8f0); background:transparent; border-radius:6px; font-size:12px; cursor:pointer; color:var(--color-text-secondary,#64748b); font-family:inherit; white-space:nowrap;
      &:hover { background:var(--color-background-secondary,#f8fafc); }
    }
    .sp-designer-title { display:flex; align-items:center; gap:8px;
      .sp-designer-icon { font-size:18px; }
      h2 { font-size:15px; font-weight:600; margin:0; color:var(--color-text-primary,#0f172a); font-family:monospace; }
    }
    .sp-type-pill { font-size:10px; font-weight:700; padding:2px 10px; border-radius:99px;
      &.pill--sp { background:#dbeafe; color:#1d4ed8; }
      &.pill--view { background:#ede9fe; color:#6d28d9; }
    }
    .sp-bar-spacer { flex:1; }
    .sp-report-name-input { padding:6px 12px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:7px; font-size:13px; font-family:inherit; outline:none; width:200px; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
      &:focus { border-color:#2563eb; }
    }

    .sp-designer-body { flex:1; overflow-y:auto; padding:20px 24px; min-height:0; }
    .sp-designer-body > * + * { margin-top:16px; }

    .sp-params-section { }
    .sp-params-panel { display:flex; gap:16px; }
    .sp-canvas-wrap { flex:1; min-width:0; }
    .sp-params-header { display:flex; align-items:center; gap:12px; margin-bottom:12px;
      h3 { font-size:15px; font-weight:600; margin:0; }
      .sp-param-count { font-size:12px; color:var(--color-text-secondary,#64748b); }
    }
    .sp-canvas { background:white; border:1.5px dashed var(--color-border-tertiary,#d1d5db); border-radius:12px; padding:16px; min-height:100px; }
    .sp-canvas-row { display:grid; grid-template-columns:repeat(12,1fr); gap:12px; margin-bottom:12px;
      &:last-child { margin-bottom:0; }
    }
    .sp-canvas-cell { background:var(--color-background-secondary,#f8fafc); border:1.5px solid transparent; border-radius:8px; padding:12px; cursor:pointer; transition:.15s;
      &:hover { border-color:#93c5fd; background:#fafbff; }
      &.sp-cell-selected { border-color:#2563eb; background:#eff6ff; box-shadow:0 0 0 2px rgba(37,99,235,.1); }
    }
    .sp-param-control { display:flex; flex-direction:column; gap:6px; }
    .sp-param-label { font-size:12px; font-weight:600; color:var(--color-text-primary,#0f172a);
      .sp-param-req { color:#ef4444; }
    }
    .sp-param-input { padding:8px 12px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:7px; font-size:13px; font-family:inherit; outline:none; width:100%; box-sizing:border-box; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
      &:focus { border-color:#2563eb; }
    }
    .sp-checkbox-wrap { display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; color:var(--color-text-primary,#0f172a);
      input { width:16px; height:16px; cursor:pointer; accent-color:#2563eb; }
    }
    .sp-param-meta { display:flex; gap:8px; }
    .sp-param-type { font-size:10px; background:var(--color-background-secondary,#f1f5f9); color:var(--color-text-secondary,#475569); padding:2px 8px; border-radius:4px; font-family:monospace; }
    .sp-param-output { font-size:10px; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; font-weight:600; }

    .sp-param-props { width:260px; flex-shrink:0; background:white; border:0.5px solid var(--color-border-tertiary,#e5e7eb); border-radius:12px; padding:16px; overflow-y:auto; max-height:420px; }
    .sp-props-title { font-size:13px; font-weight:700; color:var(--color-text-primary,#0f172a); margin-bottom:14px; padding-bottom:8px; border-bottom:0.5px solid var(--color-border-tertiary,#e5e7eb); }
    .sp-prop-group { display:flex; flex-direction:column; gap:4px; margin-bottom:12px;
      label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-secondary,#64748b); }
      input, select { padding:7px 10px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:7px; font-size:13px; font-family:inherit; outline:none; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
        &:focus { border-color:#2563eb; }
      }
    }
    .sp-col-span-picker { display:flex; flex-wrap:wrap; gap:4px;
      button { width:28px; height:28px; border:1px solid var(--color-border-secondary,#e2e8f0); background:white; border-radius:5px; font-size:11px; cursor:pointer; font-family:inherit; color:var(--color-text-secondary,#64748b); transition:.15s;
        &.picked { background:#2563eb; color:white; border-color:#2563eb; }
        &:hover:not(.picked) { border-color:#93c5fd; }
      }
    }
    .sp-toggle { display:inline-flex; cursor:pointer;
      input { display:none; }
      .sp-toggle-track { width:36px; height:20px; background:#cbd5e1; border-radius:99px; position:relative; transition:.2s;
        &::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; background:white; border-radius:50%; transition:.2s; }
      }
      input:checked + .sp-toggle-track { background:#2563eb;
        &::after { left:18px; }
      }
    }

    .sp-mode-bar { display:flex; gap:4px; margin-bottom:12px; background:var(--color-background-secondary,#f1f5f9); border-radius:8px; padding:3px; width:fit-content;
      button { padding:6px 16px; border:none; background:transparent; border-radius:6px; font-size:12px; font-weight:500; color:var(--color-text-secondary,#64748b); cursor:pointer; font-family:inherit; transition:.15s; white-space:nowrap;
        &.active { background:white; color:var(--color-text-primary,#0f172a); font-weight:600; box-shadow:0 1px 4px rgba(0,0,0,.08); }
        &:hover:not(.active) { color:var(--color-text-primary,#0f172a); }
      }
    }

    .sp-view-filters { background:white; border:0.5px solid var(--color-border-tertiary,#e5e7eb); border-radius:12px; padding:20px; }
    .sp-view-filters__header { margin-bottom:14px; }
    .sp-view-filters__title { display:flex; align-items:center; gap:8px;
      .sp-view-filters__icon { font-size:22px; }
      h3 { font-size:15px; font-weight:600; margin:0; color:var(--color-text-primary,#0f172a); }
    }
    .sp-view-filters__hint { font-size:13px; color:var(--color-text-secondary,#64748b); margin:4px 0 0; }
    .sp-view-filters__topn { display:flex; align-items:center; gap:8px; margin-bottom:14px;
      label { font-size:12px; font-weight:600; color:var(--color-text-secondary,#64748b); }
      input { width:100px; padding:7px 10px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:7px; font-size:13px; font-family:inherit; outline:none; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
        &:focus { border-color:#2563eb; }
      }
    }
    .sp-view-filters__topn-hint { font-size:11px; color:var(--color-text-secondary,#94a3b8); }
    .sp-view-filter-row { display:flex; gap:8px; align-items:center; margin-bottom:8px;
      .sp-vf-col { width:180px; padding:7px 10px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:7px; font-size:13px; font-family:inherit; outline:none; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
        &:focus { border-color:#2563eb; }
      }
      .sp-vf-op { width:150px; padding:7px 10px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:7px; font-size:13px; font-family:inherit; outline:none; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
        &:focus { border-color:#2563eb; }
      }
      .sp-vf-val { flex:1; min-width:120px; padding:7px 10px; border:1.5px solid var(--color-border-secondary,#e2e8f0); border-radius:7px; font-size:13px; font-family:inherit; outline:none; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
        &:focus { border-color:#2563eb; }
      }
      .sp-vf-remove { width:28px; height:28px; border:none; background:#fef2f2; color:#dc2626; border-radius:6px; cursor:pointer; font-size:12px; transition:.15s; flex-shrink:0;
        &:hover { background:#fee2e2; }
      }
    }

    /* ===== RESULTS GRID ===== */
    .sp-results { display:flex; flex-direction:column; border:0.5px solid var(--color-border-tertiary,#e5e7eb); border-radius:12px; overflow:hidden; background:white; }

    .sp-grid-toolbar { display:flex; align-items:center; gap:12px; padding:10px 14px; background:var(--color-background-secondary,#f8fafc); border-bottom:0.5px solid var(--color-border-tertiary,#e5e7eb); flex-wrap:wrap; flex-shrink:0; }
    .sp-grid-search { padding:7px 12px; border:0.5px solid var(--color-border-secondary,#e2e8f0); border-radius:7px; font-size:12px; font-family:inherit; outline:none; width:240px; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
      &:focus { border-color:#2563eb; }
    }
    .sp-grid-toolbar-right { display:flex; align-items:center; gap:10px; margin-left:auto; flex-wrap:wrap; }
    .sp-page-size-label { font-size:12px; color:var(--color-text-secondary,#64748b); display:flex; align-items:center; gap:6px;
      select { padding:4px 8px; border:0.5px solid var(--color-border-secondary,#e2e8f0); border-radius:5px; font-size:12px; font-family:inherit; outline:none; background:var(--color-background-primary,white); color:var(--color-text-primary,#0f172a); }
    }
    .sp-grid-info { font-size:12px; color:var(--color-text-secondary,#64748b); }

    .sp-col-filters { display:flex; overflow-x:auto; padding:4px 0; background:var(--color-background-secondary,#f8fafc); border-bottom:0.5px solid var(--color-border-tertiary,#e5e7eb); flex-shrink:0; }
    .sp-col-filter { flex-shrink:0; padding:2px 4px; }
    .sp-col-filter--rownum { width:40px; }
    .sp-col-filter-input { padding:4px 8px; border:1px solid var(--color-border-tertiary,#e7e7eb); border-radius:4px; font-size:11px; font-family:inherit; outline:none; width:110px; color:var(--color-text-primary,#0f172a); background:var(--color-background-primary,white);
      &:focus { border-color:#2563eb; }
      &::placeholder { color:var(--color-text-secondary,#94a3b8); font-size:10px; }
    }

    .sp-grid-wrap { overflow:auto; max-height:calc(100vh - 320px); }
    .sp-grid { width:100%; border-collapse:collapse; font-size:12px;
      th { padding:8px 12px; text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; background:var(--color-background-secondary,#f8fafc); border-bottom:0.5px solid var(--color-border-tertiary,#e5e7eb); white-space:nowrap; cursor:pointer; user-select:none; position:sticky; top:0; z-index:1;
        &:hover { color:#2563eb; }
        &.sorted { color:#2563eb; font-weight:800; }
      }
      td { padding:7px 12px; border-bottom:0.5px solid var(--color-border-tertiary,#e5e7eb); color:var(--color-text-primary,#0f172a); white-space:nowrap; max-width:250px; overflow:hidden; text-overflow:ellipsis; }
      tr:hover td { background:var(--color-background-secondary,#f8fafc); }
    }
    .sp-th-rownum, .sp-td-rownum { width:40px; text-align:center; color:var(--color-text-secondary,#94a3b8); font-size:11px; }
    .sp-no-rows { text-align:center; padding:24px!important; color:var(--color-text-secondary,#94a3b8); font-style:italic; }
    .sp-sort-arrow { font-size:11px; margin-left:2px; }

    .sp-pager { display:flex; align-items:center; justify-content:center; gap:4px; padding:10px; border-top:0.5px solid var(--color-border-tertiary,#e5e7eb); font-size:12px; color:var(--color-text-secondary,#64748b); flex-shrink:0;
      button { padding:5px 10px; border:0.5px solid var(--color-border-secondary,#e2e8f0); background:var(--color-background-primary,white); border-radius:6px; cursor:pointer; font-family:inherit; font-size:12px; color:var(--color-text-secondary,#64748b); transition:.15s; min-width:32px; text-align:center;
        &:hover:not(:disabled) { background:var(--color-background-secondary,#f8fafc); color:#2563eb; }
        &:disabled { opacity:.35; cursor:not-allowed; }
        &.sp-page-active { background:#2563eb; color:white; border-color:#2563eb; font-weight:600; }
      }
    }
    .sp-pager-info { font-weight:500; padding:0 4px; }

    .sp-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:2000; padding:16px; }
    .sp-modal { background:var(--color-background-primary,white); border-radius:14px; width:100%; max-width:460px; box-shadow:0 24px 48px rgba(0,0,0,.2); animation:sp-su .2s ease; overflow:hidden; }
    @keyframes sp-su { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
    .sp-modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:0.5px solid var(--color-border-tertiary,#e5e7eb);
      h3 { font-size:14px; font-weight:600; margin:0; }
      button { width:26px; height:26px; border:none; background:var(--color-background-secondary,#f1f5f9); border-radius:50%; cursor:pointer; font-size:12px; color:var(--color-text-secondary,#64748b); }
    }
    .sp-modal-body { padding:18px 20px; display:flex; flex-direction:column; gap:14px; }
    .sp-modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:0.5px solid var(--color-border-tertiary,#e5e7eb); }

    .sp-toast { position:fixed; bottom:24px; right:24px; background:#0f172a; color:white; padding:12px 20px; border-radius:8px; font-size:13px; opacity:0; transform:translateY(8px); transition:.25s; pointer-events:none; z-index:9999;
      &.show { opacity:1; transform:none; }
      &.err { background:#dc2626; }
    }
  `]
})
export class SpReportComponent implements OnInit {
  private http = inject(HttpClient);
  private api  = environment.apiBase;

  view: ViewMode = 'list';
  connections: SavedConnection[] = [];
  selectedConnectionId = 0;
  selectedDatabase = '';
  selectedSchema = 'dbo';
  dbList: string[] = [];
  showDbList = false;
  loadingDbs = false;
  spList: SpOrView[] = [];
  loadingList = false;
  listSearch = '';
  typeFilter: 'all' | 'sp' | 'view' = 'all';
  savedReports: SavedSpReport[] = [];
  selectedItem?: SpOrView;
  parameters: SpParameter[] = [];
  loadingParams = false;
  selectedParam?: SpParameter;
  colSpanOptions = [2, 3, 4, 6, 8, 12];
  private draggingParam?: SpParameter;
  paramMode: 'input' | 'design' = 'input';
  viewFilters: ViewFilter[] = [];
  viewTopN = 1000;
  reportName = '';
  reportDescription = '';
  editingReportId?: number;
  showSaveModal = false;
  savingReport = false;
  executing = false;
  execError = '';
  lastResult?: RunResult;
  lastSql = '';
  showSqlPreview = false;
  gridSearch = '';
  columnFilters: Record<string, string> = {};
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';
  gridPage = 1;
  gridPageSize = 50;
  toastMsg = '';
  toastError = false;
  toastVisible = false;
  private _cachedFilteredRows: Record<string, any>[] = [];
  private _cachedPaginatedRows: Record<string, any>[] = [];
  private _cachedTotalPages = 1;
  private _cachedVisiblePages: number[] = [];
  private _cachedParamRows: SpParameter[][] = [];
  private _gridDirty = true;
  private _paramRowsDirty = true;

  ngOnInit() { this.loadConnections(); this.loadSavedReports(); }

  get spCount(): number { return this.spList.filter(s => s.type === 'StoredProcedure').length; }
  get viewCount(): number { return this.spList.filter(s => s.type === 'View').length; }

  get filteredSpList(): SpOrView[] {
    let list = this.spList;
    if (this.typeFilter === 'sp') list = list.filter(s => s.type === 'StoredProcedure');
    if (this.typeFilter === 'view') list = list.filter(s => s.type === 'View');
    if (this.listSearch) {
      const q = this.listSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.fullName.toLowerCase().includes(q));
    }
    return list;
  }

  loadConnections() {
    this.http.get<any>(`${this.api}/api/connections`).subscribe({
      next: r => { this.connections = r.data || []; }
    });
  }

  loadSavedReports() {
    this.http.get<any>(`${this.api}/api/sp-reports`).subscribe({
      next: r => { this.savedReports = r.data || []; },
      error: () => {}
    });
  }

  onConnectionChange() { this.selectedDatabase = ''; this.spList = []; this.dbList = []; this.showDbList = false; }

  browseDatabases() {
    if (!this.selectedConnectionId) return;
    this.loadingDbs = true;
    this.http.get<any>(`${this.api}/api/connections/${this.selectedConnectionId}/databases`).subscribe({
      next: r => { this.dbList = r.data || []; this.showDbList = true; this.loadingDbs = false; },
      error: () => { this.loadingDbs = false; this.toast('Failed to load databases', true); }
    });
  }

  selectDatabase(db: string) { this.selectedDatabase = db; this.showDbList = false; this.spList = []; }

  loadSpAndViews() {
    if (!this.selectedConnectionId || !this.selectedDatabase) return;
    this.loadingList = true;
    this.spList = [];
    this.http.get<any>(`${this.api}/api/reports/meta/sp-and-views`, {
      params: { connId: this.selectedConnectionId, db: this.selectedDatabase, schema: this.selectedSchema || 'dbo' }
    }).subscribe({
      next: r => {
        this.spList = (r.data || []).map((item: any) => ({
          name: item.name,
          schema: item.schema || item.schemaName || this.selectedSchema,
          type: this.normalizeType(item.type),
          fullName: item.fullName || `[${item.schema || item.schemaName || this.selectedSchema}].[${item.name}]`
        }));
        this.loadingList = false;
        if (this.spList.length === 0) this.toast('No stored procedures or views found');
      },
      error: err => { this.loadingList = false; this.toast(err?.error?.message || 'Failed to load SPs and views', true); }
    });
  }

  openSavedReport(sr: SavedSpReport) {
    this.selectedConnectionId = sr.connectionId;
    this.selectedDatabase = sr.databaseName;
    this.selectedSchema = sr.schemaName;
    this.editingReportId = sr.id;
    this.reportName = sr.name;
    this.reportDescription = sr.description || '';
    const item: SpOrView = { name: sr.objectName, schema: sr.schemaName, type: sr.objectType, fullName: `[${sr.schemaName}].[${sr.objectName}]` };
    this.openDesigner(item);
    if (sr.parameterConfig) {
      setTimeout(() => {
        try {
          const savedParams = JSON.parse(sr.parameterConfig!);
          this.parameters.forEach(p => {
            const sp = savedParams.find((s: any) => s.name === p.name);
            if (sp) { p.value = sp.value || ''; p.label = sp.label || p.label; p.placeholder = sp.placeholder || ''; p.colSpan = sp.colSpan || p.colSpan; p.rowIndex = sp.rowIndex ?? p.rowIndex; p.controlType = sp.controlType || p.controlType; p.isRequired = sp.isRequired ?? p.isRequired; }
          });
        } catch {}
      }, 1000);
    }
  }

  deleteSavedReport(sr: SavedSpReport) {
    if (!confirm(`Delete saved report "${sr.name}"?`)) return;
    this.http.delete<any>(`${this.api}/api/sp-reports/${sr.id}`).subscribe({
      next: () => { this.loadSavedReports(); this.toast('Report deleted'); },
      error: () => this.toast('Failed to delete report', true)
    });
  }

  openDesigner(item: SpOrView) {
    this.selectedItem = item; this.parameters = []; this.selectedParam = undefined;
    this.lastResult = undefined; this.lastSql = ''; this.execError = ''; this.showSqlPreview = false;
    this.columnFilters = {}; this.gridSearch = ''; this.sortCol = ''; this.gridPage = 1;
    this.paramMode = 'input'; this.viewFilters = []; this.viewTopN = 1000;
    this.markGridDirty(); this.markParamRowsDirty(); this.view = 'designer';
    if (!this.reportName) this.reportName = item.name;
    if (item.type === 'StoredProcedure') this.loadParameters(item);
  }

  backToList() { this.view = 'list'; this.editingReportId = undefined; this.reportName = ''; this.reportDescription = ''; this.loadSavedReports(); }
  selectParam(param: SpParameter) { this.selectedParam = param; }

  loadParameters(item: SpOrView) {
    this.loadingParams = true;
    this.http.get<any>(`${this.api}/api/reports/meta/sp-parameters`, {
      params: { connId: this.selectedConnectionId, db: this.selectedDatabase, schema: this.selectedSchema || 'dbo', spName: item.name }
    }).subscribe({
      next: r => {
        try {
          this.parameters = (r.data || []).map((p: any, i: number) => ({
            ...p, value: p.defaultValue || '', controlType: this.inferControlType(p.dataType || 'nvarchar'),
            label: this.formatParamLabel(p.name || `param${i}`), placeholder: '', colSpan: 6,
            rowIndex: Math.floor(i / 2), isRequired: !p.hasDefault && !p.isOutput
          }));
        } catch (e) { console.error('Error mapping parameters:', e); this.parameters = []; this.toast('Error processing parameters', true); }
        this.markParamRowsDirty(); this.loadingParams = false;
      },
      error: () => { this.loadingParams = false; this.toast('Failed to load parameters', true); }
    });
  }

  private inferControlType(dataType: string): SpParameter['controlType'] {
    if (!dataType) return 'text';
    const dt = dataType.toLowerCase();
    if (dt.includes('int') || dt.includes('decimal') || dt.includes('float') || dt.includes('money') || dt.includes('numeric') || dt.includes('real')) return 'number';
    if (dt === 'date') return 'date';
    if (dt.includes('datetime') || dt.includes('smalldatetime')) return 'datetime';
    if (dt === 'bit') return 'checkbox';
    return 'text';
  }

  private normalizeType(raw: string): 'StoredProcedure' | 'View' {
    const t = (raw || '').toUpperCase();
    if (t === 'SP' || t === 'STOREDPROCEDURE' || t === 'STORED_PROCEDURE' || t === 'P') return 'StoredProcedure';
    return 'View';
  }

  private formatParamLabel(name: string): string {
    if (!name) return 'Parameter';
    const clean = name.replace(/^@/, '');
    return clean.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  markParamRowsDirty() { this._paramRowsDirty = true; }

  getParameterRows(): SpParameter[][] {
    if (!this._paramRowsDirty) return this._cachedParamRows;
    this._paramRowsDirty = false;
    if (!this.parameters.length) { this._cachedParamRows = []; return []; }
    const rows = new Map<number, SpParameter[]>();
    this.parameters.forEach(p => { if (!rows.has(p.rowIndex)) rows.set(p.rowIndex, []); rows.get(p.rowIndex)!.push(p); });
    this._cachedParamRows = Array.from(rows.keys()).sort((a, b) => a - b).map(k => rows.get(k)!);
    return this._cachedParamRows;
  }

  onParamDragStart(e: DragEvent, param: SpParameter) { this.draggingParam = param; e.dataTransfer?.setData('text/plain', param.name); }
  onParamDragOver(e: DragEvent) { e.preventDefault(); }
  onParamDrop(e: DragEvent, target: SpParameter) {
    e.preventDefault();
    if (!this.draggingParam || this.draggingParam === target) return;
    const tempRow = this.draggingParam.rowIndex;
    this.draggingParam.rowIndex = target.rowIndex; target.rowIndex = tempRow;
    this.draggingParam = undefined; this.markParamRowsDirty();
  }

  addViewFilter() { this.viewFilters.push({ column: '', operator: 'eq', value: '', dataType: 'nvarchar' }); }
  removeViewFilter(i: number) { this.viewFilters.splice(i, 1); }

  saveSpReport() { if (!this.reportName) { this.showSaveModal = true; return; } this.confirmSaveReport(); }

  confirmSaveReport() {
    if (!this.reportName || !this.selectedItem) return;
    this.savingReport = true;
    const paramConfig = JSON.stringify(this.parameters.map(p => ({ name: p.name, value: p.value, label: p.label, placeholder: p.placeholder, colSpan: p.colSpan, rowIndex: p.rowIndex, controlType: p.controlType, isRequired: p.isRequired })));
    const payload = { name: this.reportName, description: this.reportDescription, externalConnectionId: Number(this.selectedConnectionId), connectionId: Number(this.selectedConnectionId), databaseName: this.selectedDatabase, schemaName: this.selectedSchema || 'dbo', objectName: this.selectedItem.name, objectType: this.selectedItem.type, parameterConfig: paramConfig };
    const obs = this.editingReportId ? this.http.put<any>(`${this.api}/api/sp-reports/${this.editingReportId}`, payload) : this.http.post<any>(`${this.api}/api/sp-reports`, payload);
    obs.subscribe({
      next: r => { this.savingReport = false; this.showSaveModal = false; this.editingReportId = r.data?.id || this.editingReportId; this.toast('Report saved!'); },
      error: () => { this.savingReport = false; this.toast('Save failed', true); }
    });
  }

  onOverlayClick(e: Event) { if ((e.target as HTMLElement).classList.contains('sp-overlay')) this.showSaveModal = false; }

  execute() {
    if (!this.selectedItem) return;
    const missing = this.parameters.filter(p => p.isRequired && !p.value && !p.isOutput);
    if (missing.length > 0) { this.toast(`Please fill required parameter(s): ${missing.map(m => m.label).join(', ')}`, true); return; }
    this.executing = true; this.execError = ''; this.lastResult = undefined;
    this.gridPage = 1; this.columnFilters = {}; this.gridSearch = ''; this.sortCol = ''; this.markGridDirty();
    const payload: any = { externalConnectionId: Number(this.selectedConnectionId), connectionId: Number(this.selectedConnectionId), databaseName: this.selectedDatabase, schemaName: this.selectedSchema || 'dbo', name: this.selectedItem.name, type: this.selectedItem.type === 'StoredProcedure' ? 'SP' : 'VIEW', parameters: this.parameters.filter(p => !p.isOutput).map(p => ({ name: p.name, value: p.value, dataType: p.dataType })) };
    if (this.selectedItem.type === 'View') { payload.topN = this.viewTopN; payload.filters = this.viewFilters.filter(f => f.column && f.operator).map(f => ({ column: f.column, operator: f.operator, value: f.value })); }
    this.http.post<any>(`${this.api}/api/reports/execute-sp`, payload).subscribe({
      next: r => { this.lastResult = r.data; this.lastSql = r.data?.generatedSql || ''; this.executing = false; this.markGridDirty(); this.toast(`Query returned ${r.data.totalCount} rows in ${r.data.durationMs}ms`); },
      error: err => { this.executing = false; this.execError = err?.error?.message || err?.error?.title || err?.message || 'Execution failed.'; }
    });
  }

  markGridDirty() { this._gridDirty = true; }

  private refreshGrid() {
    if (!this._gridDirty) return;
    this._gridDirty = false;
    if (!this.lastResult) { this._cachedFilteredRows = []; this._cachedPaginatedRows = []; this._cachedTotalPages = 1; this._cachedVisiblePages = [1]; return; }
    let rows = this.lastResult.rows;
    const q = this.gridSearch?.toLowerCase();
    if (q) { rows = rows.filter(row => Object.values(row).some(v => v?.toString().toLowerCase().includes(q))); }
    for (const col of Object.keys(this.columnFilters)) { const cf = this.columnFilters[col]?.toLowerCase(); if (cf) { rows = rows.filter(row => row[col]?.toString().toLowerCase().includes(cf)); } }
    if (this.sortCol) { rows = [...rows].sort((a, b) => { const av = a[this.sortCol] ?? ''; const bv = b[this.sortCol] ?? ''; if (typeof av === 'number' && typeof bv === 'number') return this.sortDir === 'asc' ? av - bv : bv - av; return this.sortDir === 'asc' ? av.toString().localeCompare(bv.toString()) : bv.toString().localeCompare(av.toString()); }); }
    this._cachedFilteredRows = rows;
    const ps = Number(this.gridPageSize) || 50;
    const start = (this.gridPage -  1) * ps;
    this._cachedPaginatedRows = rows.slice(start, start + ps);
    this._cachedTotalPages = Math.max(1, Math.ceil(rows.length / ps));
    const range = 2; const pages: number[] = [];
    const s = Math.max(1, this.gridPage - range); const e = Math.min(this._cachedTotalPages, this.gridPage + range);
    for (let i = s; i <= e; i++) pages.push(i);
    this._cachedVisiblePages = pages;
  }

  get filteredRows(): Record<string, any>[] { this.refreshGrid(); return this._cachedFilteredRows; }
  get paginatedRows(): Record<string, any>[] { this.refreshGrid(); return this._cachedPaginatedRows; }
  get totalGridPages(): number { this.refreshGrid(); return this._cachedTotalPages; }
  get visiblePageNumbers(): number[] { this.refreshGrid(); return this._cachedVisiblePages; }

  sortByCol(col: string) {
    if (this.sortCol === col) { this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc'; } else { this.sortCol = col; this.sortDir = 'asc'; }
    this.gridPage = 1; this.markGridDirty();
  }

  onPageSizeChange() { this.gridPage = 1; this.markGridDirty(); }

  formatCell(value: any): string {
    if (value === null || value === undefined) return '\u2014';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value.toString();
  }

  exportCsv() {
    if (!this.lastResult) return;
    const cols = this.lastResult.columns; const rows = this.filteredRows;
    const header = cols.join(',');
    const body = rows.map(row => cols.map(c => { const val = row[c]?.toString() ?? ''; return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val; }).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${this.selectedItem?.name || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    this.toast('CSV exported!');
  }

  exportExcel() {
    if (!this.lastResult || !this.editingReportId) { this.toast('Save the report first to export Excel', true); return; }
    window.open(`${this.api}/api/sp-reports/${this.editingReportId}/export/excel`, '_blank');
  }

  copySql() { if (!this.lastSql) return; navigator.clipboard.writeText(this.lastSql).then(() => this.toast('SQL copied!')); }

  toast(msg: string, error = false) { this.toastMsg = msg; this.toastError = error; this.toastVisible = true; setTimeout(() => this.toastVisible = false, 3000); }
}
