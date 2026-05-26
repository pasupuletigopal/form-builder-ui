// src/app/components/report-builder.component.ts — NEW FILE

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface SavedConnection { id: number; name: string; serverName: string; }
interface TableColumnInfo  { columnName: string; dataType: string; isNullable: boolean; isPrimaryKey: boolean; }
interface Report {
  id: number; name: string; description?: string;
  externalConnectionId: number; connectionName: string;
  databaseName: string; schemaName: string;
  queryConfig: string; lastGeneratedSql?: string;
  lastRunAt?: string; lastRowCount?: number;
  schedule?: ReportSchedule;
}
interface ReportSchedule {
  id: number; reportId: number; frequency: string;
  dayOfWeek?: number; dayOfMonth?: number; runAtHour: number;
  emailTo: string; emailSubject?: string; isActive: boolean;
  nextRunAt?: string;
}
interface JoinConfig    { table: string; alias: string; joinType: string; leftColumn: string; rightColumn: string; }
interface ColumnConfig  { table: string; column: string; alias: string; aggregation: string; selected: boolean; }
interface FilterConfig  { table: string; column: string; operator: string; value: string; }
interface OrderByConfig { table: string; column: string; direction: string; }
interface QueryConfig   {
  primaryTable: string; joins: JoinConfig[];
  columns: ColumnConfig[]; filters: FilterConfig[];
  groupBy: string[]; orderBy: OrderByConfig[]; topN: number;
}
interface RunResult {
  rows: Record<string, any>[]; totalCount: number;
  durationMs: number; columns: string[]; generatedSql: string;
}

type BuilderStep = 'connection' | 'tables' | 'columns' | 'filters' | 'sort' | 'preview';

