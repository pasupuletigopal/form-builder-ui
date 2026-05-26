// src/app/components/analytics-dashboard.component.ts

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface Dashboard {
  id: number;
  name: string;
  description?: string;
  externalConnectionId: number;
  connectionName: string;
  databaseName: string;
  schemaName: string;
  tableName: string;
  dateColumn?: string;
  widgetCount: number;
}

interface Widget {
  id: number;
  dashboardId: number;
  title: string;
  widgetType: 'KPI' | 'Bar' | 'Line' | 'Pie' | 'Donut' | 'Table' | 'Area' | 'HorizontalBar' | 'StackedBar';
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  config: string;
  sortOrder: number;
  // runtime state
  loading?: boolean;
  data?: any;
  error?: string;
}

interface SavedConnection {
  id: number;
  name: string;
  serverName: string;
}

interface ColumnFilterDto {
  column: string;
  operator: string;
  value: string;
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
<div class="ad-shell">

  <!-- ====== DASHBOARD LIST ====== -->
  <div class="ad-list-view" *ngIf="!activeDashboard">
    <div class="ad-header">
      <div>
        <h1>Analytics</h1>
        <p>Build dashboards from any external SQL Server table</p>
      </div>
      <button class="ad-btn ad-btn--primary" (click)="openCreateDashboard()">
        + New Dashboard
      </button>
    </div>

    <div class="ad-empty" *ngIf="!loading && dashboards.length === 0">
      <div class="ad-empty__icon">⊡</div>
      <h3>No dashboards yet</h3>
      <p>Connect to an external table and build charts for management</p>
      <button class="ad-btn ad-btn--primary" (click)="openCreateDashboard()">
        + Create Dashboard
      </button>
    </div>

    <div class="ad-cards" *ngIf="dashboards.length > 0">
      <div class="ad-card" *ngFor="let db of dashboards"
        (click)="openDashboard(db)">
        <div class="ad-card__top">
          <div class="ad-card__icon">⊞</div>
          <div>
            <div class="ad-card__name">{{ db.name }}</div>
            <div class="ad-card__source">
              {{ db.connectionName }} → {{ db.databaseName }}.{{ db.tableName }}
            </div>
          </div>
        </div>
        <div class="ad-card__meta">
          <span class="ad-chip">{{ db.widgetCount }} widget(s)</span>
          <span class="ad-chip" *ngIf="db.dateColumn">Date: {{ db.dateColumn }}</span>
        </div>
        <div class="ad-card__actions">
          <button class="ad-icon-btn" (click)="editDashboard(db, $event)">✏</button>
          <button class="ad-icon-btn danger"
            (click)="deleteDashboard(db, $event)">⊗</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ====== DASHBOARD CANVAS ====== -->
  <div class="ad-canvas-view" *ngIf="activeDashboard">

    <!-- Canvas top bar -->
    <div class="ad-canvas-bar">
      <button class="ad-back-btn" (click)="closeDashboard()">← Dashboards</button>
      <div class="ad-canvas-bar__center">
        <h2>{{ activeDashboard.name }}</h2>
        <span class="ad-source-badge">
          {{ activeDashboard.connectionName }} → {{ activeDashboard.tableName }}
        </span>
      </div>
      <div class="ad-canvas-bar__actions">
        <!-- Date range filter -->
        <div class="ad-filter-row" *ngIf="activeDashboard.dateColumn">
          <input type="date" [(ngModel)]="dateFrom"
            (change)="refreshAllWidgets()" class="ad-date-input" />
          <span class="ad-filter-sep">to</span>
          <input type="date" [(ngModel)]="dateTo"
            (change)="refreshAllWidgets()" class="ad-date-input" />
          <button class="ad-btn ad-btn--outline ad-btn--sm"
            (click)="clearDates()">Clear</button>
        </div>
        <button class="ad-btn ad-btn--outline ad-btn--sm"
          (click)="showFilterPanel = !showFilterPanel">
          ⊟ Filters {{ activeFilters.length > 0 ? '(' + activeFilters.length + ')' : '' }}
        </button>
        <button class="ad-btn ad-btn--outline ad-btn--sm"
          (click)="exportPDF()">↓ PDF</button>
        <button class="ad-btn ad-btn--primary ad-btn--sm"
          (click)="openAddWidget()">+ Widget</button>
      </div>
    </div>

    <!-- Column filter panel -->
    <div class="ad-filter-panel" *ngIf="showFilterPanel">
      <div class="ad-filter-header">
        <span>Column Filters</span>
        <button class="ad-btn ad-btn--sm ad-btn--outline"
          (click)="addFilter()">+ Add Filter</button>
      </div>
      <div class="ad-filter-list">
        <div class="ad-filter-item" *ngFor="let f of activeFilters; let i = index">
          <select [(ngModel)]="f.column" class="ad-filter-select">
            <option value="">-- Column --</option>
            <option *ngFor="let c of allColumns" [value]="c">{{ c }}</option>
          </select>
          <select [(ngModel)]="f.operator" class="ad-filter-select ad-filter-op">
            <option value="eq">equals</option>
            <option value="neq">not equals</option>
            <option value="contains">contains</option>
            <option value="gt">greater than</option>
            <option value="lt">less than</option>
          </select>
          <input type="text" [(ngModel)]="f.value"
            placeholder="value" class="ad-filter-val" />
          <button class="ad-icon-btn danger" (click)="removeFilter(i)">⊗</button>
        </div>
        <div class="ad-filter-empty" *ngIf="activeFilters.length === 0">
          No filters applied
        </div>
      </div>
      <div class="ad-filter-footer">
        <button class="ad-btn ad-btn--primary ad-btn--sm"
          (click)="applyFilters()">Apply</button>
        <button class="ad-btn ad-btn--outline ad-btn--sm"
          (click)="clearFilters()">Clear All</button>
      </div>
    </div>

    <!-- Widget canvas grid -->
    <div class="ad-canvas" id="dashboardCanvas">
      <div class="ad-canvas-empty"
        *ngIf="widgets.length === 0">
        <div class="ad-canvas-empty__icon">⊞</div>
        <p>Click <strong>+ Widget</strong> to add your first chart or KPI</p>
      </div>

      <div class="ad-grid">
        <div class="ad-widget-cell"
          *ngFor="let w of widgets"
          [style.grid-column]="'span ' + w.width"
          [attr.data-widget-id]="w.id">

          <!-- Widget card -->
          <div class="ad-widget"
            [class.ad-widget--loading]="w.loading">

            <!-- Widget toolbar -->
            <div class="ad-widget-toolbar">
              <span class="ad-widget-title">{{ w.title }}</span>
              <span class="ad-widget-type">{{ w.widgetType }}</span>
              <div class="ad-widget-actions">
                <button class="ad-wbtn" (click)="refreshWidget(w)"
                  title="Refresh">↺</button>
                <button class="ad-wbtn" (click)="editWidget(w)"
                  title="Configure">✏</button>
                <button class="ad-wbtn danger" (click)="deleteWidget(w)"
                  title="Delete">⊗</button>
              </div>
            </div>

            <!-- Loading state -->
            <div class="ad-widget-loading" *ngIf="w.loading">
              <div class="ad-spinner"></div>
            </div>

            <!-- Error state -->
            <div class="ad-widget-error" *ngIf="w.error && !w.loading">
              <span>⚠ {{ w.error }}</span>
              <button (click)="refreshWidget(w)">Retry</button>
            </div>

            <!-- ---- KPI ---- -->
            <div class="ad-kpi" *ngIf="w.widgetType === 'KPI' && w.data && !w.loading"
              [class]="'ad-kpi--' + (w.data.colorScheme || 'blue')">
              <div class="ad-kpi__label">{{ w.data.label }}</div>
              <div class="ad-kpi__value">
                <span class="ad-kpi__prefix">{{ w.data.prefix }}</span>
                {{ w.data.value }}
                <span class="ad-kpi__suffix">{{ w.data.suffix }}</span>
              </div>
            </div>

            <!-- ---- BAR CHART ---- -->
            <div class="ad-chart-wrap"
              *ngIf="w.widgetType === 'Bar' && w.data && !w.loading">
              <canvas [id]="'chart_' + w.id" class="ad-canvas-el"></canvas>
            </div>

            <!-- ---- LINE CHART ---- -->
            <div class="ad-chart-wrap"
              *ngIf="w.widgetType === 'Line' && w.data && !w.loading">
              <canvas [id]="'chart_' + w.id" class="ad-canvas-el"></canvas>
            </div>

            <!-- ---- PIE / DONUT ---- -->
            <div class="ad-chart-wrap ad-chart-wrap--sm"
              *ngIf="(w.widgetType === 'Pie' || w.widgetType === 'Donut') && w.data && !w.loading">
              <canvas [id]="'chart_' + w.id" class="ad-canvas-el"></canvas>
            </div>

            <!-- ---- AREA CHART ---- -->
            <div class="ad-chart-wrap"
              *ngIf="w.widgetType === 'Area' && w.data && !w.loading">
              <canvas [id]="'chart_' + w.id" class="ad-canvas-el"></canvas>
            </div>

            <!-- ---- HORIZONTAL BAR ---- -->
            <div class="ad-chart-wrap"
              *ngIf="w.widgetType === 'HorizontalBar' && w.data && !w.loading">
              <canvas [id]="'chart_' + w.id" class="ad-canvas-el"></canvas>
            </div>

            <!-- ---- STACKED BAR ---- -->
            <div class="ad-chart-wrap"
              *ngIf="w.widgetType === 'StackedBar' && w.data && !w.loading">
              <canvas [id]="'chart_' + w.id" class="ad-canvas-el"></canvas>
            </div>

            <!-- ---- TABLE ---- -->
            <div class="ad-table-wrap"
              *ngIf="w.widgetType === 'Table' && w.data && !w.loading">
              <div class="ad-table-toolbar">
                <input type="text" placeholder="Search…"
                  [(ngModel)]="tableSearch[w.id]"
                  (ngModelChange)="onTableSearchChange(w)"
                  class="ad-table-search" />
                <span class="ad-table-count">
                  {{ getTableCache(w).filtered.length }} of {{ w.data._allRows?.length || w.data.totalCount }} rows
                </span>
                <label class="ad-table-pagesize">
                  <select [(ngModel)]="tablePageSize[w.id]" (ngModelChange)="onTablePageSizeChange(w)">
                    <option [ngValue]="10">10</option>
                    <option [ngValue]="25">25</option>
                    <option [ngValue]="50">50</option>
                    <option [ngValue]="100">100</option>
                  </select>
                </label>
              </div>
              <div class="ad-table-scroll">
                <table class="ad-table">
                  <thead>
                    <tr>
                      <th *ngFor="let col of w.data.columns"
                        (click)="onTableSort(w, col)"
                        [class.sorted]="tableSort[w.id]?.col === col">
                        {{ col }}
                        <span class="ad-sort-arrow" *ngIf="tableSort[w.id]?.col === col">
                          {{ tableSort[w.id]?.dir === 'asc' ? '↑' : '↓' }}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of getTableCache(w).paged"
                      (click)="drillDown(w, row)">
                      <td *ngFor="let col of w.data.columns">
                        {{ row[col] ?? '—' }}
                      </td>
                    </tr>
                    <tr *ngIf="getTableCache(w).paged.length === 0">
                      <td [attr.colspan]="w.data.columns.length" class="ad-no-rows">
                        No matching rows
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="ad-table-pager">
                <button [disabled]="(tablePage[w.id] || 1) <= 1"
                  (click)="tableGoPage(w, 1)" title="First">«</button>
                <button [disabled]="(tablePage[w.id] || 1) <= 1"
                  (click)="tableGoPage(w, (tablePage[w.id] || 1) - 1)">‹ Prev</button>
                <span>Page {{ tablePage[w.id] || 1 }} of {{ getTableCache(w).totalPages }}</span>
                <button [disabled]="(tablePage[w.id] || 1) >= getTableCache(w).totalPages"
                  (click)="tableGoPage(w, (tablePage[w.id] || 1) + 1)">Next ›</button>
                <button [disabled]="(tablePage[w.id] || 1) >= getTableCache(w).totalPages"
                  (click)="tableGoPage(w, getTableCache(w).totalPages)" title="Last">»</button>
              </div>
            </div>

          </div>
        </div>
      </div>

  <!-- ====== CREATE DASHBOARD MODAL ====== -->
  <div class="ad-overlay" *ngIf="showDashboardModal"
    (click)="onOverlay($event, 'dashboard')">
    <div class="ad-modal">
      <div class="ad-modal__header">
        <h3>{{ editingDashboardId ? 'Edit Dashboard' : 'New Dashboard' }}</h3>
        <button (click)="showDashboardModal=false">✕</button>
      </div>
      <div class="ad-modal__body">
        <div class="ad-field">
          <label>Dashboard Name *</label>
          <input type="text" [(ngModel)]="dashForm.name"
            placeholder="e.g. Sales Overview, HR Report" />
        </div>
        <div class="ad-field">
          <label>Description</label>
          <input type="text" [(ngModel)]="dashForm.description"
            placeholder="What does this dashboard show?" />
        </div>
        <div class="ad-field">
          <label>Connection *</label>
          <select [(ngModel)]="dashForm.connectionId"
            (change)="onDashConnectionChange()">
            <option value="">-- Select Connection --</option>
            <option *ngFor="let c of connections" [value]="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="ad-field-row" *ngIf="dashForm.connectionId">
          <div class="ad-field">
            <label>Database *</label>
            <div class="ad-input-row">
              <input type="text" [(ngModel)]="dashForm.database"
                (change)="onDashDbChange()" placeholder="LumiereDB" />
              <button class="ad-browse-btn"
                (click)="browseDatabases()"
                [disabled]="loadingDbs">{{ loadingDbs ? '…' : '⊞' }}</button>
            </div>
            <div class="ad-dropdown" *ngIf="dbList.length > 0 && showDbList">
              <div *ngFor="let db of dbList" (click)="selectDb(db)">{{ db }}</div>
            </div>
          </div>
          <div class="ad-field">
            <label>Schema</label>
            <input type="text" [(ngModel)]="dashForm.schema"
              placeholder="dbo" (change)="onSchemaChange()" />
            <span class="ad-hint">Default: dbo</span>
          </div>
        </div>
        <div class="ad-field-row" *ngIf="dashForm.database">
          <div class="ad-field">
            <label>Table *</label>
            <div class="ad-input-row">
              <input type="text" [(ngModel)]="dashForm.table"
                placeholder="Customers" />
              <button class="ad-browse-btn"
                (click)="browseTables()"
                [disabled]="!dashForm.database || loadingTables">
                {{ loadingTables ? '…' : '⊞' }}
              </button>
            </div>
            <div class="ad-dropdown" *ngIf="tableList.length > 0 && showTableList">
              <div *ngFor="let t of tableList" (click)="selectTable(t)">{{ t }}</div>
            </div>
          </div>
        </div>
        <div class="ad-field" *ngIf="dashForm.table">
          <label>Date Column (for date range filter)</label>
          <div class="ad-input-row">
            <input type="text" [(ngModel)]="dashForm.dateColumn"
              placeholder="CreatedAt" />
            <button class="ad-browse-btn" (click)="browseDateColumns()"
              [disabled]="loadingDateCols">
              {{ loadingDateCols ? '…' : '⊞' }}
            </button>
          </div>
          <div class="ad-dropdown" *ngIf="dateColList.length > 0 && showDateColList">
            <div *ngFor="let c of dateColList" (click)="selectDateCol(c)">{{ c }}</div>
          </div>
          <span class="ad-hint">Optional — enables the date range filter on the dashboard</span>
        </div>
      </div>
      <div class="ad-modal__footer">
        <button class="ad-btn ad-btn--outline" (click)="showDashboardModal=false">Cancel</button>
        <button class="ad-btn ad-btn--primary" (click)="saveDashboard()"
          [disabled]="savingDash">
          {{ savingDash ? 'Saving…' : (editingDashboardId ? 'Update' : 'Create') }}
        </button>
      </div>
    </div>
  </div>

  <!-- ====== ADD/EDIT WIDGET MODAL ====== -->
  <div class="ad-overlay" *ngIf="showWidgetModal"
    (click)="onOverlay($event, 'widget')">
    <div class="ad-modal ad-modal--wide">
      <div class="ad-modal__header">
        <h3>{{ editingWidgetId ? 'Edit Widget' : 'Add Widget' }}</h3>
        <button (click)="showWidgetModal=false">✕</button>
      </div>
      <div class="ad-modal__body">

        <!-- Widget type picker -->
        <div class="ad-field" *ngIf="!editingWidgetId">
          <label>Widget Type *</label>
          <div class="ad-type-grid">
            <div class="ad-type-card"
              *ngFor="let t of widgetTypes"
              [class.selected]="wForm.type === t.type"
              (click)="wForm.type = t.type; onWidgetTypeChange()">
              <span class="wt-icon">{{ t.icon }}</span>
              <span class="wt-name">{{ t.label }}</span>
            </div>
          </div>
        </div>

        <div class="ad-field">
          <label>Title *</label>
          <input type="text" [(ngModel)]="wForm.title"
            placeholder="e.g. Total Revenue, Sales by Category" />
        </div>

        <div class="ad-field-row">
          <div class="ad-field">
            <label>Width (1–12 columns)</label>
            <select [(ngModel)]="wForm.width">
              <option value="3">3 — Quarter</option>
              <option value="4">4 — Third</option>
              <option value="6">6 — Half</option>
              <option value="8">8 — Two thirds</option>
              <option value="12">12 — Full</option>
            </select>
          </div>
        </div>

        <!-- KPI config -->
        <ng-container *ngIf="wForm.type === 'KPI'">
          <div class="ad-field-row">
            <div class="ad-field">
              <label>Aggregation</label>
              <select [(ngModel)]="wConfig.aggregation">
                <option value="COUNT">COUNT (rows)</option>
                <option value="SUM">SUM</option>
                <option value="AVG">AVERAGE</option>
                <option value="MIN">MIN</option>
                <option value="MAX">MAX</option>
              </select>
            </div>
            <div class="ad-field" *ngIf="wConfig.aggregation !== 'COUNT'">
              <label>Value Column</label>
              <select [(ngModel)]="wConfig.valueColumn">
                <option value="">-- Select --</option>
                <option *ngFor="let c of numericColumns" [value]="c">{{ c }}</option>
              </select>
            </div>
          </div>
          <div class="ad-field-row">
            <div class="ad-field">
              <label>Prefix (e.g. $)</label>
              <input type="text" [(ngModel)]="wConfig.prefix" placeholder="$" />
            </div>
            <div class="ad-field">
              <label>Suffix (e.g. %)</label>
              <input type="text" [(ngModel)]="wConfig.suffix" placeholder="%" />
            </div>
            <div class="ad-field">
              <label>Color</label>
              <select [(ngModel)]="wConfig.colorScheme">
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="amber">Amber</option>
                <option value="red">Red</option>
                <option value="purple">Purple</option>
              </select>
            </div>
          </div>
        </ng-container>

        <!-- Bar / Line / Area / HorizontalBar / StackedBar config -->
        <ng-container *ngIf="wForm.type === 'Bar' || wForm.type === 'Line' || wForm.type === 'Area' || wForm.type === 'HorizontalBar' || wForm.type === 'StackedBar'">