@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  host: { 'style': 'display:flex;flex-direction:column;flex:1;min-height:0' },
  template: `
<div class="rb-shell">

  <!-- ====== REPORT LIST ====== -->
  <div class="rb-list" *ngIf="view === 'list'">
    <div class="rb-list-header">
      <div>
        <h1>Reports</h1>
        <p>Build, save and export reports from any external database tables</p>
      </div>
      <button class="rb-btn rb-btn--primary" (click)="newReport()">+ New Report</button>
    </div>

    <div class="rb-empty" *ngIf="!loading && reports.length === 0">
      <div class="rb-empty-icon">⊟</div>
      <h3>No reports yet</h3>
      <p>Create your first report by combining tables and selecting columns</p>
      <button class="rb-btn rb-btn--primary" (click)="newReport()">+ New Report</button>
    </div>

    <div class="rb-cards" *ngIf="reports.length > 0">
      <div class="rb-card" *ngFor="let r of reports">
        <div class="rb-card__header">
          <div class="rb-card__icon">⊟</div>
          <div class="rb-card__info">
            <div class="rb-card__name">{{ r.name }}</div>
            <div class="rb-card__src">{{ r.connectionName }} → {{ r.databaseName }}</div>
          </div>
        </div>
        <div class="rb-card__desc" *ngIf="r.description">{{ r.description }}</div>
        <div class="rb-card__meta">
          <span class="rb-chip" *ngIf="r.lastRowCount">{{ r.lastRowCount | number }} rows</span>
          <span class="rb-chip" *ngIf="r.lastRunAt">Last run: {{ r.lastRunAt | date:'dd MMM HH:mm' }}</span>
          <span class="rb-chip rb-chip--sched" *ngIf="r.schedule?.isActive">⏰ {{ r.schedule!.frequency }}</span>
        </div>
        <div class="rb-card__actions">
          <button class="rb-act-btn" (click)="openReport(r)" title="Open Builder">✏ Edit</button>
          <button class="rb-act-btn rb-act-btn--run" (click)="runAndView(r)" title="Run Report">▶ Run</button>
          <button class="rb-act-btn" (click)="exportExcel(r.id)" title="Export Excel">↓ Excel</button>
          <button class="rb-act-btn rb-act-btn--del" (click)="deleteReport(r)" title="Delete">⊗</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ====== REPORT BUILDER ====== -->
  <div class="rb-builder" *ngIf="view === 'builder'">

    <!-- Builder top bar -->
    <div class="rb-builder-bar">
      <button class="rb-back-btn" (click)="backToList()">← Reports</button>
      <input type="text" class="rb-name-input" [(ngModel)]="reportName"
        placeholder="Untitled Report" />
      <div class="rb-bar-spacer"></div>
      <button class="rb-btn rb-btn--outline rb-btn--sm"
        (click)="generateSqlPreview()" [disabled]="!queryConfig.primaryTable">
        {{ '{' }} {{ '}' }} Preview SQL
      </button>
      <button class="rb-btn rb-btn--outline rb-btn--sm"
        (click)="runPreview()" [disabled]="!queryConfig.primaryTable">
        ▶ Preview
      </button>
      <button class="rb-btn rb-btn--primary rb-btn--sm"
        (click)="saveReport()" [disabled]="saving">
        {{ saving ? 'Saving…' : '💾 Save' }}
      </button>
    </div>

    <!-- Builder body — stepper + content -->
    <div class="rb-builder-body">

      <!-- LEFT: Step nav -->
      <div class="rb-step-nav">
        <div class="rb-step-item" *ngFor="let s of steps"
          [class.active]="activeStep === s.key"
          [class.done]="isStepDone(s.key)"
          (click)="activeStep = s.key">
          <div class="rb-step-dot">
            <span *ngIf="!isStepDone(s.key)">{{ s.num }}</span>
            <span *ngIf="isStepDone(s.key)">✓</span>
          </div>
          <div class="rb-step-info">
            <div class="rb-step-name">{{ s.label }}</div>
            <div class="rb-step-summary">{{ getStepSummary(s.key) }}</div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Step content -->
      <div class="rb-step-content">

        <!-- STEP 1: Connection & Database -->
        <div class="rb-step-body" *ngIf="activeStep === 'connection'">
          <h3>Connection & Database</h3>
          <div class="rb-field-row">
            <div class="rb-field">
              <label>Connection *</label>
              <select [(ngModel)]="selectedConnectionId"
                (change)="onConnectionChange()">
                <option value="">-- Select Connection --</option>
                <option *ngFor="let c of connections" [value]="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="rb-field">
              <label>Database *</label>
              <div class="rb-input-row">
                <input type="text" [(ngModel)]="selectedDatabase"
                  (change)="onDatabaseChange()" placeholder="e.g. LumiereDB" />
                <button class="rb-browse" (click)="browseDatabases()"
                  [disabled]="!selectedConnectionId || loadingDbs">
                  {{ loadingDbs ? '…' : '⊞' }}
                </button>
              </div>
              <div class="rb-dropdown" *ngIf="dbList.length > 0 && showDbList">
                <div *ngFor="let d of dbList" (click)="selectDatabase(d)">{{ d }}</div>
              </div>
            </div>
            <div class="rb-field rb-field--sm">
              <label>Schema</label>
              <input type="text" [(ngModel)]="selectedSchema" placeholder="dbo" />
            </div>
          </div>
          <button class="rb-btn rb-btn--primary rb-btn--sm"
            (click)="activeStep='tables'"
            [disabled]="!selectedConnectionId || !selectedDatabase">
            Next: Select Tables →
          </button>
        </div>

        <!-- STEP 2: Tables & Joins -->
        <div class="rb-step-body" *ngIf="activeStep === 'tables'">
          <h3>Tables & Joins</h3>

          <!-- Primary table -->
          <div class="rb-section-label">Primary Table (FROM)</div>
          <div class="rb-field-row">
            <div class="rb-field">
              <div class="rb-input-row">
                <input type="text" [(ngModel)]="queryConfig.primaryTable"
                  (change)="onPrimaryTableChange()" placeholder="e.g. Orders" />
                <button class="rb-browse" (click)="browseAllTables('primary')"
                  [disabled]="loadingTables">{{ loadingTables ? '…' : '⊞' }}</button>
              </div>
              <div class="rb-dropdown" *ngIf="tableList.length > 0 && showTableList === 'primary'">
                <div *ngFor="let t of tableList" (click)="selectPrimaryTable(t)">{{ t }}</div>
              </div>
            </div>
          </div>

          <!-- Joins -->
          <div class="rb-section-label" style="margin-top:16px">
            Join Tables
            <button class="rb-add-btn" (click)="addJoin()"
              [disabled]="!queryConfig.primaryTable">+ Add Join</button>
          </div>

          <div class="rb-join-row" *ngFor="let join of queryConfig.joins; let i = index">
            <select [(ngModel)]="join.joinType" class="rb-join-type">
              <option value="INNER">INNER JOIN</option>
              <option value="LEFT">LEFT JOIN</option>
              <option value="RIGHT">RIGHT JOIN</option>
            </select>
            <div class="rb-field" style="flex:1;position:relative">
              <div class="rb-input-row">
                <input type="text" [(ngModel)]="join.table"
                  (change)="onJoinTableChange(i)" placeholder="Table name" />
                <button class="rb-browse" (click)="browseAllTables('join_' + i)"
                  [disabled]="loadingTables">⊞</button>
              </div>
              <div class="rb-dropdown" *ngIf="tableList.length > 0 && showTableList === 'join_' + i">
                <div *ngFor="let t of tableList" (click)="selectJoinTable(i, t)">{{ t }}</div>
              </div>
            </div>
            <span class="rb-on-label">ON</span>
            <div class="rb-field" style="flex:1">
              <select [(ngModel)]="join.leftColumn" class="rb-col-select">
                <option value="">{{ queryConfig.primaryTable }}.column</option>
                <option *ngFor="let c of getTableCols(queryConfig.primaryTable)"
                  [value]="queryConfig.primaryTable + '.' + c.columnName">
                  {{ queryConfig.primaryTable }}.{{ c.columnName }}
                </option>
              </select>
            </div>
            <span class="rb-eq">=</span>
            <div class="rb-field" style="flex:1">
              <select [(ngModel)]="join.rightColumn" class="rb-col-select">
                <option value="">{{ join.table }}.column</option>
                <option *ngFor="let c of getTableCols(join.table)"
                  [value]="join.table + '.' + c.columnName">
                  {{ join.table }}.{{ c.columnName }}
                </option>
              </select>
            </div>
            <button class="rb-del-btn" (click)="removeJoin(i)">⊗</button>
          </div>

          <div class="rb-nav-btns">
            <button class="rb-btn rb-btn--outline rb-btn--sm" (click)="activeStep='connection'">← Back</button>
            <button class="rb-btn rb-btn--primary rb-btn--sm" (click)="goToColumns()"
              [disabled]="!queryConfig.primaryTable">Next: Select Columns →</button>
          </div>
        </div>

        <!-- STEP 3: Columns -->
        <div class="rb-step-body" *ngIf="activeStep === 'columns'">
          <h3>Select Columns</h3>
          <div class="rb-col-toolbar">
            <button class="rb-sm-btn" (click)="selectAllColumns()">Select All</button>
            <button class="rb-sm-btn" (click)="clearAllColumns()">Clear All</button>
            <span class="rb-col-count">{{ selectedColumnCount }} selected</span>
          </div>

          <div class="rb-col-table-wrap" *ngFor="let tbl of allTables">
            <div class="rb-col-table-name">{{ tbl }}</div>
            <div class="rb-col-grid">
              <div class="rb-col-grid-header">
                <span>Select</span><span>Column</span><span>Type</span>
                <span>Alias</span><span>Aggregation</span>
              </div>
              <div class="rb-col-grid-row"
                *ngFor="let col of getTableCols(tbl)"
                [class.col-selected]="isColumnSelected(tbl, col.columnName)">
                <input type="checkbox"
                  [checked]="isColumnSelected(tbl, col.columnName)"
                  (change)="toggleColumn(tbl, col.columnName, $event)" />
                <span class="rb-col-name">
                  <span class="rb-pk-badge" *ngIf="col.isPrimaryKey">PK</span>
                  {{ col.columnName }}
                </span>
                <span class="rb-col-type">{{ col.dataType }}</span>
                <input type="text" class="rb-alias-input"
                  [value]="getColumnConfig(tbl, col.columnName)?.alias || ''"
                  (input)="setColumnAlias(tbl, col.columnName, $event)"
                  placeholder="alias"
                  [disabled]="!isColumnSelected(tbl, col.columnName)" />
                <select class="rb-agg-select"
                  [value]="getColumnConfig(tbl, col.columnName)?.aggregation || ''"
                  (change)="setColumnAgg(tbl, col.columnName, $event)"
                  [disabled]="!isColumnSelected(tbl, col.columnName)">
                  <option value="">None</option>
                  <option value="COUNT">COUNT</option>
                  <option value="SUM">SUM</option>
                  <option value="AVG">AVG</option>
                  <option value="MIN">MIN</option>
                  <option value="MAX">MAX</option>
                </select>
              </div>
            </div>
          </div>

          <div class="rb-nav-btns">
            <button class="rb-btn rb-btn--outline rb-btn--sm" (click)="activeStep='tables'">← Back</button>
            <button class="rb-btn rb-btn--primary rb-btn--sm" (click)="activeStep='filters'">Next: Filters →</button>
          </div>
        </div>

        <!-- STEP 4: Filters -->
        <div class="rb-step-body" *ngIf="activeStep === 'filters'">
          <h3>Filters <span class="rb-optional">(optional)</span></h3>
          <button class="rb-add-btn" (click)="addFilter()">+ Add Filter</button>

          <div class="rb-filter-row" *ngFor="let f of queryConfig.filters; let i = index">
            <select [(ngModel)]="f.table" class="rb-filter-sel" (change)="f.column=''">
              <option value="">Table</option>
              <option *ngFor="let t of allTables" [value]="t">{{ t }}</option>
            </select>
            <select [(ngModel)]="f.column" class="rb-filter-sel">
              <option value="">Column</option>
              <option *ngFor="let c of getTableCols(f.table)" [value]="c.columnName">
                {{ c.columnName }}
              </option>
            </select>
            <select [(ngModel)]="f.operator" class="rb-filter-op">
              <option value="eq">equals</option>
              <option value="neq">not equals</option>
              <option value="contains">contains</option>
              <option value="starts">starts with</option>
              <option value="gt">greater than</option>
              <option value="lt">less than</option>
              <option value="gte">≥ greater or equal</option>
              <option value="lte">≤ less or equal</option>
              <option value="isnull">is null</option>
              <option value="notnull">is not null</option>
            </select>
            <input type="text" [(ngModel)]="f.value" placeholder="value"
              class="rb-filter-val"
              *ngIf="f.operator !== 'isnull' && f.operator !== 'notnull'" />
            <button class="rb-del-btn" (click)="removeFilter(i)">⊗</button>
          </div>

          <div class="rb-empty-hint" *ngIf="queryConfig.filters.length === 0">
            No filters — all rows will be returned (up to TOP N limit)
          </div>

          <div class="rb-nav-btns">
            <button class="rb-btn rb-btn--outline rb-btn--sm" (click)="activeStep='columns'">← Back</button>
            <button class="rb-btn rb-btn--primary rb-btn--sm" (click)="activeStep='sort'">Next: Sort & Limit →</button>
          </div>
        </div>

        <!-- STEP 5: Sort & Limit -->
        <div class="rb-step-body" *ngIf="activeStep === 'sort'">
          <h3>Sort & Limit</h3>

          <div class="rb-section-label">
            Order By
            <button class="rb-add-btn" (click)="addOrderBy()">+ Add Sort</button>
          </div>

          <div class="rb-sort-row" *ngFor="let o of queryConfig.orderBy; let i = index">
            <select [(ngModel)]="o.table" class="rb-filter-sel" (change)="o.column=''">
              <option *ngFor="let t of allTables" [value]="t">{{ t }}</option>
            </select>
            <select [(ngModel)]="o.column" class="rb-filter-sel">
              <option value="">Column</option>
              <option *ngFor="let c of getTableCols(o.table)" [value]="c.columnName">
                {{ c.columnName }}
              </option>
            </select>
            <select [(ngModel)]="o.direction" class="rb-filter-op">
              <option value="ASC">ASC ↑</option>
              <option value="DESC">DESC ↓</option>
            </select>
            <button class="rb-del-btn" (click)="removeOrderBy(i)">⊗</button>
          </div>

          <div class="rb-field" style="margin-top:20px;max-width:200px">
            <label>TOP N Rows</label>
            <input type="number" [(ngModel)]="queryConfig.topN"
              min="1" max="100000" />
            <span class="rb-hint">Maximum rows to return (default 1000)</span>
          </div>

          <div class="rb-nav-btns">
            <button class="rb-btn rb-btn--outline rb-btn--sm" (click)="activeStep='filters'">← Back</button>
            <button class="rb-btn rb-btn--primary rb-btn--sm" (click)="runPreview()">
              ▶ Preview Results →
            </button>
          </div>
        </div>

        <!-- STEP 6: Preview -->
        <div class="rb-step-body rb-preview-step" *ngIf="activeStep === 'preview'">
          <div class="rb-preview-toolbar">
            <h3>Preview <span class="rb-row-count" *ngIf="previewResult">{{ previewResult.totalCount | number }} rows in {{ previewResult.durationMs }}ms</span></h3>
            <div class="rb-preview-actions">
              <button class="rb-btn rb-btn--outline rb-btn--sm" (click)="copySQL()">{{ '{' }} {{ '}' }} Copy SQL</button>
              <button class="rb-btn rb-btn--outline rb-btn--sm" (click)="exportPreviewExcel()" [disabled]="!previewResult">↓ Excel</button>
              <button class="rb-btn rb-btn--outline rb-btn--sm" (click)="exportPreviewPdf()" [disabled]="!previewResult">↓ PDF</button>
              <button class="rb-btn rb-btn--primary rb-btn--sm" (click)="runPreview()" [disabled]="previewLoading">
                {{ previewLoading ? 'Running…' : '↺ Refresh' }}
              </button>
            </div>
          </div>

          <!-- SQL preview -->
          <div class="rb-sql-box" *ngIf="showSql && generatedSql">
            <pre>{{ generatedSql }}</pre>
          </div>

          <!-- Loading -->
          <div class="rb-preview-loading" *ngIf="previewLoading">
            <div class="rb-spinner"></div><span>Running query…</span>
          </div>

          <!-- Error -->
          <div class="rb-preview-error" *ngIf="previewError && !previewLoading">
            <span>⚠ {{ previewError }}</span>
          </div>

          <!-- Results grid -->
          <div class="rb-results-wrap" *ngIf="previewResult && !previewLoading">
            <div class="rb-results-toolbar">
              <input type="text" placeholder="Search results…"
                [(ngModel)]="gridSearch" class="rb-grid-search" />
              <span class="rb-results-info">
                Showing {{ filteredRows.length }} of {{ previewResult.totalCount | number }} rows
              </span>
            </div>
            <div class="rb-grid-wrap">
              <table class="rb-grid">
                <thead>
                  <tr>
                    <th *ngFor="let col of previewResult.columns"
                      (click)="sortByCol(col)"
                      [class.sorted]="sortCol === col">
                      {{ col }}
                      <span *ngIf="sortCol === col">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of paginatedRows">
                    <td *ngFor="let col of previewResult.columns">
                      {{ row[col] ?? '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="rb-grid-pager">
              <button [disabled]="gridPage <= 1" (click)="gridPage=gridPage-1">‹ Prev</button>
              <span>Page {{ gridPage }} of {{ totalGridPages }}</span>
              <button [disabled]="gridPage >= totalGridPages" (click)="gridPage=gridPage+1">Next ›</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ====== SCHEDULE MODAL ====== -->
  <div class="rb-overlay" *ngIf="showScheduleModal"
    (click)="onOverlay($event)">
    <div class="rb-modal">
      <div class="rb-modal-header">
        <h3>Schedule Report</h3>
        <button (click)="showScheduleModal=false">✕</button>
      </div>
      <div class="rb-modal-body">
        <div class="rb-field">
          <label>Frequency</label>
          <select [(ngModel)]="scheduleForm.frequency">
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>
        <div class="rb-field" *ngIf="scheduleForm.frequency === 'Weekly'">
          <label>Day of Week</label>
          <select [(ngModel)]="scheduleForm.dayOfWeek">
            <option [value]="1">Monday</option><option [value]="2">Tuesday</option>
            <option [value]="3">Wednesday</option><option [value]="4">Thursday</option>
            <option [value]="5">Friday</option>
          </select>
        </div>
        <div class="rb-field" *ngIf="scheduleForm.frequency === 'Monthly'">
          <label>Day of Month</label>
          <input type="number" [(ngModel)]="scheduleForm.dayOfMonth" min="1" max="28" />
        </div>
        <div class="rb-field">
          <label>Run At (Hour UTC)</label>
          <select [(ngModel)]="scheduleForm.runAtHour">
            <option *ngFor="let h of hours" [value]="h">{{ h }}:00 UTC</option>
          </select>
        </div>
        <div class="rb-field">
          <label>Email To *</label>
          <input type="text" [(ngModel)]="scheduleForm.emailTo"
            placeholder="gopal@company.com, manager@company.com" />
          <span class="rb-hint">Comma-separated email addresses</span>
        </div>
        <div class="rb-field">
          <label>Email Subject</label>
          <input type="text" [(ngModel)]="scheduleForm.emailSubject"
            placeholder="Weekly Sales Report — FormForge" />
        </div>
      </div>
      <div class="rb-modal-footer">
        <button class="rb-btn rb-btn--outline" (click)="showScheduleModal=false">Cancel</button>
        <button class="rb-btn rb-btn--primary" (click)="saveSchedule()" [disabled]="savingSchedule">
          {{ savingSchedule ? 'Saving…' : '✓ Save Schedule' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="rb-toast" [class.show]="toastVisible" [class.err]="toastError">{{ toastMsg }}</div>

</div>
  `,
  styles: [`
    .rb-shell{flex:1;display:flex;flex-direction:column;background:#f0f2f5;font-family:inherit;min-height:0}

    /* List view */
    .rb-list{padding:28px 32px;max-width:1000px;margin:0 auto;width:100%;flex:1;overflow-y:auto;min-height:0}
    .rb-list-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;
      h1{font-size:22px;font-weight:500;margin:0 0 4px}
      p{font-size:13px;color:var(--color-text-secondary)}
    }
    .rb-empty{text-align:center;padding:80px 20px;
      .rb-empty-icon{font-size:48px;color:#94a3b8}
      h3{font-size:18px;font-weight:500;margin:12px 0 8px}
      p{font-size:13px;color:#94a3b8;margin-bottom:20px}
    }
    .rb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
    .rb-card{background:white;border:0.5px solid var(--color-border-tertiary);border-radius:12px;padding:16px 18px}
    .rb-card__header{display:flex;gap:12px;align-items:flex-start;margin-bottom:8px}
    .rb-card__icon{font-size:24px;color:#2563eb;flex-shrink:0}
    .rb-card__name{font-size:14px;font-weight:500}
    .rb-card__src{font-size:12px;font-family:monospace;color:#2563eb;margin-top:2px}
    .rb-card__desc{font-size:12px;color:var(--color-text-secondary);margin-bottom:8px}
    .rb-card__meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    .rb-chip{font-size:10px;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:99px}
    .rb-chip--sched{background:#eff6ff;color:#1d4ed8}
    .rb-card__actions{display:flex;gap:6px}
    .rb-act-btn{padding:5px 12px;border:0.5px solid var(--color-border-secondary);background:white;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;color:var(--color-text-secondary);transition:.15s;
      &:hover{background:var(--color-background-secondary)}
    }
    .rb-act-btn--run:hover{background:#eff6ff;color:#2563eb;border-color:#2563eb}
    .rb-act-btn--del:hover{background:#fef2f2;color:#dc2626;border-color:#dc2626}

    /* Buttons */
    .rb-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:none;font-family:inherit;transition:.15s}
    .rb-btn--primary{background:#2563eb;color:white}
    .rb-btn--primary:hover{background:#1d4ed8}
    .rb-btn--primary:disabled{opacity:.5;cursor:not-allowed}
    .rb-btn--outline{background:transparent;border:1.5px solid var(--color-border-secondary);color:var(--color-text-secondary)}
    .rb-btn--outline:hover{background:var(--color-background-secondary)}
    .rb-btn--outline:disabled{opacity:.4;cursor:not-allowed}
    .rb-btn--sm{padding:6px 14px;font-size:12px}

    /* Builder */
    .rb-builder{flex:1;display:flex;flex-direction:column;min-height:0}
    .rb-builder-bar{display:flex;align-items:center;gap:10px;padding:0 16px;height:50px;background:white;border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0}
    .rb-back-btn{padding:5px 10px;border:0.5px solid var(--color-border-secondary);background:transparent;border-radius:6px;font-size:12px;cursor:pointer;color:var(--color-text-secondary);font-family:inherit;white-space:nowrap;&:hover{background:var(--color-background-secondary)}}
    .rb-name-input{padding:7px 12px;border:1.5px solid var(--color-border-secondary);border-radius:8px;font-size:14px;font-weight:500;font-family:inherit;outline:none;color:var(--color-text-primary);width:260px;&:focus{border-color:#2563eb}}
    .rb-bar-spacer{flex:1}

    .rb-builder-body{flex:1;display:flex;min-height:0}

    /* Step nav */
    .rb-step-nav{width:220px;background:white;border-right:0.5px solid var(--color-border-tertiary);padding:16px 0;flex-shrink:0;overflow-y:auto}
    .rb-step-item{display:flex;gap:12px;padding:12px 16px;cursor:pointer;transition:.15s;align-items:flex-start;
      &:hover{background:var(--color-background-secondary)}
      &.active{background:#eff6ff}
    }
    .rb-step-dot{width:24px;height:24px;border-radius:50%;background:var(--color-background-secondary);border:1.5px solid var(--color-border-secondary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;flex-shrink:0;color:var(--color-text-secondary);
      .rb-step-item.active &{background:#2563eb;border-color:#2563eb;color:white}
      .rb-step-item.done &{background:#16a34a;border-color:#16a34a;color:white}
    }
    .rb-step-name{font-size:13px;font-weight:500;color:var(--color-text-primary)}
    .rb-step-summary{font-size:11px;color:var(--color-text-secondary);margin-top:2px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    /* Step content */
    .rb-step-content{flex:1;overflow-y:auto;padding:24px 28px}
    .rb-step-body{max-width:900px;
      h3{font-size:16px;font-weight:500;margin-bottom:18px}
    }
    .rb-optional{font-size:12px;font-weight:400;color:var(--color-text-secondary)}
    .rb-section-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-secondary);margin-bottom:8px;display:flex;align-items:center;gap:10px}
    .rb-field-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;.rb-field{flex:1;min-width:160px}}
    .rb-field{display:flex;flex-direction:column;gap:5px;
      label{font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-secondary)}
      input,select{padding:9px 12px;border:1.5px solid var(--color-border-secondary);border-radius:8px;font-size:13px;font-family:inherit;outline:none;color:var(--color-text-primary);background:var(--color-background-primary);&:focus{border-color:#2563eb}&:disabled{opacity:.5;cursor:not-allowed}}
    }
    .rb-field--sm{max-width:120px}

    .rb-hint{font-size:11px;color:var(--color-text-secondary)}
    .rb-input-row{display:flex;border:1.5px solid var(--color-border-secondary);border-radius:8px;overflow:hidden;&:focus-within{border-color:#2563eb}
      input{flex:1;padding:9px 12px;border:none;outline:none;font-size:13px;font-family:inherit;color:var(--color-text-primary);background:transparent}
    }
    .rb-browse{padding:9px 12px;border:none;border-left:1px solid var(--color-border-secondary);background:var(--color-background-secondary);cursor:pointer;color:var(--color-text-secondary);font-size:14px;&:hover:not(:disabled){background:#eff6ff;color:#2563eb}&:disabled{opacity:.4}}
    .rb-dropdown{border:0.5px solid var(--color-border-secondary);border-radius:8px;background:var(--color-background-primary);box-shadow:0 8px 24px rgba(0,0,0,.1);max-height:180px;overflow-y:auto;margin-top:4px;div{padding:8px 12px;font-size:13px;cursor:pointer;color:var(--color-text-primary);&:hover{background:#eff6ff;color:#2563eb}}}

    /* Join row */
    .rb-join-row{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
    .rb-join-type{padding:8px 10px;border:1.5px solid var(--color-border-secondary);border-radius:8px;font-size:12px;font-family:inherit;font-weight:600;color:#2563eb;background:#eff6ff;outline:none;cursor:pointer}
    .rb-col-select{padding:8px 10px;border:1.5px solid var(--color-border-secondary);border-radius:8px;font-size:12px;font-family:inherit;outline:none;color:var(--color-text-primary);background:var(--color-background-primary);width:100%}
    .rb-on-label,.rb-eq{font-size:12px;font-weight:600;color:var(--color-text-secondary);white-space:nowrap}
    .rb-add-btn{padding:4px 12px;border:1.5px dashed var(--color-border-secondary);background:transparent;border-radius:6px;font-size:12px;cursor:pointer;color:#2563eb;font-family:inherit;&:hover{background:#eff6ff}&:disabled{opacity:.4;cursor:not-allowed}}
    .rb-del-btn{width:28px;height:28px;border:0.5px solid var(--color-border-secondary);background:white;border-radius:6px;cursor:pointer;font-size:13px;color:var(--color-text-secondary);&:hover{background:#fef2f2;color:#dc2626}}

    /* Column table */
    .rb-col-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:14px}
    .rb-sm-btn{padding:5px 12px;border:0.5px solid var(--color-border-secondary);background:transparent;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;color:var(--color-text-secondary);&:hover{background:var(--color-background-secondary)}}
    .rb-col-count{font-size:12px;color:var(--color-text-secondary)}
    .rb-col-table-wrap{margin-bottom:20px}
    .rb-col-table-name{font-size:12px;font-weight:600;color:#2563eb;background:#eff6ff;border-radius:6px;padding:6px 12px;margin-bottom:6px;font-family:monospace}
    .rb-col-grid{border:0.5px solid var(--color-border-tertiary);border-radius:8px;overflow:hidden}
    .rb-col-grid-header,.rb-col-grid-row{display:grid;grid-template-columns:40px 1fr 100px 120px 130px;gap:8px;padding:8px 12px;align-items:center}
    .rb-col-grid-header{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;background:var(--color-background-secondary)}
    .rb-col-grid-row{border-top:0.5px solid var(--color-border-tertiary);font-size:12px;&:hover{background:var(--color-background-secondary)}&.col-selected{background:#f0f9ff}}
    .rb-col-name{font-weight:500;display:flex;align-items:center;gap:6px}
    .rb-pk-badge{font-size:9px;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:3px;font-weight:700}
    .rb-col-type{color:var(--color-text-secondary);font-size:11px;font-family:monospace}
    .rb-alias-input,.rb-agg-select{padding:5px 8px;border:1px solid var(--color-border-secondary);border-radius:5px;font-size:11px;font-family:inherit;outline:none;background:var(--color-background-primary);color:var(--color-text-primary);&:focus{border-color:#2563eb}&:disabled{opacity:.4}}

    /* Filter row */
    .rb-filter-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
    .rb-filter-sel{padding:7px 10px;border:1.5px solid var(--color-border-secondary);border-radius:7px;font-size:12px;font-family:inherit;outline:none;background:var(--color-background-primary);color:var(--color-text-primary)}
    .rb-filter-op{padding:7px 10px;border:1.5px solid var(--color-border-secondary);border-radius:7px;font-size:12px;font-family:inherit;outline:none;background:var(--color-background-primary);color:var(--color-text-primary);min-width:140px}
    .rb-filter-val{padding:7px 10px;border:1.5px solid var(--color-border-secondary);border-radius:7px;font-size:12px;font-family:inherit;outline:none;background:var(--color-background-primary);color:var(--color-text-primary);width:160px;&:focus{border-color:#2563eb}}
    .rb-empty-hint{font-size:12px;color:var(--color-text-secondary);padding:12px 0;font-style:italic}

    /* Sort row */
    .rb-sort-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}

    /* Preview */
    .rb-preview-step{max-width:100%!important}
    .rb-preview-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;
      h3{font-size:15px;font-weight:500;margin:0}
    }
    .rb-preview-actions{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap}
    .rb-row-count{font-size:12px;color:var(--color-text-secondary);font-weight:400}
    .rb-sql-box{background:#0f172a;border-radius:8px;padding:14px;margin-bottom:14px;overflow-x:auto;
      pre{font-family:monospace;font-size:12px;color:#7dd3fc;white-space:pre-wrap;word-break:break-all}
    }
    .rb-preview-loading{display:flex;align-items:center;gap:12px;padding:40px;color:var(--color-text-secondary);font-size:13px}
    .rb-spinner{width:28px;height:28px;border:2.5px solid var(--color-border-tertiary);border-top-color:#2563eb;border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .rb-preview-error{background:#fef2f2;border:0.5px solid #fca5a5;border-radius:8px;padding:12px 16px;color:#dc2626;font-size:13px;margin-bottom:14px}
    .rb-results-wrap{display:flex;flex-direction:column;gap:0;border:0.5px solid var(--color-border-tertiary);border-radius:10px;overflow:hidden}
    .rb-results-toolbar{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--color-background-secondary);border-bottom:0.5px solid var(--color-border-tertiary)}
    .rb-grid-search{padding:6px 12px;border:0.5px solid var(--color-border-secondary);border-radius:6px;font-size:12px;font-family:inherit;outline:none;width:220px;background:var(--color-background-primary);color:var(--color-text-primary);&:focus{border-color:#2563eb}}
    .rb-results-info{font-size:12px;color:var(--color-text-secondary);margin-left:auto}
    .rb-grid-wrap{overflow-x:auto;max-height:400px;overflow-y:auto}
    .rb-grid{width:100%;border-collapse:collapse;font-size:12px;
      th{padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;background:var(--color-background-secondary);border-bottom:0.5px solid var(--color-border-tertiary);white-space:nowrap;cursor:pointer;user-select:none;&:hover{background:var(--color-background-primary)}&.sorted{color:#2563eb}}
      td{padding:7px 12px;border-bottom:0.5px solid var(--color-border-tertiary);color:var(--color-text-primary);white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}
      tr:hover td{background:var(--color-background-secondary)}
    }
    .rb-grid-pager{display:flex;align-items:center;justify-content:center;gap:12px;padding:10px;border-top:0.5px solid var(--color-border-tertiary);font-size:12px;color:var(--color-text-secondary);
      button{padding:4px 12px;border:0.5px solid var(--color-border-secondary);background:var(--color-background-primary);border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;&:hover:not(:disabled){background:var(--color-background-secondary)}&:disabled{opacity:.35;cursor:not-allowed}}
    }

    /* Nav buttons */
    .rb-nav-btns{display:flex;gap:10px;margin-top:24px;padding-top:20px;border-top:0.5px solid var(--color-border-tertiary)}

    /* Modal */
    .rb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px}
    .rb-modal{background:var(--color-background-primary);border-radius:14px;width:100%;max-width:500px;box-shadow:0 24px 48px rgba(0,0,0,.2);animation:su .2s ease;overflow:hidden}
    @keyframes su{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    .rb-modal-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:0.5px solid var(--color-border-tertiary);
      h3{font-size:14px;font-weight:500;margin:0}
      button{width:26px;height:26px;border:none;background:var(--color-background-secondary);border-radius:50%;cursor:pointer;font-size:12px;color:var(--color-text-secondary)}
    }
    .rb-modal-body{padding:18px 20px;display:flex;flex-direction:column;gap:14px}
    .rb-modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:0.5px solid var(--color-border-tertiary)}

    /* Toast */
    .rb-toast{position:fixed;bottom:24px;right:24px;background:#0f172a;color:white;padding:12px 20px;border-radius:8px;font-size:13px;opacity:0;transform:translateY(8px);transition:.25s;pointer-events:none;z-index:9999;&.show{opacity:1;transform:none}&.err{background:#dc2626}}
  `]
})
export class ReportBuilderComponent implements OnInit {
  private http = inject(HttpClient);
  private api  = environment.apiBase;