          <!-- Data source toggle -->
          <div class="ad-field">
            <label>Data Source</label>
            <div class="ad-datasource-toggle">
              <button class="ad-ds-btn" [class.active]="wConfig.dataSource !== 'json' && wConfig.dataSource !== 'sp'"
                (click)="wConfig.dataSource = 'sql'">SQL Aggregation</button>
              <button class="ad-ds-btn" [class.active]="wConfig.dataSource === 'json'"
                (click)="wConfig.dataSource = 'json'">JSON Data</button>
              <button class="ad-ds-btn" [class.active]="wConfig.dataSource === 'sp'"
                (click)="wConfig.dataSource = 'sp'">Stored Procedure</button>
            </div>
          </div>

          <!-- SQL mode fields -->
          <ng-container *ngIf="wConfig.dataSource !== 'json' && wConfig.dataSource !== 'sp'">
            <div class="ad-field-row">
              <div class="ad-field">
                <label>X Axis (Group By)</label>
                <select [(ngModel)]="wConfig.xColumn">
                  <option value="">-- Select Column --</option>
                  <option *ngFor="let c of allColumns" [value]="c">{{ c }}</option>
                </select>
              </div>
              <div class="ad-field">
                <label>Aggregation</label>
                <select [(ngModel)]="wConfig.aggregation">
                  <option value="COUNT">COUNT</option>
                  <option value="SUM">SUM</option>
                  <option value="AVG">AVG</option>
                </select>
              </div>
              <div class="ad-field" *ngIf="wConfig.aggregation !== 'COUNT'">
                <label>Y Axis (Value Column)</label>
                <select [(ngModel)]="wConfig.yColumn">
                  <option value="">-- Select --</option>
                  <option *ngFor="let c of numericColumns" [value]="c">{{ c }}</option>
                </select>
              </div>
            </div>
            <div class="ad-field-row">
              <div class="ad-field">
                <label>Sort By</label>
                <select [(ngModel)]="wConfig.orderBy">
                  <option value="value_desc">Value (High to Low)</option>
                  <option value="label_asc">Label (A to Z)</option>
                </select>
              </div>
              <div class="ad-field">
                <label>Max Items</label>
                <input type="number" [(ngModel)]="wConfig.limit"
                  min="3" max="50" />
              </div>
            </div>