  view: 'list' | 'builder' = 'list';
  loading = false;
  saving  = false;

  reports: Report[] = [];
  connections: SavedConnection[] = [];

  // Builder state
  editingReportId?: number;
  reportName = '';
  selectedConnectionId = 0;
  selectedDatabase = '';
  selectedSchema   = 'dbo';

  activeStep: BuilderStep = 'connection';
  steps = [
    { key: 'connection' as BuilderStep, num: '1', label: 'Connection' },
    { key: 'tables'     as BuilderStep, num: '2', label: 'Tables & Joins' },
    { key: 'columns'    as BuilderStep, num: '3', label: 'Columns' },
    { key: 'filters'    as BuilderStep, num: '4', label: 'Filters' },
    { key: 'sort'       as BuilderStep, num: '5', label: 'Sort & Limit' },
    { key: 'preview'    as BuilderStep, num: '6', label: 'Preview' },
  ];

  queryConfig: QueryConfig = this.emptyConfig();
  tableColumns: Record<string, TableColumnInfo[]> = {};

  // Browse state
  dbList: string[] = [];
  tableList: string[] = [];
  showDbList = false;
  showTableList: string | false = false;
  loadingDbs = false;
  loadingTables = false;

  // Preview
  previewResult?: RunResult;
  previewLoading = false;
  previewError   = '';
  generatedSql   = '';
  showSql        = false;
  gridSearch     = '';
  sortCol        = '';
  sortDir: 'asc' | 'desc' = 'asc';
  gridPage       = 1;
  gridPageSize   = 50;

  // Schedule
  showScheduleModal = false;
  savingSchedule    = false;
  scheduleForm = { frequency: 'Daily', dayOfWeek: 1, dayOfMonth: 1, runAtHour: 8, emailTo: '', emailSubject: '' };
  hours = Array.from({ length: 24 }, (_, i) => i);

  // Toast
  toastMsg = ''; toastError = false; toastVisible = false;

  ngOnInit() { this.loadReports(); this.loadConnections(); }

  loadReports() {
    this.loading = true;
    this.http.get<any>(`${this.api}/api/reports`).subscribe({
      next: r => { this.reports = r.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadConnections() {
    this.http.get<any>(`${this.api}/api/connections`).subscribe({
      next: r => { this.connections = r.data; }
    });
  }

  // ---- List actions ----
  newReport() {
    this.editingReportId = undefined;
    this.reportName = 'Untitled Report';
    this.selectedConnectionId = 0;
    this.selectedDatabase = '';
    this.selectedSchema   = 'dbo';
    this.queryConfig  = this.emptyConfig();
    this.tableColumns = {};
    this.previewResult = undefined;
    this.activeStep = 'connection';
    this.view = 'builder';
  }

  openReport(r: Report) {
    this.editingReportId = r.id;
    this.reportName           = r.name;
    this.selectedConnectionId = r.externalConnectionId;
    this.selectedDatabase     = r.databaseName;
    this.selectedSchema       = r.schemaName;
    try { this.queryConfig = JSON.parse(r.queryConfig); }
    catch { this.queryConfig = this.emptyConfig(); }
    this.generatedSql  = r.lastGeneratedSql || '';
    this.previewResult = undefined;
    this.activeStep    = 'connection';
    this.view = 'builder';
    this.loadAllTableColumns();
  }

  backToList() { this.view = 'list'; this.loadReports(); }

  deleteReport(r: Report) {
    if (!confirm(`Delete "${r.name}"?`)) return;
    this.http.delete<any>(`${this.api}/api/reports/${r.id}`)
      .subscribe({ next: () => { this.loadReports(); this.toast('Report deleted'); } });
  }

  runAndView(r: Report) {
    this.openReport(r);
    setTimeout(() => { this.activeStep = 'preview'; this.runPreview(); }, 200);
  }

  exportExcel(id: number) {
    window.open(`${this.api}/api/reports/${id}/export/excel`, '_blank');
  }

  // ---- Builder actions ----
  saveReport() {
    if (!this.reportName || !this.selectedConnectionId || !this.queryConfig.primaryTable) {
      this.toast('Please complete connection, database and primary table first', true); return;
    }
    this.saving = true;
    const selectedCols = this.queryConfig.columns.filter(c => c.selected !== false);
    const payload = {
      name: this.reportName,
      description: null,
      externalConnectionId: Number(this.selectedConnectionId),
      databaseName: this.selectedDatabase,
      schemaName:   this.selectedSchema || 'dbo',
      queryConfig:  JSON.stringify({ ...this.queryConfig, columns: selectedCols })
    };

    const obs = this.editingReportId
      ? this.http.put<any>(`${this.api}/api/reports/${this.editingReportId}`, payload)
      : this.http.post<any>(`${this.api}/api/reports`, payload);

    obs.subscribe({
      next: r => {
        this.saving = false;
        this.editingReportId = r.data.id;
        this.toast('Report saved!');
      },
      error: () => { this.saving = false; this.toast('Save failed', true); }
    });
  }

  // ---- Connection/DB/Table browsing ----
  onConnectionChange() {
    this.selectedDatabase = '';
    this.queryConfig = this.emptyConfig();
    this.tableColumns = {};
    this.dbList = [];
    this.showDbList = false;
  }

  browseDatabases() {
    if (!this.selectedConnectionId) return;
    this.loadingDbs = true;
    this.http.get<any>(`${this.api}/api/connections/${this.selectedConnectionId}/databases`)
      .subscribe({
        next: r => { this.dbList = r.data; this.showDbList = true; this.loadingDbs = false; },
        error: () => { this.loadingDbs = false; }
      });
  }

  selectDatabase(db: string) {
    this.selectedDatabase = db;
    this.showDbList = false;
    this.queryConfig.primaryTable = '';
    this.queryConfig.joins = [];
    this.tableColumns = {};
  }

  onDatabaseChange() {
    this.queryConfig.primaryTable = '';
    this.queryConfig.joins = [];
    this.tableColumns = {};
    this.showDbList = false;
  }

  browseAllTables(context: string) {
    if (!this.selectedDatabase) return;
    this.loadingTables = true;
    this.http.get<any>(`${this.api}/api/reports/meta/tables`, {
      params: { connId: this.selectedConnectionId, db: this.selectedDatabase, schema: this.selectedSchema || 'dbo' }
    }).subscribe({
      next: r => { this.tableList = r.data; this.showTableList = context; this.loadingTables = false; },
      error: () => { this.loadingTables = false; }
    });
  }

  selectPrimaryTable(t: string) {
    this.queryConfig.primaryTable = t;
    this.showTableList = false;
    this.loadTableColumns(t);
    this.initColumnsForTable(t);
  }

  addJoin() {
    this.queryConfig.joins.push({ table: '', alias: '', joinType: 'INNER', leftColumn: '', rightColumn: '' });
  }

  removeJoin(i: number) { this.queryConfig.joins.splice(i, 1); }

  onPrimaryTableChange() {
    this.loadTableColumns(this.queryConfig.primaryTable);
    this.initColumnsForTable(this.queryConfig.primaryTable);
  }

  onJoinTableChange(i: number) {
    const t = this.queryConfig.joins[i].table;
    if (t) { this.loadTableColumns(t); this.initColumnsForTable(t); }
  }

  selectJoinTable(i: number, t: string) {
    this.queryConfig.joins[i].table = t;
    this.showTableList = false;
    this.loadTableColumns(t);
    this.initColumnsForTable(t);
  }

  loadTableColumns(table: string) {
    if (!table || this.tableColumns[table]) return;
    this.http.get<any>(`${this.api}/api/reports/meta/columns`, {
      params: { connId: this.selectedConnectionId, db: this.selectedDatabase, schema: this.selectedSchema || 'dbo', table }
    }).subscribe({ next: r => { this.tableColumns[table] = r.data; } });
  }

  loadAllTableColumns() {
    const tables = [this.queryConfig.primaryTable, ...this.queryConfig.joins.map(j => j.table)].filter(Boolean);
    tables.forEach(t => this.loadTableColumns(t));
  }

  initColumnsForTable(table: string) {
    // Called when a new table is picked — adds all its columns as unselected
    setTimeout(() => {
      if (!this.tableColumns[table]) return;
      const existing = this.queryConfig.columns.filter(c => c.table === table);
      if (existing.length > 0) return;
      this.tableColumns[table].forEach(col => {
        this.queryConfig.columns.push({
          table, column: col.columnName,
          alias: '', aggregation: '', selected: false
        });
      });
    }, 500);
  }

  goToColumns() {
    this.loadAllTableColumns();
    this.activeStep = 'columns';
  }

  // ---- Column management ----
  get allTables(): string[] {
    return [this.queryConfig.primaryTable, ...this.queryConfig.joins.map(j => j.table)].filter(Boolean);
  }

  getTableCols(table: string): TableColumnInfo[] {
    return this.tableColumns[table] || [];
  }

  isColumnSelected(table: string, column: string): boolean {
    return this.queryConfig.columns.some(c => c.table === table && c.column === column && c.selected !== false);
  }

  getColumnConfig(table: string, column: string): ColumnConfig | undefined {
    return this.queryConfig.columns.find(c => c.table === table && c.column === column);
  }

  toggleColumn(table: string, column: string, e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    const existing = this.queryConfig.columns.find(c => c.table === table && c.column === column);
    if (existing) { existing.selected = checked; }
    else if (checked) {
      this.queryConfig.columns.push({ table, column, alias: '', aggregation: '', selected: true });
    }
  }

  setColumnAlias(table: string, column: string, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    const cfg = this.getColumnConfig(table, column);
    if (cfg) cfg.alias = val;
  }

  setColumnAgg(table: string, column: string, e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    const cfg = this.getColumnConfig(table, column);
    if (cfg) cfg.aggregation = val;
  }

  selectAllColumns() {
    this.queryConfig.columns.forEach(c => c.selected = true);
    this.allTables.forEach(t => {
      (this.tableColumns[t] || []).forEach(col => {
        if (!this.queryConfig.columns.find(c => c.table === t && c.column === col.columnName)) {
          this.queryConfig.columns.push({ table: t, column: col.columnName, alias: '', aggregation: '', selected: true });
        }
      });
    });
  }

  clearAllColumns() { this.queryConfig.columns.forEach(c => c.selected = false); }

  get selectedColumnCount(): number {
    return this.queryConfig.columns.filter(c => c.selected !== false).length;
  }

  // ---- Filters ----
  addFilter() {
    this.queryConfig.filters.push({
      table: this.queryConfig.primaryTable, column: '', operator: 'eq', value: ''
    });
  }
  removeFilter(i: number) { this.queryConfig.filters.splice(i, 1); }

  // ---- Order By ----
  addOrderBy() {
    this.queryConfig.orderBy.push({ table: this.queryConfig.primaryTable, column: '', direction: 'ASC' });
  }
  removeOrderBy(i: number) { this.queryConfig.orderBy.splice(i, 1); }

  // ---- Preview / Run ----
  runPreview() {
    this.activeStep    = 'preview';
    this.previewLoading = true;
    this.previewError   = '';
    this.previewResult  = undefined;
    this.gridPage       = 1;

    const selectedCols = this.queryConfig.columns.filter(c => c.selected !== false);
    const payload = {
      name: this.reportName,
      externalConnectionId: Number(this.selectedConnectionId),
      databaseName: this.selectedDatabase,
      schemaName:   this.selectedSchema || 'dbo',
      queryConfig:  JSON.stringify({ ...this.queryConfig, columns: selectedCols })
    };

    this.http.post<any>(`${this.api}/api/reports/preview`, payload).subscribe({
      next: r => {
        this.previewResult  = r.data;
        this.generatedSql   = r.data.generatedSql;
        this.previewLoading = false;
      },
      error: err => {
        this.previewLoading = false;
        this.previewError   = err?.error?.message || 'Query failed. Check your configuration.';
      }
    });
  }

  generateSqlPreview() {
    const selectedCols = this.queryConfig.columns.filter(c => c.selected !== false);
    const payload = {
      name: this.reportName,
      externalConnectionId: Number(this.selectedConnectionId),
      databaseName: this.selectedDatabase,
      schemaName:   this.selectedSchema || 'dbo',
      queryConfig:  JSON.stringify({ ...this.queryConfig, columns: selectedCols })
    };
    this.http.post<any>(`${this.api}/api/reports/generate-sql`, payload).subscribe({
      next: r => { this.generatedSql = r.data; this.showSql = true; }
    });
  }

  copySQL() {
    navigator.clipboard.writeText(this.generatedSql)
      .then(() => this.toast('SQL copied!'));
  }

  exportPreviewExcel() {
    if (!this.previewResult || !this.editingReportId) return;
    this.http.post(`${this.api}/api/reports/${this.editingReportId}/export/excel`,
      this.previewResult, { responseType: 'blob' })
      .subscribe(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.reportName.replace(/ /g, '_')}.xlsx`;
        a.click();
      });
  }

  exportPreviewPdf() {
    window.print();
    this.toast('Use browser Print → Save as PDF');
  }

  // ---- Grid ----
  get filteredRows(): Record<string, any>[] {
    if (!this.previewResult) return [];
    const q = this.gridSearch.toLowerCase();
    let rows = !q ? this.previewResult.rows
      : this.previewResult.rows.filter((row: Record<string, any>) =>
          Object.values(row).some(v => v?.toString().toLowerCase().includes(q)));

    if (this.sortCol) {
      rows = [...rows].sort((a, b) => {
        const av = a[this.sortCol] ?? '';
        const bv = b[this.sortCol] ?? '';
        return this.sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    return rows;
  }

  get paginatedRows(): Record<string, any>[] {
    const start = (this.gridPage - 1) * this.gridPageSize;
    return this.filteredRows.slice(start, start + this.gridPageSize);
  }

  get totalGridPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.gridPageSize));
  }

  sortByCol(col: string) {
    if (this.sortCol === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortCol = col; this.sortDir = 'asc'; }
    this.gridPage = 1;
  }

  // ---- Schedule ----
  openScheduleModal(r: Report) {
    if (r.schedule) {
      this.scheduleForm = {
        frequency:    r.schedule.frequency,
        dayOfWeek:    r.schedule.dayOfWeek  || 1,
        dayOfMonth:   r.schedule.dayOfMonth || 1,
        runAtHour:    r.schedule.runAtHour,
        emailTo:      r.schedule.emailTo,
        emailSubject: r.schedule.emailSubject || ''
      };
    }
    this.showScheduleModal = true;
  }

  saveSchedule() {
    if (!this.scheduleForm.emailTo || !this.editingReportId) return;
    this.savingSchedule = true;
    this.http.put<any>(`${this.api}/api/reports/${this.editingReportId}/schedule`,
      this.scheduleForm).subscribe({
        next: () => {
          this.savingSchedule = false;
          this.showScheduleModal = false;
          this.toast('Schedule saved!');
        },
        error: () => { this.savingSchedule = false; }
      });
  }

  // ---- Step helpers ----
  isStepDone(key: BuilderStep): boolean {
    switch (key) {
      case 'connection': return !!this.selectedConnectionId && !!this.selectedDatabase;
      case 'tables':     return !!this.queryConfig.primaryTable;
      case 'columns':    return this.selectedColumnCount > 0;
      case 'filters':    return true;
      case 'sort':       return true;
      case 'preview':    return !!this.previewResult;
    }
  }

  getStepSummary(key: BuilderStep): string {
    switch (key) {
      case 'connection': return this.selectedDatabase || 'Not set';
      case 'tables':     return this.queryConfig.primaryTable
          ? `${this.queryConfig.primaryTable}${this.queryConfig.joins.length > 0 ? ' +' + this.queryConfig.joins.length + ' joins' : ''}`
          : 'Not set';
      case 'columns':    return this.selectedColumnCount > 0 ? `${this.selectedColumnCount} columns` : 'None selected';
      case 'filters':    return this.queryConfig.filters.length > 0 ? `${this.queryConfig.filters.length} filter(s)` : 'None';
      case 'sort':       return `TOP ${this.queryConfig.topN}` + (this.queryConfig.orderBy.length > 0 ? `, ${this.queryConfig.orderBy.length} sort(s)` : '');
      case 'preview':    return this.previewResult ? `${this.previewResult.totalCount} rows` : 'Not run';
    }
  }

  // ---- Helpers ----
  onOverlay(e: Event) {
    if ((e.target as HTMLElement).classList.contains('rb-overlay'))
      this.showScheduleModal = false;
  }

  emptyConfig(): QueryConfig {
    return { primaryTable: '', joins: [], columns: [], filters: [], groupBy: [], orderBy: [], topN: 1000 };
  }

  toast(msg: string, error = false) {
    this.toastMsg = msg; this.toastError = error; this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 3000);
  }
}