            <!-- Label Lookup for Bar/Line -->
            <div class="ad-lookup-section">
              <label class="ad-lookup-toggle">
                <input type="checkbox" [(ngModel)]="wConfig.useLookup" />
                <span>Resolve IDs to names from a lookup table</span>
              </label>
              <div *ngIf="wConfig.useLookup" class="ad-lookup-fields">
                <span class="ad-hint">If X Axis is an ID column (e.g. StatusId), map it to a display name from a related table.</span>
                <div class="ad-field-row">
                  <div class="ad-field">
                    <label>Lookup Schema</label>
                    <input type="text" [(ngModel)]="wConfig.lookupSchema"
                      placeholder="dbo" (change)="onLookupSchemaChange()" />
                    <span class="ad-hint">Default: dbo</span>
                  </div>
                  <div class="ad-field">
                    <label>Lookup Table</label>
                    <div class="ad-input-row">
                      <input type="text" [(ngModel)]="wConfig.lookupTable" placeholder="e.g. Statuses" />
                      <button class="ad-browse-btn" (click)="browseLookupTables()" [disabled]="loadingLookupTables">
                        {{ loadingLookupTables ? '…' : '⊞' }}
                      </button>
                    </div>
                    <div class="ad-dropdown" *ngIf="lookupTableList.length > 0 && showLookupTableList">
                      <div *ngFor="let t of lookupTableList" (click)="selectLookupTable(t)">{{ t }}</div>
                    </div>
                  </div>
                </div>
                <div class="ad-field-row" *ngIf="wConfig.lookupTable">
                  <div class="ad-field">
                    <label>ID Column (in lookup table)</label>
                    <div class="ad-input-row">
                      <input type="text" [(ngModel)]="wConfig.lookupValueColumn" placeholder="e.g. Id" />
                      <button class="ad-browse-btn" (click)="browseLookupColumns('value')" [disabled]="loadingLookupCols">
                        {{ loadingLookupCols ? '…' : '⊞' }}
                      </button>
                    </div>
                    <div class="ad-dropdown" *ngIf="lookupColList.length > 0 && showLookupColFor === 'value'">
                      <div *ngFor="let c of lookupColList" (click)="selectLookupCol('value', c)">{{ c }}</div>
                    </div>
                  </div>
                  <div class="ad-field">
                    <label>Name Column (to display)</label>
                    <div class="ad-input-row">
                      <input type="text" [(ngModel)]="wConfig.lookupLabelColumn" placeholder="e.g. Name" />
                      <button class="ad-browse-btn" (click)="browseLookupColumns('label')" [disabled]="loadingLookupCols">
                        {{ loadingLookupCols ? '…' : '⊞' }}
                      </button>
                    </div>
                    <div class="ad-dropdown" *ngIf="lookupColList.length > 0 && showLookupColFor === 'label'">
                      <div *ngFor="let c of lookupColList" (click)="selectLookupCol('label', c)">{{ c }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ng-container>

        </ng-container>

        <!-- JSON data mode -->
        <ng-container *ngIf="wConfig.dataSource === 'json'">
          <div class="ad-field">
            <label>JSON Data</label>
            <textarea class="ad-json-editor" [(ngModel)]="wConfig.jsonData" rows="10"
              [placeholder]="wForm.type === 'StackedBar' ? stackedJsonPlaceholder : chartJsonPlaceholder"></textarea>
            <span class="ad-hint" *ngIf="wForm.type !== 'StackedBar'">
              Provide an array of objects with "label" and "value" keys
            </span>
            <span class="ad-hint" *ngIf="wForm.type === 'StackedBar'">
              Provide labels array and series array with label + values per series
            </span>
          </div>
          <div class="ad-field">
            <button class="ad-btn ad-btn--outline ad-btn--sm" (click)="formatJsonData()">Format JSON</button>
            <button class="ad-btn ad-btn--outline ad-btn--sm" (click)="validateJsonData()"
              style="margin-left:6px">Validate</button>
            <span class="ad-json-status" *ngIf="jsonValidationMsg"
              [class.valid]="jsonValidationOk" [class.invalid]="!jsonValidationOk">
              {{ jsonValidationMsg }}
            </span>
          </div>
        </ng-container>

        <!-- Stored Procedure mode -->
        <ng-container *ngIf="wConfig.dataSource === 'sp'">
          <div class="ad-field">
            <label>Connection *</label>
            <select [(ngModel)]="wConfig.spConnectionId" (ngModelChange)="onSpConnectionChange()">
              <option value="">-- Select Connection --</option>
              <option *ngFor="let c of connections" [value]="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="ad-field-row" *ngIf="wConfig.spConnectionId">
            <div class="ad-field">
              <label>Database *</label>
              <div class="ad-input-row">
                <input type="text" [(ngModel)]="wConfig.spDatabase" placeholder="DatabaseName" />
                <button class="ad-browse-btn" (click)="browseSpDatabases()" [disabled]="loadingSpDbs">
                  {{ loadingSpDbs ? '…' : '⊞' }}
                </button>
              </div>
              <div class="ad-dropdown" *ngIf="spDbList.length > 0 && showSpDbList">
                <div *ngFor="let db of spDbList" (click)="selectSpDb(db)">{{ db }}</div>
              </div>
            </div>
            <div class="ad-field">
              <label>Schema</label>
              <input type="text" [(ngModel)]="wConfig.spSchema" placeholder="dbo" />
            </div>
          </div>
          <div class="ad-field" *ngIf="wConfig.spDatabase">
            <label>Stored Procedure *</label>
            <div class="ad-input-row">
              <input type="text" [(ngModel)]="wConfig.spName" placeholder="usp_GetData" />
              <button class="ad-browse-btn" (click)="browseStoredProcedures()" [disabled]="loadingSpList">
                {{ loadingSpList ? '…' : '⊞' }}
              </button>
            </div>
            <div class="ad-dropdown" *ngIf="spNameList.length > 0 && showSpNameList">
              <div *ngFor="let sp of spNameList" (click)="selectStoredProcedure(sp)">{{ sp }}</div>
            </div>
          </div>
          <div class="ad-sp-params" *ngIf="wConfig.spName && spParams.length > 0">
            <label class="ad-field-label">Parameters</label>
            <div class="ad-sp-param-row" *ngFor="let p of spParams">
              <span class="ad-sp-param-name">{{ p.name }}</span>
              <span class="ad-sp-param-type">{{ p.dataType }}</span>
              <input class="ad-sp-param-val" type="text" [(ngModel)]="p.value"
                [placeholder]="p.hasDefault ? '(default)' : 'required'" />
            </div>
          </div>
          <div class="ad-sp-mapping" *ngIf="wConfig.spName">
            <div class="ad-field-row">
              <div class="ad-field">
                <label>Label Column</label>
                <input type="text" [(ngModel)]="wConfig.spLabelColumn" placeholder="e.g. CategoryName" />
              </div>
              <div class="ad-field">
                <label>Value Column</label>
                <input type="text" [(ngModel)]="wConfig.spValueColumn" placeholder="e.g. TotalAmount" />
              </div>
            </div>
            <div class="ad-field" *ngIf="wForm.type === 'StackedBar'">
              <label>Series Column (for stacking)</label>
              <input type="text" [(ngModel)]="wConfig.spSeriesColumn" placeholder="e.g. ProductLine" />
              <span class="ad-hint">Column to group into separate stacked series</span>
            </div>
            <div class="ad-field">
              <button class="ad-btn ad-btn--outline ad-btn--sm" (click)="testSpExecution()"
                [disabled]="testingSp">
                {{ testingSp ? 'Testing…' : '▶ Test Execute' }}
              </button>
              <span class="ad-json-status valid" *ngIf="spTestResult">{{ spTestResult }}</span>
              <span class="ad-json-status invalid" *ngIf="spTestError">{{ spTestError }}</span>
            </div>
          </div>
        </ng-container>
      </div>
      <div class="ad-modal__footer">
        <button class="ad-btn ad-btn--outline"
          (click)="showWidgetModal=false">Cancel</button>
        <button class="ad-btn ad-btn--primary"
          (click)="saveWidget()" [disabled]="savingWidget">
          {{ savingWidget ? 'Saving…' : (editingWidgetId ? 'Update Widget' : 'Add Widget') }}
        </button>
      </div>
    </div>
  </div>

  <!-- ====== DRILL DOWN MODAL ====== -->
  <div class="ad-overlay" *ngIf="drillDownData"
    (click)="onOverlay($event, 'drilldown')">
    <div class="ad-modal ad-modal--wide">
      <div class="ad-modal__header">
        <h3>Drill Down — {{ drillDownData.filterDescription }}</h3>
        <button (click)="drillDownData=null">✕</button>
      </div>
      <div class="ad-modal__body" style="padding:0">
        <div class="ad-table-scroll" style="max-height:400px">
          <table class="ad-table">
            <thead>
              <tr>
                <th *ngFor="let col of drillDownData.columns">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of drillDownData.rows">
                <td *ngFor="let col of drillDownData.columns">
                  {{ row[col] ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="ad-drill-footer">
          Showing {{ drillDownData.rows.length }} of {{ drillDownData.totalCount }} rows
        </div>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="ad-toast" [class.show]="toastVisible" [class.err]="toastError">
    {{ toastMsg }}
  </div>

</div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }

    .ad-shell { display: flex; flex-direction: column; flex: 1; background: #f0f2f5; font-family: inherit; min-height: 0; overflow: hidden; }
    .ad-list-view { padding: 28px 32px; max-width: 1000px; margin: 0 auto; width: 100%; }
    .ad-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px;
      h1 { font-size: 22px; font-weight: 500; color: var(--color-text-primary, #0f172a); margin: 0 0 4px; }
      p  { font-size: 13px; color: var(--color-text-secondary, #64748b); }
    }
    .ad-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500, cursor: pointer; border: none; font-family: inherit; transition: .15s; }
    .ad-btn--primary { background: #2563eb; color: white; }
    .ad-btn--primary:hover { background: #1d4ed8; }
    .ad-btn--primary:disabled { opacity: .5; cursor: not-allowed; }
    .ad-btn--outline { background: transparent; border: 1.5px solid #e2e8f0; color: #374151; }
    .ad-btn--outline:hover { background: #f8fafc; }
    .ad-btn--sm { padding: 5px 12px; font-size: 12px; }

    .ad-empty { text-align: center; padding: 80px 20px;
      .ad-empty__icon { font-size: 48px; color: #94a3b8; }
      h3 { font-size: 18px; font-weight: 500; color: #374151; margin: 12px 0 8px; }
      p  { font-size: 14px; color: #94a3b8; margin-bottom: 20px; }
    }
    .ad-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .ad-card { background: white; border: 0.5px solid #e5e7eb; border-radius: 12px; padding: 16px 18px; cursor: pointer; transition: .15s;
      &:hover { border-color: #93c5fd; box-shadow: 0 2px 12px rgba(37,99,235,.08); }
    }
    .ad-card__top { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; }
    .ad-card__icon { font-size: 24px; color: #2563eb; flex-shrink: 0; }
    .ad-card__name   { font-size: 14px; font-weight: 500; color: #0f172a; }
    .ad-card__source { font-size: 12px; color: #2563eb; font-family: monospace; margin-top: 2px; }
    .ad-card__meta   { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .ad-chip { font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 10px; border-radius: 99px; }
    .ad-card__actions { display: flex; gap: 6px; justify-content: flex-end; }
    .ad-icon-btn { width: 28px; height: 28px; border: 0.5px solid #e5e7eb; background: white; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: .15s;
      &:hover { background: #eff6ff; }
      &.danger:hover { background: #fef2f2; color: #dc2626; }
    }

    /* Canvas view */
    .ad-canvas-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .ad-canvas-bar { display: flex; align-items: center; gap: 12px; padding: 0 20px; height: 54px; background: white; border-bottom: 0.5px solid #e5e7eb; flex-shrink: 0; flex-wrap: wrap; }
    .ad-back-btn { padding: 6px 12px; border: 0.5px solid #e5e7eb; background: transparent; border-radius: 6px; font-size: 13px; color: #64748b; cursor: pointer; font-family: inherit; white-space: nowrap;
      &:hover { background: #f8fafc; }
    }
    .ad-canvas-bar__center { flex: 1; display: flex; align-items: center; gap: 10px;
      h2 { font-size: 15px; font-weight: 500; white-space: nowrap; }
    }
    .ad-source-badge { font-size: 12px; background: #eff6ff; color: #1d4ed8; padding: 2px 10px; border-radius: 99px; font-family: monospace; }
    .ad-canvas-bar__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ad-filter-row { display: flex; align-items: center; gap: 6px; }
    .ad-filter-sep { font-size: 12px; color: #94a3b8; }
    .ad-date-input { padding: 5px 10px; border: 0.5px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-family: inherit; outline: none; &:focus { border-color: #2563eb; } }

    /* Filter panel */
    .ad-filter-panel { background: white; border-bottom: 0.5px solid #e5e7eb; padding: 12px 20px; flex-shrink: 0; }
    .ad-filter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; font-weight: 500; }
    .ad-filter-list { display: flex; flex-direction: column; gap: 8px; }
    .ad-filter-item { display: flex; gap: 8px; align-items: center; }
    .ad-filter-select { padding: 6px 10px; border: 0.5px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-family: inherit; outline: none; }
    .ad-filter-op { width: 120px; }
    .ad-filter-val { padding: 6px 10px; border: 0.5px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-family: inherit; outline: none; width: 150px; }
    .ad-filter-empty { font-size: 12px; color: #94a3b8; padding: 4px 0; }
    .ad-filter-footer { display: flex; gap: 8px; margin-top: 10px; }

    /* Canvas grid */
    .ad-canvas { flex: 1; overflow-y: auto; padding: 20px; }
    .ad-canvas-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px; text-align: center;
      .ad-canvas-empty__icon { font-size: 48px; color: #94a3b8; }
      p { font-size: 14px; color: #94a3b8; margin-top: 12px; strong { color: #374151; } }
    }
    .ad-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; }
    .ad-widget-cell { min-height: 160px; }
    .ad-widget { background: white; border: 0.5px solid #e5e7eb; border-radius: 12px; height: 100%; display: flex; flex-direction: column; overflow: hidden; transition: .15s;
      &:hover .ad-widget-toolbar { background: #f8fafc; }
    }
    .ad-widget--loading { opacity: .6; }

    .ad-widget-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 0.5px solid #f1f5f9; flex-shrink: 0; }
    .ad-widget-title { font-size: 13px; font-weight: 500; color: #0f172a; flex: 1; }
    .ad-widget-type { font-size: 10px; background: #f1f5f9; color: #64748b; padding: 1px 8px; border-radius: 99px; }
    .ad-widget-actions { display: flex; gap: 4px; }
    .ad-wbtn { width: 24px; height: 24px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #94a3b8; border-radius: 4px; transition: .1s;
      &:hover { background: #eff6ff; color: #2563eb; }
      &.danger:hover { background: #fef2f2; color: #dc2626; }
    }
    .ad-widget-loading { flex: 1; display: flex; align-items: center; justify-content: center; }
    .ad-spinner { width: 28px; height: 28px; border: 2.5px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .ad-widget-error { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 20px; font-size: 12px; color: #dc2626;
      button { padding: 4px 12px; border: 0.5px solid #fca5a5; background: transparent; border-radius: 6px; cursor: pointer; font-size: 12px; color: #dc2626; font-family: inherit; }
    }

    /* KPI widget */
    .ad-kpi { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center;
      .ad-kpi__label { font-size: 13px; color: #64748b; margin-bottom: 8px; }
      .ad-kpi__value { font-size: 36px; font-weight: 500; letter-spacing: -0.02em; }
      .ad-kpi__prefix, .ad-kpi__suffix { font-size: 20px; opacity: .7; }
    }
    .ad-kpi--blue   .ad-kpi__value { color: #185FA5; }
    .ad-kpi--green  .ad-kpi__value { color: #3B6D11; }
    .ad-kpi--amber  .ad-kpi__value { color: #854F0B; }
    .ad-kpi--red    .ad-kpi__value { color: #A32D2D; }
    .ad-kpi--purple .ad-kpi__value { color: #534AB7; }

    /* Chart */
    .ad-chart-wrap { flex: 1; padding: 12px 14px; min-height: 180px; position: relative; }
    .ad-chart-wrap--sm { min-height: 160px; }
    .ad-canvas-el { width: 100% !important; }

    /* Table widget */
    .ad-table-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .ad-table-toolbar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 0.5px solid #f1f5f9; flex-shrink: 0; }
    .ad-table-search { padding: 5px 10px; border: 0.5px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-family: inherit; outline: none; flex: 1; &:focus { border-color: #2563eb; } }
    .ad-table-count { font-size: 11px; color: #94a3b8; white-space: nowrap; }
    .ad-table-pagesize { font-size: 12px; color: #374151; border: 0.5px solid #e2e8f0; border-radius: 6px; overflow: hidden;
      select { padding: 4px 8px; border: none; outline: none; font-size: 12px; color: #0f172a; background: transparent; cursor: pointer; }
    }
    .ad-table-scroll { flex: 1; overflow: auto; }
    .ad-table { width: 100%; border-collapse: collapse; font-size: 12px;
      th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; background: #f8fafc; border-bottom: 0.5px solid #e5e7eb; white-space: nowrap; }
      td { padding: 7px 10px; border-bottom: 0.5px solid #f1f5f9; color: #374151; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      tr:hover td { background: #f8fafc; cursor: pointer; }
    }
    .ad-table-pager { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 8px; border-top: 0.5px solid #f1f5f9; font-size: 12px; color: #64748b; flex-shrink: 0;
      button { padding: 3px 10px; border: 0.5px solid #e2e8f0; background: white; border-radius: 4px; cursor: pointer; &:hover:not(:disabled) { background: #f1f5f9; } &:disabled { opacity: .35; cursor: not-allowed; } }
    }

    /* Modals */
    .ad-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 16px; backdrop-filter: blur(4px); }
    .ad-modal { background: white; border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 48px rgba(0,0,0,.2); animation: slideUp .2s ease; }
    .ad-modal--wide { max-width: 680px; }
    @keyframes slideUp { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: none; } }
    .ad-modal__header { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 0.5px solid #e5e7eb;
      h3 { font-size: 15px; font-weight: 500; color: #0f172a; margin: 0; }
      button { width: 28px; height: 28px; border: none; background: #f1f5f9; border-radius: 50%; cursor: pointer; font-size: 13px; color: #64748b; &:hover { background: #fef2f2; color: #ef4444; } }
    }
    .ad-modal__body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
    .ad-modal__footer { display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px; border-top: 0.5px solid #e5e7eb; }

    /* Form fields in modal */
    .ad-field { display: flex; flex-direction: column; gap: 5px;
      label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
      input, select { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-family: inherit; outline: none; color: #0f172a; &:focus { border-color: #2563eb; } }
    }
    .ad-field-row { display: flex; gap: 12px; .ad-field { flex: 1; } }
    .ad-hint { font-size: 11px; color: #94a3b8; }
    .ad-input-row { display: flex; border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden; &:focus-within { border-color: #2563eb; }
      input { flex: 1; padding: 9px 12px; border: none; outline: none; font-size: 13px; font-family: inherit; }
    }
    .ad-browse-btn { padding: 9px 12px; border: none; border-left: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; color: #64748b; &:hover:not(:disabled) { background: #eff6ff; color: #2563eb; } &:disabled { opacity: .4; } }
    .ad-dropdown { border: 0.5px solid #e2e8f0; border-radius: 8px; background: white; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 180px; overflow-y: auto; margin-top: 4px;
      div { padding: 9px 14px; font-size: 13px; cursor: pointer; &:hover { background: #eff6ff; color: #2563eb; } }
    }

    /* Widget type picker */
    .ad-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .ad-type-card { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; transition: .15s;
      &.selected { border-color: #2563eb; background: #eff6ff; }
      &:hover:not(.selected) { border-color: #93c5fd; }
      .wt-icon { font-size: 20px; }
      .wt-name { font-size: 11px; font-weight: 500; color: #374151; }
    }

    /* Column picker */
    .ad-col-picker { display: flex; flex-wrap: wrap; gap: 8px; max-height: 120px; overflow-y: auto; padding: 4px 0; }
    .ad-col-check { display: flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;
      input { width: 14px; height: 14px; accent-color: #2563eb; cursor: pointer; }
    }

    /* Lookup section */
    .ad-lookup-section { margin-top: 8px; padding: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; }
    .ad-lookup-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #374151; font-weight: 500;
      input { width: 15px; height: 15px; accent-color: #2563eb; cursor: pointer; }
    }
    .ad-lookup-fields { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }

    /* Data source toggle */
    .ad-datasource-toggle { display: flex; border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .ad-ds-btn { flex: 1; padding: 8px 14px; border: none; background: transparent; font-size: 12px; font-weight: 500; color: #64748b; cursor: pointer; font-family: inherit; transition: .15s;
      &.active { background: #2563eb; color: white; }
      &:hover:not(.active) { background: #f8fafc; }
    }

    /* JSON editor */
    .ad-json-editor { width: 100%; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 12px; font-family: monospace; outline: none; resize: vertical; color: #0f172a; line-height: 1.5;
      &:focus { border-color: #2563eb; }
    }
    .ad-json-status { font-size: 11px; margin-left: 8px; font-weight: 500;
      &.valid { color: #16a34a; }
      &.invalid { color: #dc2626; }
    }

    /* Stored Procedure config */
    .ad-sp-params { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; }
    .ad-field-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 4px; }
    .ad-sp-param-row { display: grid; grid-template-columns: 140px 80px 1fr; gap: 8px; align-items: center; }
    .ad-sp-param-name { font-size: 12px; font-weight: 500; color: #374151; font-family: monospace; }
    .ad-sp-param-type { font-size: 10px; color: #94a3b8; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; text-align: center; }
    .ad-sp-param-val { padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; font-family: inherit; outline: none; &:focus { border-color: #2563eb; } }
    .ad-sp-no-params { padding: 8px 0; }
    .ad-sp-mapping { margin-top: 4px; }

    /* Drill down */
  `]
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cdr  = inject(ChangeDetectorRef);
  private api  = environment.apiBase;

  // Lists
  dashboards: Dashboard[] = [];
  connections: SavedConnection[] = [];
  widgets: Widget[] = [];

  // Active dashboard
  activeDashboard?: Dashboard;
  loading = false;

  // Filters
  dateFrom = '';
  dateTo   = '';
  activeFilters: ColumnFilterDto[] = [];
  showFilterPanel = false;
  allColumns: string[] = [];
  numericColumns: string[] = [];

  // Table widget state
  tableSearch: Record<number, string> = {};
  tablePage: Record<number, number>   = {};
  tablePageSize: Record<number, number> = {};
  tableSort: Record<number, { col: string; dir: 'asc' | 'desc' } | undefined> = {};
  private _tableCache: Record<number, { filtered: any[]; paged: any[]; totalPages: number; dirty: boolean }> = {};

  // Drill down
  drillDownData: any = null;

  // Dashboard modal
  showDashboardModal = false;
  editingDashboardId?: number;
  savingDash = false;
  dashForm = { name: '', description: '', connectionId: 0, database: '', table: '', dateColumn: '', schema: 'dbo' };
  dbList: string[] = [];
  tableList: string[] = [];
  dateColList: string[] = [];
  showDbList = false;
  showTableList = false;
  showDateColList = false;
  loadingDbs = false;
  loadingTables = false;
  loadingDateCols = false;

  // Widget modal
  showWidgetModal = false;
  editingWidgetId?: number;
  savingWidget = false;
  wForm = { type: 'KPI' as Widget['widgetType'], title: '', width: 4 };
  wConfig: any = { aggregation: 'COUNT', colorScheme: 'blue', limit: 10, orderBy: 'value_desc', orderByDir: 'DESC', columns: [] };

  // Lookup browse state
  lookupTableList: string[] = [];
  lookupColList: string[] = [];
  showLookupTableList = false;
  showLookupColFor: 'value' | 'label' | null = null;
  loadingLookupTables = false;
  loadingLookupCols = false;

  // JSON data input state
  jsonValidationMsg = '';
  jsonValidationOk = false;
  chartJsonPlaceholder = '[\n  { "label": "Category A", "value": 120 },\n  { "label": "Category B", "value": 85 },\n  { "label": "Category C", "value": 200 }\n]';
  stackedJsonPlaceholder = '{\n  "labels": ["Jan", "Feb", "Mar"],\n  "series": [\n    { "label": "Product A", "values": [10, 20, 30] },\n    { "label": "Product B", "values": [15, 25, 35] }\n  ]\n}';

  // Stored Procedure data source state
  spDbList: string[] = [];
  spNameList: string[] = [];
  spParams: { name: string; dataType: string; value: string; hasDefault: boolean; defaultValue?: string; isOutput: boolean }[] = [];
  showSpDbList = false;
  showSpNameList = false;
  loadingSpDbs = false;
  loadingSpList = false;
  loadingSpParams = false;
  testingSp = false;
  spTestResult = '';
  spTestError = '';

  widgetTypes: { type: Widget['widgetType']; label: string; icon: string }[] = [
    { type: 'KPI',            label: 'KPI',            icon: '⊡' },
    { type: 'Bar',            label: 'Bar',            icon: '⊟' },
    { type: 'Line',           label: 'Line',           icon: '⊞' },
    { type: 'Area',           label: 'Area',           icon: '▤' },
    { type: 'HorizontalBar',  label: 'H-Bar',          icon: '▥' },
    { type: 'StackedBar',     label: 'Stacked',        icon: '▦' },
    { type: 'Pie',            label: 'Pie',            icon: '○' },
    { type: 'Donut',          label: 'Donut',          icon: '◎' },
    { type: 'Table',          label: 'Table',          icon: '⊠' },
  ];

  private charts: Record<number, any> = {};
  private chartLib: any;

  ngOnInit() { this.loadDashboards(); this.loadConnections(); }
  ngOnDestroy() { Object.values(this.charts).forEach(c => c?.destroy()); }

  loadDashboards() {
    this.loading = true;
    this.http.get<any>(`${this.api}/api/dashboards`).subscribe({
      next: r => { this.dashboards = r.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadConnections() {
    this.http.get<any>(`${this.api}/api/connections`).subscribe({
      next: r => { this.connections = r.data; }
    });
  }

  private getDashHeaders(): Record<string, string> {
    if (this.dashForm.connectionId) {
      return { 'X-Connection-Id': String(this.dashForm.connectionId) };
    }
    return {};
  }

  // ---- Dashboard open/close ----
  openDashboard(db: Dashboard) {
    this.activeDashboard = db;
    this.widgets = [];
    this.dateFrom = this.dateTo = '';
    this.activeFilters = [];
    this.loadWidgets();
    this.loadAllColumns();
  }

  closeDashboard() {
    Object.values(this.charts).forEach(c => c?.destroy());
    this.charts = {};
    this.activeDashboard = undefined;
    this.widgets = [];
  }

  loadWidgets() {
    if (!this.activeDashboard) return;
    this.http.get<any>(`${this.api}/api/dashboards/${this.activeDashboard.id}/widgets`)
      .subscribe({
        next: r => {
          this.widgets = r.data;
          setTimeout(() => this.refreshAllWidgets(), 100);
        }
      });
  }

  loadAllColumns() {
    if (!this.activeDashboard) return;
    const d = this.activeDashboard;
    this.http.get<any>(`${this.api}/api/analytics/meta/columns`, {
      params: { connId: d.externalConnectionId, db: d.databaseName, schema: d.schemaName, table: d.tableName, type: 'all' }
    }).subscribe({ next: r => { this.allColumns = r.data; } });

    this.http.get<any>(`${this.api}/api/analytics/meta/columns`, {
      params: { connId: d.externalConnectionId, db: d.databaseName, schema: d.schemaName, table: d.tableName, type: 'numeric' }
    }).subscribe({ next: r => { this.numericColumns = r.data; } });
  }

  // ---- Widget data loading ----
  refreshAllWidgets() {
    this.widgets.forEach(w => this.refreshWidget(w));
  }

  refreshWidget(w: Widget) {
    w.loading = true;
    w.error   = undefined;
    const req = this.buildRequest(w);

    if (w.widgetType === 'KPI') {
      this.http.post<any>(`${this.api}/api/dashboards/${w.dashboardId}/data/kpi`, req)
        .subscribe({
          next: r => { w.data = r.data; w.loading = false; this.cdr.detectChanges(); },
          error: e => { w.error = e?.error?.message || 'Failed to load'; w.loading = false; }
        });
    } else if (w.widgetType === 'Table') {
      this.http.post<any>(`${this.api}/api/dashboards/${w.dashboardId}/data/table`, req,
        { params: { page: 1, pageSize: 10000 } })
        .subscribe({
          next: r => {
            w.data = r.data;
            w.data._allRows = [...(w.data.rows || [])];
            this.tablePage[w.id] = 1;
            this.tableSearch[w.id] = '';
            if (!this.tablePageSize[w.id]) this.tablePageSize[w.id] = 10;
            delete this.tableSort[w.id];
            this.markTableDirty(w.id);
            w.loading = false;
            this.cdr.detectChanges();
          },
          error: e => { w.error = e?.error?.message || 'Failed to load'; w.loading = false; }
        });
    } else {
      // Chart types (Bar, Line, Area, HorizontalBar, StackedBar, Pie, Donut)
      const config = JSON.parse(w.config || '{}');
      if (config.dataSource === 'json') {
        // JSON data mode — parse locally, no backend call
        const jsonData = this.parseJsonChartData(w);
        if (jsonData) {
          w.data = jsonData;
          w.loading = false;
          this.cdr.detectChanges();
          setTimeout(() => this.renderChart(w), 50);
        } else {
          w.error = 'Invalid or empty JSON data. Edit the widget to fix.';
          w.loading = false;
        }
      } else if (config.dataSource === 'sp') {
        // Stored Procedure mode — execute SP and map results
        this.executeSpForWidget(w);
      } else {
        // SQL mode — call backend
        this.http.post<any>(`${this.api}/api/dashboards/${w.dashboardId}/data/chart`, req)
          .subscribe({
            next: r => {
              w.data = r.data; w.loading = false;
              this.cdr.detectChanges();
              setTimeout(() => this.renderChart(w), 50);
            },
            error: e => { w.error = e?.error?.message || 'Failed to load'; w.loading = false; }
          });
      }
    }
  }

  renderChart(w: Widget) {
    if (!this.chartLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
      script.onload = () => { this.chartLib = (window as any).Chart; this.drawChart(w); };
      document.head.appendChild(script);
    } else {
      this.drawChart(w);
    }
  }

  drawChart(w: Widget) {
    const el = document.getElementById(`chart_${w.id}`) as HTMLCanvasElement;
    if (!el || !w.data) return;
    this.charts[w.id]?.destroy();
    const Chart = this.chartLib || (window as any).Chart;
    if (!Chart) return;

    const colors = ['#378ADD','#639922','#BA7517','#D85A30','#7F77DD','#1D9E75','#D4537E','#888780'];

    const drillClick = {
      onClick: (_: any, elements: any[]) => {
        if (elements.length > 0) {
          const label = w.data.labels[elements[0].index];
          this.drillDown(w, null, label);
        }
      }
    };

    if (w.widgetType === 'Pie' || w.widgetType === 'Donut') {
      this.charts[w.id] = new Chart(el, {
        type: 'doughnut',
        data: {
          labels: w.data.labels,
          datasets: [{ data: w.data.values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: w.widgetType === 'Donut' ? '60%' : '0%',
          plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } },
          ...drillClick
        }
      });
    } else if (w.widgetType === 'Area') {
      this.charts[w.id] = new Chart(el, {
        type: 'line',
        data: {
          labels: w.data.labels,
          datasets: [{
            data: w.data.values,
            backgroundColor: 'rgba(55,138,221,0.25)',
            borderColor: '#378ADD',
            fill: true,
            tension: 0.4,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: false } },
            y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } }
          },
          ...drillClick
        }
      });
    } else if (w.widgetType === 'HorizontalBar') {
      this.charts[w.id] = new Chart(el, {
        type: 'bar',
        data: {
          labels: w.data.labels,
          datasets: [{
            data: w.data.values,
            backgroundColor: '#378ADD',
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y' as const,
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } }
          },
          ...drillClick
        }
      });
    } else if (w.widgetType === 'StackedBar') {
      const labelSet = w.data.labels || [];
      const seriesData = w.data.series;
      const datasets = seriesData && Array.isArray(seriesData)
        ? seriesData.map((s: any, i: number) => ({
            label: s.label,
            data: s.values,
            backgroundColor: colors[i % colors.length],
            borderRadius: 2
          }))
        : [{
            data: w.data.values,
            backgroundColor: '#378ADD',
            borderRadius: 4
          }];
      this.charts[w.id] = new Chart(el, {
        type: 'bar',
        data: { labels: labelSet, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: datasets.length > 1, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: false } },
            y: { stacked: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } }
          },
          ...drillClick
        }
      });
    } else {
      this.charts[w.id] = new Chart(el, {
        type: w.widgetType === 'Line' ? 'line' : 'bar',
        data: {
          labels: w.data.labels,
          datasets: [{
            data: w.data.values,
            backgroundColor: w.widgetType === 'Line' ? '#E6F1FB' : '#378ADD',
            borderColor: '#378ADD',
            borderRadius: 4,
            fill: w.widgetType === 'Line',
            tension: 0.4,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: false } },
            y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } }
          },
          ...drillClick
        }
      });
    }
  }

  buildRequest(w: Widget) {
    return {
      dashboardId: w.dashboardId,
      widgetId:    w.id,
      dateFrom:    this.dateFrom || null,
      dateTo:      this.dateTo   || null,
      filters:     this.activeFilters.filter(f => f.column && f.value)
    };
  }

  // ---- Drill down ----
  drillDown(w: Widget, row: any, label?: string) {
    const config = JSON.parse(w.config || '{}');
    const xCol = config.xColumn || config.labelColumn || '';
    const val = label || (row && xCol ? row[xCol] : null);
    if (!val) return;

    this.http.post<any>(
      `${this.api}/api/dashboards/${w.dashboardId}/data/drilldown`,
      this.buildRequest(w),
      { params: { label: val } }
    ).subscribe({ next: r => { this.drillDownData = r.data; } });
  }

  // ---- Filters ----
  addFilter() {
    this.activeFilters.push({ column: '', operator: 'eq', value: '' });
  }
  removeFilter(i: number) { this.activeFilters.splice(i, 1); }
  applyFilters() { this.refreshAllWidgets(); this.showFilterPanel = false; }
  clearFilters() { this.activeFilters = []; this.refreshAllWidgets(); }
  clearDates()   { this.dateFrom = this.dateTo = ''; this.refreshAllWidgets(); }

  // ---- Dashboard CRUD ----
  openCreateDashboard() {
    this.editingDashboardId = undefined;
    this.dashForm = { name: '', description: '', connectionId: 0, database: '', table: '', dateColumn: '', schema: 'dbo' };
    this.dbList = this.tableList = this.dateColList = [];
    this.showDbList = this.showTableList = this.showDateColList = false;
    this.showDashboardModal = true;
  }

  editDashboard(db: Dashboard, e: Event) {
    e.stopPropagation();
    this.editingDashboardId = db.id;
    this.dashForm = {
      name: db.name, description: db.description || '',
      connectionId: db.externalConnectionId,
      database: db.databaseName, schema: db.schemaName,
      table: db.tableName, dateColumn: db.dateColumn || ''
    };
    this.showDashboardModal = true;
  }

  deleteDashboard(db: Dashboard, e: Event) {
    e.stopPropagation();
    if (!confirm(`Delete "${db.name}"?`)) return;
    this.http.delete<any>(`${this.api}/api/dashboards/${db.id}`)
      .subscribe({ next: () => { this.loadDashboards(); this.toast('Dashboard deleted'); } });
  }

  saveDashboard() {
    if (!this.dashForm.name || !this.dashForm.connectionId || !this.dashForm.table) return;
    this.savingDash = true;
    const payload = {
      name: this.dashForm.name, description: this.dashForm.description || null,
      externalConnectionId: Number(this.dashForm.connectionId),
      databaseName: this.dashForm.database, schemaName: this.dashForm.schema || 'dbo',
      tableName: this.dashForm.table, dateColumn: this.dashForm.dateColumn || null
    };
    const obs = this.editingDashboardId
      ? this.http.put<any>(`${this.api}/api/dashboards/${this.editingDashboardId}`, payload)
      : this.http.post<any>(`${this.api}/api/dashboards`, payload);

    obs.subscribe({
      next: r => {
        this.savingDash = false;
        this.showDashboardModal = false;
        this.loadDashboards();
        if (!this.editingDashboardId) this.openDashboard(r.data);
        this.toast('Dashboard saved!');
      },
      error: () => { this.savingDash = false; }
    });
  }

  onDashConnectionChange() {
    this.dashForm.database = this.dashForm.table = this.dashForm.dateColumn = '';
    this.dbList = this.tableList = [];
    this.showDbList = this.showTableList = false;
  }

  onDashDbChange() {
    this.dashForm.table = this.dashForm.dateColumn = '';
    this.showDbList = this.showTableList = false;
  }

  onSchemaChange() {
    this.dashForm.table = this.dashForm.dateColumn = '';
    this.tableList = [];
    this.showTableList = false;
  }

  browseDatabases() {
    if (!this.dashForm.connectionId) return;
    this.loadingDbs = true;
    this.http.get<any>(`${this.api}/api/external/databases`, {
      headers: this.getDashHeaders()
    }).subscribe({
        next: r => { this.dbList = r.data || []; this.showDbList = true; this.loadingDbs = false; },
        error: () => { this.loadingDbs = false; }
      });
  }

  selectDb(db: string) {
    this.dashForm.database = db;
    this.showDbList = false;
    this.dashForm.table = this.dashForm.dateColumn = '';
    this.tableList = [];
  }

  browseTables() {
    if (!this.dashForm.database) return;
    this.loadingTables = true;
    this.http.get<any>(
      `${this.api}/api/external/databases/${this.dashForm.database}/tables`,
      {
        headers: this.getDashHeaders(),
        params: { schema: this.dashForm.schema || 'dbo' }
      }
    ).subscribe({
        next: r => { this.tableList = r.data || []; this.showTableList = true; this.loadingTables = false; },
        error: () => { this.loadingTables = false; }
      });
  }

  selectTable(t: string) {
    this.dashForm.table = t;
    this.showTableList = false;
  }

  browseDateColumns() {
    const d = this.dashForm;
    if (!d.table) return;
    this.loadingDateCols = true;
    this.http.get<any>(
      `${this.api}/api/external/databases/${d.database}/tables/${d.table}/columns`,
      {
        headers: this.getDashHeaders(),
        params: { schema: d.schema || 'dbo' }
      }
    ).subscribe({
      next: r => { this.dateColList = r.data || []; this.showDateColList = true; this.loadingDateCols = false; },
      error: () => { this.loadingDateCols = false; }
    });
  }

  selectDateCol(c: string) { this.dashForm.dateColumn = c; this.showDateColList = false; }

  // ---- Lookup table browsing (for widget config) ----
  private getActiveDashHeaders(): Record<string, string> {
    if (this.activeDashboard?.externalConnectionId) {
      return { 'X-Connection-Id': String(this.activeDashboard.externalConnectionId) };
    }
    return {};
  }

  browseLookupTables() {
    if (!this.activeDashboard) return;
    this.loadingLookupTables = true;
    this.http.get<any>(
      `${this.api}/api/external/databases/${this.activeDashboard.databaseName}/tables`,
      {
        headers: this.getActiveDashHeaders(),
        params: { schema: this.wConfig.lookupSchema || this.activeDashboard.schemaName || 'dbo' }
      }
    ).subscribe({
      next: r => { this.lookupTableList = r.data || []; this.showLookupTableList = true; this.loadingLookupTables = false; },
      error: () => { this.loadingLookupTables = false; }
    });
  }

  selectLookupTable(t: string) {
    this.wConfig.lookupTable = t;
    this.showLookupTableList = false;
    this.wConfig.lookupValueColumn = '';
    this.wConfig.lookupLabelColumn = '';
    this.lookupColList = [];
  }

  browseLookupColumns(target: 'value' | 'label') {
    if (!this.activeDashboard || !this.wConfig.lookupTable) return;
    this.loadingLookupCols = true;
    this.http.get<any>(
      `${this.api}/api/external/databases/${this.activeDashboard.databaseName}/tables/${this.wConfig.lookupTable}/columns`,
      {
        headers: this.getActiveDashHeaders(),
        params: { schema: this.wConfig.lookupSchema || this.activeDashboard.schemaName || 'dbo' }
      }
    ).subscribe({
      next: r => { this.lookupColList = r.data || []; this.showLookupColFor = target; this.loadingLookupCols = false; },
      error: () => { this.loadingLookupCols = false; }
    });
  }

  selectLookupCol(target: 'value' | 'label', col: string) {
    if (target === 'value') this.wConfig.lookupValueColumn = col;
    else this.wConfig.lookupLabelColumn = col;
    this.showLookupColFor = null;
  }

  onLookupSchemaChange() {
    this.wConfig.lookupTable = '';
    this.wConfig.lookupValueColumn = '';
    this.wConfig.lookupLabelColumn = '';
    this.lookupTableList = [];
    this.lookupColList = [];
    this.showLookupTableList = false;
  }

  // ---- Widget CRUD ----
  openAddWidget() {
    this.editingWidgetId = undefined;
    this.wForm = { type: 'KPI', title: '', width: 4 };
    this.wConfig = { aggregation: 'COUNT', colorScheme: 'blue', limit: 10, orderBy: 'value_desc', orderByDir: 'DESC', columns: [] };
    this.showWidgetModal = true;
  }

  editWidget(w: Widget) {
    this.editingWidgetId = w.id;
    this.wForm = { type: w.widgetType, title: w.title, width: w.width };
    try { this.wConfig = JSON.parse(w.config); } catch { this.wConfig = {}; }
    if (!this.wConfig.columns) this.wConfig.columns = [];
    // Restore SP parameters when editing SP-sourced widget
    if (this.wConfig.dataSource === 'sp' && this.wConfig.spName) {
      this.spParams = (this.wConfig.spParameters || []).map((p: any) => ({
        name: p.name, dataType: p.dataType, value: p.value || '',
        hasDefault: false, defaultValue: undefined, isOutput: false
      }));
      this.spTestResult = '';
      this.spTestError = '';
    } else {
      this.spParams = [];
    }
    this.jsonValidationMsg = '';
    this.showWidgetModal = true;
  }

  deleteWidget(w: Widget) {
    if (!confirm(`Delete "${w.title}"?`)) return;
    this.http.delete<any>(`${this.api}/api/dashboards/${w.dashboardId}/widgets/${w.id}`)
      .subscribe({
        next: () => {
          this.charts[w.id]?.destroy();
          delete this.charts[w.id];
          this.widgets = this.widgets.filter(x => x.id !== w.id);
          this.toast('Widget deleted');
        }
      });
  }

  onWidgetTypeChange() {
    this.wConfig = { aggregation: 'COUNT', colorScheme: 'blue', limit: 10, orderBy: 'value_desc', orderByDir: 'DESC', columns: [] };
  }

  toggleTableCol(col: string, e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (!this.wConfig.columns) this.wConfig.columns = [];
    if (checked) this.wConfig.columns.push(col);
    else this.wConfig.columns = this.wConfig.columns.filter((c: string) => c !== col);
  }

  formatJsonData() {
    if (!this.wConfig.jsonData) return;
    try {
      const parsed = JSON.parse(this.wConfig.jsonData);
      this.wConfig.jsonData = JSON.stringify(parsed, null, 2);
      this.jsonValidationMsg = '';
    } catch {
      this.jsonValidationMsg = 'Invalid JSON';
      this.jsonValidationOk = false;
    }
  }

  validateJsonData(): boolean {
    this.jsonValidationMsg = '';
    this.jsonValidationOk = false;
    if (!this.wConfig.jsonData?.trim()) {
      this.jsonValidationMsg = 'JSON data is empty';
      return false;
    }
    try {
      const parsed = JSON.parse(this.wConfig.jsonData);
      if (this.wForm.type === 'StackedBar' && parsed.labels && parsed.series) {
        if (!Array.isArray(parsed.labels) || !Array.isArray(parsed.series)) {
          this.jsonValidationMsg = 'labels and series must be arrays';
          return false;
        }
        this.jsonValidationMsg = `Valid — ${parsed.labels.length} labels, ${parsed.series.length} series`;
        this.jsonValidationOk = true;
        return true;
      }
      if (!Array.isArray(parsed)) {
        this.jsonValidationMsg = 'Must be an array of { label, value } objects';
        return false;
      }
      const valid = parsed.every((item: any) => item.label !== undefined && item.value !== undefined);
      if (!valid) {
        this.jsonValidationMsg = 'Each item needs "label" and "value" keys';
        return false;
      }
      this.jsonValidationMsg = `Valid — ${parsed.length} items`;
      this.jsonValidationOk = true;
      return true;
    } catch (e) {
      this.jsonValidationMsg = 'Invalid JSON syntax';
      return false;
    }
  }

  private parseJsonChartData(w: Widget): any {
    const config = JSON.parse(w.config || '{}');
    if (!config.jsonData) return null;
    try {
      const parsed = JSON.parse(config.jsonData);
      if (w.widgetType === 'StackedBar' && parsed.labels && parsed.series) {
        return { labels: parsed.labels, series: parsed.series, values: parsed.series[0]?.values || [] };
      }
      if (Array.isArray(parsed)) {
        return {
          labels: parsed.map((item: any) => String(item.label)),
          values: parsed.map((item: any) => Number(item.value) || 0)
        };
      }
      return null;
    } catch { return null; }
  }

  // ---- Stored Procedure data source methods ----
  onSpConnectionChange() {
    this.wConfig.spDatabase = '';
    this.wConfig.spName = '';
    this.spDbList = [];
    this.spNameList = [];
    this.spParams = [];
    this.showSpDbList = false;
    this.showSpNameList = false;
  }

  browseSpDatabases() {
    if (!this.wConfig.spConnectionId) return;
    this.loadingSpDbs = true;
    this.http.get<any>(`${this.api}/api/connections/${this.wConfig.spConnectionId}/databases`).subscribe({
      next: r => { this.spDbList = r.data || []; this.showSpDbList = true; this.loadingSpDbs = false; },
      error: () => { this.loadingSpDbs = false; }
    });
  }

  selectSpDb(db: string) {
    this.wConfig.spDatabase = db;
    this.showSpDbList = false;
    this.wConfig.spName = '';
    this.spNameList = [];
    this.spParams = [];
  }

  browseStoredProcedures() {
    if (!this.wConfig.spConnectionId || !this.wConfig.spDatabase) return;
    this.loadingSpList = true;
    this.http.get<any>(`${this.api}/api/reports/meta/sp-and-views`, {
      params: {
        connId: this.wConfig.spConnectionId,
        db: this.wConfig.spDatabase,
        schema: this.wConfig.spSchema || 'dbo'
      }
    }).subscribe({
      next: r => {
        this.spNameList = (r.data || [])
          .filter((item: any) => {
            const t = (item.type || '').toUpperCase();
            return t === 'SP' || t === 'STOREDPROCEDURE' || t === 'STORED_PROCEDURE' || t === 'P';
          })
          .map((item: any) => item.name);
        this.showSpNameList = true;
        this.loadingSpList = false;
      },
      error: () => { this.loadingSpList = false; }
    });
  }

  selectStoredProcedure(name: string) {
    this.wConfig.spName = name;
    this.showSpNameList = false;
    this.loadSpParameters();
  }

  private loadSpParameters() {
    if (!this.wConfig.spConnectionId || !this.wConfig.spDatabase || !this.wConfig.spName) return;
    this.loadingSpParams = true;
    this.spParams = [];
    this.http.get<any>(`${this.api}/api/reports/meta/sp-parameters`, {
      params: {
        connId: this.wConfig.spConnectionId,
        db: this.wConfig.spDatabase,
        schema: this.wConfig.spSchema || 'dbo',
        spName: this.wConfig.spName
      }
    }).subscribe({
      next: r => {
        this.spParams = (r.data || [])
          .filter((p: any) => !p.isOutput)
          .map((p: any) => ({
            name: p.name, dataType: p.dataType, value: p.defaultValue || '',
            hasDefault: p.hasDefault, defaultValue: p.defaultValue, isOutput: p.isOutput
          }));
        // Restore saved parameter values from config
        const saved = this.wConfig.spParameters || [];
        this.spParams.forEach(p => {
          const s = saved.find((sp: any) => sp.name === p.name);
          if (s?.value) p.value = s.value;
        });
        this.loadingSpParams = false;
      },
      error: () => { this.loadingSpParams = false; }
    });
  }

  testSpExecution() {
    this.spTestResult = '';
    this.spTestError = '';
    if (!this.wConfig.spConnectionId || !this.wConfig.spDatabase || !this.wConfig.spName) {
      this.spTestError = 'Connection, database and SP name are required';
      return;
    }
    this.testingSp = true;
    const payload = {
      externalConnectionId: Number(this.wConfig.spConnectionId),
      connectionId: Number(this.wConfig.spConnectionId),
      databaseName: this.wConfig.spDatabase,
      schemaName: this.wConfig.spSchema || 'dbo',
      name: this.wConfig.spName,
      type: 'SP',
      parameters: this.spParams.filter(p => !p.isOutput && p.value).map(p => ({
        name: p.name, value: p.value, dataType: p.dataType
      }))
    };
    this.http.post<any>(`${this.api}/api/reports/execute-sp`, payload).subscribe({
      next: r => {
        const data = r.data;
        const cols = data.columns || [];
        this.spTestResult = `${data.totalCount} rows, ${data.durationMs}ms — Columns: ${cols.join(', ')}`;
        this.testingSp = false;
      },
      error: e => {
        this.spTestError = e?.error?.message || 'Execution failed';
        this.testingSp = false;
      }
    });
  }

  private executeSpForWidget(w: Widget): void {
    const config = JSON.parse(w.config || '{}');
    if (!config.spConnectionId || !config.spDatabase || !config.spName) {
      w.error = 'SP config incomplete. Edit widget to configure.';
      w.loading = false;
      return;
    }
    const payload = {
      externalConnectionId: Number(config.spConnectionId),
      connectionId: Number(config.spConnectionId),
      databaseName: config.spDatabase,
      schemaName: config.spSchema || 'dbo',
      name: config.spName,
      type: 'SP',
      parameters: (config.spParameters || [])
        .filter((p: any) => p.value)
        .map((p: any) => ({ name: p.name, value: p.value, dataType: p.dataType }))
    };
    this.http.post<any>(`${this.api}/api/reports/execute-sp`, payload).subscribe({
      next: r => {
        const rows = r.data?.rows || [];
        const labelCol = config.spLabelColumn;
        const valueCol = config.spValueColumn;
        if (!labelCol || !valueCol) {
          w.error = 'Label and Value column mapping required. Edit widget to configure.';
          w.loading = false;
          return;
        }
        if (w.widgetType === 'StackedBar' && config.spSeriesColumn) {
          // Build stacked data from rows
          const seriesCol = config.spSeriesColumn;
          const labelsSet = Array.from(new Set<string>(rows.map((r: any) => String(r[labelCol] ?? ''))));
          const seriesNames = Array.from(new Set<string>(rows.map((r: any) => String(r[seriesCol] ?? ''))));
          const series = seriesNames.map((sn: string) => ({
            label: sn,
            values: labelsSet.map((lb: string) => {
              const match = rows.find((r: any) => String(r[labelCol]) === lb && String(r[seriesCol]) === sn);
              return match ? Number(match[valueCol]) || 0 : 0;
            })
          }));
          w.data = { labels: labelsSet, series, values: series[0]?.values || [] };
        } else {
          w.data = {
            labels: rows.map((r: any) => String(r[labelCol] ?? '')),
            values: rows.map((r: any) => Number(r[valueCol]) || 0)
          };
        }
        w.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.renderChart(w), 50);
      },
      error: e => {
        w.error = e?.error?.message || 'SP execution failed';
        w.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  saveWidget() {
    if (!this.wForm.title) return;
    // Save SP parameters into config before saving
    if (this.wConfig.dataSource === 'sp' && this.spParams.length > 0) {
      this.wConfig.spParameters = this.spParams.map(p => ({
        name: p.name, value: p.value, dataType: p.dataType
      }));
    }
    this.savingWidget = true;

    const nextY = this.widgets.length > 0
      ? Math.max(...this.widgets.map(w => w.positionY)) + 1 : 0;

    const payload = {
      title: this.wForm.title, widgetType: this.wForm.type,
      positionX: 0, positionY: this.editingWidgetId ? 0 : nextY,
      width: Number(this.wForm.width), height: 3,
      config: JSON.stringify(this.wConfig),
      sortOrder: this.widgets.length
    };

    const obs = this.editingWidgetId
      ? this.http.put<any>(`${this.api}/api/dashboards/${this.activeDashboard!.id}/widgets/${this.editingWidgetId}`, payload)
      : this.http.post<any>(`${this.api}/api/dashboards/${this.activeDashboard!.id}/widgets`, payload);

    obs.subscribe({
      next: r => {
        this.savingWidget = false;
        this.showWidgetModal = false;
        if (this.editingWidgetId) {
          const idx = this.widgets.findIndex(w => w.id === this.editingWidgetId);
          if (idx >= 0) {
            this.widgets[idx] = { ...this.widgets[idx], ...r.data };
            this.charts[r.data.id]?.destroy();
            delete this.charts[r.data.id];
          }
        } else {
          this.widgets.push(r.data);
        }
        setTimeout(() => this.refreshWidget(
          this.widgets.find(w => w.id === r.data.id)!), 100);
        this.toast('Widget saved!');
      },
      error: () => { this.savingWidget = false; }
    });
  }

  // ---- Export PDF ----
  exportPDF() {
    window.print();
    this.toast('Use browser Print → Save as PDF');
  }

  // ---- Helpers ----
  onOverlay(e: Event, type: string) {
    if ((e.target as HTMLElement).classList.contains('ad-overlay')) {
      if (type === 'dashboard') this.showDashboardModal = false;
      else if (type === 'widget') this.showWidgetModal = false;
      else if (type === 'drilldown') this.drillDownData = null;
    }
  }

  toast(msg: string, error = false) {
    this.toastMsg   = msg;
    this.toastError = error;
    this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 3000);
  }

  toastMsg = ''; toastError = false; toastVisible = false;

  // Table helpers — cached to avoid recomputing on every change detection cycle
  private markTableDirty(wId: number) {
    const c = this._tableCache[wId];
    if (c) c.dirty = true;
    else this._tableCache[wId] = { filtered: [], paged: [], totalPages: 1, dirty: true };
  }

  getTableCache(w: Widget): { filtered: any[]; paged: any[]; totalPages: number } {
    const cache = this._tableCache[w.id];
    if (cache && !cache.dirty) return cache;

    const allRows: any[] = w.data?._allRows || [];
    const search = (this.tableSearch[w.id] || '').toLowerCase();

    let filtered = search
      ? allRows.filter(row => Object.values(row).some(cell => String(cell ?? '').toLowerCase().includes(search)))
      : allRows;

    const sort = this.tableSort[w.id];
    if (sort?.col) {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sort.col] ?? '';
        const bv = b[sort.col] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') {
          return sort.dir === 'asc' ? av - bv : bv - av;
        }
        return sort.dir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    const pageSize = this.tablePageSize[w.id] || 10;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(this.tablePage[w.id] || 1, totalPages);
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    this._tableCache[w.id] = { filtered, paged, totalPages, dirty: false };
    return this._tableCache[w.id];
  }

  onTableSearchChange(w: Widget) {
    this.tablePage[w.id] = 1;
    this.markTableDirty(w.id);
  }

  onTablePageSizeChange(w: Widget) {
    this.tablePage[w.id] = 1;
    this.markTableDirty(w.id);
  }

  onTableSort(w: Widget, column: string) {
    const sort = this.tableSort[w.id];
    if (sort?.col === column) {
      sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this.tableSort[w.id] = { col: column, dir: 'asc' };
    }
    this.tablePage[w.id] = 1;
    this.markTableDirty(w.id);
  }

  tableGoPage(w: Widget, page: number) {
    this.tablePage[w.id] = page;
    this.markTableDirty(w.id);
  }
}
