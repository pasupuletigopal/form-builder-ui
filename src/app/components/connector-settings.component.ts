// src/app/components/connector-settings.component.ts — NEW FILE

import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FormDefinition } from '../models/form-builder.models';
import { environment } from '../../environments/environment';

type AuthType = 'Windows' | 'SqlServer';

interface SavedConnection {
  id: number;
  name: string;
  serverName: string;
  authType: AuthType;
  username?: string;
  description?: string;
  isActive: boolean;
  lastTestOk?: boolean;
}

interface ConnectorConfig {
  externalConnectionId?: number;
  serverName: string;
  authType: AuthType;
  username: string;
  password: string;
  databaseName: string;
  schemaName: string;
  tableName: string;
  primaryKeyColumn: string;
  excludeColumns: string;
  defaultFilter: string;
  defaultOrderBy: string;
}

interface TestResult {
  success: boolean;
  message: string;
  columns?: string[];
  rowCount?: number;
}

@Component({
  selector: 'app-connector-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="cs-wrap">
<div class="cs-panel">

  <!-- Header -->
  <div class="cs-header">
    <div class="cs-header__icon">⊡</div>
    <div>
      <h3>External Database Connector</h3>
      <p>Connect this form to a table on any SQL Server instance</p>
    </div>
  </div>

  <!-- Active connector badge -->
  <div class="cs-active-badge" *ngIf="hasConnector">
    <span class="cs-badge-dot"></span>
    Connected to <strong>{{ config.serverName }}&#92;{{ config.databaseName }}.{{ config.schemaName }}.{{ config.tableName }}</strong>
    <button class="cs-remove-btn" (click)="removeConnector()">Remove</button>
  </div>

  <!-- Step 1: Connection Source -->
  <div class="cs-section">
    <div class="cs-step">
      <span class="cs-step-num">1</span>
      <span class="cs-step-label">Server Connection</span>
    </div>

    <!-- Choose: Saved Connection or Manual -->
    <div class="cs-source-toggle">
      <button [class.active]="connectionMode === 'saved'" (click)="connectionMode = 'saved'">
        Use Saved Connection
      </button>
      <button [class.active]="connectionMode === 'manual'" (click)="connectionMode = 'manual'">
        Manual Connection
      </button>
    </div>

    <!-- Saved Connection picker -->
    <div *ngIf="connectionMode === 'saved'" class="cs-saved-wrap">
      <div class="cs-field">
        <label>Saved Connection</label>
        <div class="cs-saved-list" *ngIf="savedConnections.length > 0">
          <div class="cs-saved-item"
            *ngFor="let conn of savedConnections"
            [class.selected]="config.externalConnectionId === conn.id"
            (click)="selectSavedConnection(conn)">
            <div class="cs-saved-item__icon">
              {{ conn.authType === 'Windows' ? '🪟' : '🔑' }}
            </div>
            <div class="cs-saved-item__info">
              <div class="cs-saved-item__name">{{ conn.name }}</div>
              <div class="cs-saved-item__server">{{ conn.serverName }}</div>
            </div>
            <span class="cs-saved-item__check" *ngIf="config.externalConnectionId === conn.id">✓</span>
          </div>
        </div>
        <div class="cs-saved-empty" *ngIf="savedConnections.length === 0">
          No saved connections found. Use <strong>Manual Connection</strong> or create one in Connection Manager.
        </div>
      </div>
    </div>

    <!-- Manual Connection -->
    <div *ngIf="connectionMode === 'manual'">
      <div class="cs-field">
        <label>Server Name / IP</label>
        <input type="text" [(ngModel)]="config.serverName"
          placeholder="e.g. 192.168.1.50, DBSERVER\\SQLEXPRESS, myserver.database.windows.net"
          (change)="onServerChange()" />
        <span class="cs-hint">SQL Server hostname, IP address, or named instance</span>
      </div>

      <div class="cs-field">
        <label>Authentication</label>
        <div class="cs-auth-cards">
          <div class="cs-auth-card"
            [class.selected]="config.authType === 'Windows'"
            (click)="config.authType = 'Windows'; onAuthChange()">
            <span class="cs-auth-icon">🪟</span>
            <div>
              <span class="cs-auth-name">Windows Authentication</span>
              <span class="cs-auth-desc">Use the service account running the API</span>
            </div>
          </div>
          <div class="cs-auth-card"
            [class.selected]="config.authType === 'SqlServer'"
            (click)="config.authType = 'SqlServer'; onAuthChange()">
            <span class="cs-auth-icon">🔑</span>
            <div>
              <span class="cs-auth-name">SQL Server Authentication</span>
              <span class="cs-auth-desc">Provide username and password</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SQL Auth credentials -->
      <div class="cs-field-row" *ngIf="config.authType === 'SqlServer'">
        <div class="cs-field">
          <label>Username</label>
          <input type="text" [(ngModel)]="config.username"
            placeholder="sa" autocomplete="off" />
        </div>
        <div class="cs-field">
          <label>Password</label>
          <div class="cs-input-row">
            <input [type]="showPassword ? 'text' : 'password'"
              [(ngModel)]="config.password"
              placeholder="••••••••" autocomplete="new-password" />
            <button class="cs-load-btn" (click)="showPassword = !showPassword"
              type="button" title="Toggle visibility">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Connect button -->
    <div class="cs-connect-row">
      <button class="cs-connect-btn" (click)="connectToServer()"
        [disabled]="!canConnect() || connectingServer">
        {{ connectingServer ? 'Connecting…' : '⊡ Connect to Server' }}
      </button>
      <span class="cs-connect-status" *ngIf="serverConnected">
        <span class="cs-status-dot cs-status-dot--ok"></span> Connected
      </span>
      <span class="cs-connect-status cs-connect-status--err" *ngIf="serverError">
        <span class="cs-status-dot cs-status-dot--err"></span> {{ serverError }}
      </span>
    </div>
  </div>

  <!-- Step 2: Database -->
  <div class="cs-section" *ngIf="serverConnected">
    <div class="cs-step">
      <span class="cs-step-num">2</span>
      <span class="cs-step-label">Select Database</span>
    </div>

    <div class="cs-field-row">
      <div class="cs-field">
        <label>Database Name</label>
        <div class="cs-input-row">
          <input type="text" [(ngModel)]="config.databaseName"
            (change)="onDbChange()" placeholder="e.g. LumiereDB" />
          <button class="cs-load-btn" (click)="loadDatabases()"
            [disabled]="loadingDbs" title="Browse available databases">
            {{ loadingDbs ? '…' : '⊞' }}
          </button>
        </div>
        <div class="cs-dropdown" *ngIf="databases.length > 0 && showDbList">
          <div class="cs-dropdown-item" *ngFor="let db of databases"
            (click)="selectDb(db)">{{ db }}</div>
        </div>
      </div>

      <div class="cs-field">
        <label>Schema</label>
        <input type="text" [(ngModel)]="config.schemaName" placeholder="dbo" />
      </div>
    </div>
  </div>

  <!-- Step 3: Table -->
  <div class="cs-section" *ngIf="serverConnected && config.databaseName">
    <div class="cs-step">
      <span class="cs-step-num">3</span>
      <span class="cs-step-label">Select Table</span>
    </div>

    <div class="cs-field-row">
      <div class="cs-field flex-2">
        <label>Table Name</label>
        <div class="cs-input-row">
          <input type="text" [(ngModel)]="config.tableName"
            (change)="onTableChange()" placeholder="e.g. Customers" />
          <button class="cs-load-btn" (click)="loadTables()"
            [disabled]="loadingTables" title="Browse tables">
            {{ loadingTables ? '…' : '⊞' }}
          </button>
        </div>
        <div class="cs-dropdown" *ngIf="tables.length > 0 && showTableList">
          <div class="cs-dropdown-item" *ngFor="let t of tables"
            (click)="selectTable(t)">{{ t }}</div>
        </div>
      </div>

      <div class="cs-field">
        <label>Primary Key Column</label>
        <div class="cs-input-row">
          <input type="text" [(ngModel)]="config.primaryKeyColumn" placeholder="Id" />
          <button class="cs-load-btn" (click)="loadColumns()"
            [disabled]="!config.tableName || loadingCols" title="Browse columns">
            {{ loadingCols ? '…' : '⊞' }}
          </button>
        </div>
        <div class="cs-dropdown" *ngIf="columns.length > 0 && showColList">
          <div class="cs-dropdown-item" *ngFor="let c of columns"
            (click)="selectPk(c)">{{ c }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Step 4: Column mapping -->
  <div class="cs-section" *ngIf="config.tableName && columns.length > 0">
    <div class="cs-step">
      <span class="cs-step-num">4</span>
      <span class="cs-step-label">Column Mapping (Auto)</span>
    </div>

    <div class="cs-mapping-note">
      <span class="cs-info-icon">ℹ</span>
      <span>Form field names map automatically to table columns. Make sure your form field names match the column names exactly.</span>
    </div>

    <div class="cs-columns-wrap">
      <div class="cs-col-header">
        <span>External Table Columns</span>
        <span>Form Field</span>
        <span>Status</span>
      </div>
      <div class="cs-col-row" *ngFor="let col of columns">
        <span class="cs-col-name">{{ col }}</span>
        <span class="cs-col-field">
          <code *ngIf="getFormField(col)">{{ getFormField(col) }}</code>
          <span class="cs-no-field" *ngIf="!getFormField(col)">—</span>
        </span>
        <span class="cs-col-status">
          <span class="cs-matched" *ngIf="getFormField(col)">✓ Matched</span>
          <span class="cs-unmatched" *ngIf="!getFormField(col) && col !== config.primaryKeyColumn">No field</span>
          <span class="cs-pk-badge" *ngIf="col === config.primaryKeyColumn">PK</span>
        </span>
      </div>
    </div>
  </div>

  <!-- Step 5: Advanced -->
  <div class="cs-section" *ngIf="config.tableName">
    <div class="cs-step">
      <span class="cs-step-num">5</span>
      <span class="cs-step-label">Advanced (Optional)</span>
    </div>

    <div class="cs-field">
      <label>Exclude Columns from Grid</label>
      <input type="text" [(ngModel)]="config.excludeColumns"
        placeholder="Password, SecretToken, InternalNotes" />
      <span class="cs-hint">Comma-separated column names to hide in the Records grid</span>
    </div>
    <div class="cs-field">
      <label>Default Filter (SQL WHERE)</label>
      <input type="text" [(ngModel)]="config.defaultFilter"
        placeholder="IsDeleted = 0 AND TenantId = 1" />
      <span class="cs-hint">Appended to all SELECT queries</span>
    </div>
    <div class="cs-field">
      <label>Default Order By</label>
      <input type="text" [(ngModel)]="config.defaultOrderBy"
        placeholder="CreatedAt DESC" />
    </div>
  </div>

  <!-- Test result -->
  <div class="cs-test-result" *ngIf="testResult"
    [class.cs-test--ok]="testResult.success"
    [class.cs-test--err]="!testResult.success">
    <span class="cs-test-icon">{{ testResult.success ? '✓' : '✗' }}</span>
    <div>
      <div class="cs-test-msg">{{ testResult.message }}</div>
      <div class="cs-test-cols" *ngIf="testResult.columns?.length">
        Columns: {{ testResult.columns!.join(', ') }}
      </div>
    </div>
  </div>

  <!-- Footer actions -->
  <div class="cs-footer">
    <button class="cs-test-btn" (click)="testConnection()"
      [disabled]="!config.serverName || !config.databaseName || !config.tableName || testing">
      {{ testing ? 'Testing…' : '⊡ Test Connection' }}
    </button>
    <button class="cs-save-btn" (click)="saveConnector()"
      [disabled]="!config.serverName || !config.databaseName || !config.tableName || saving">
      {{ saving ? 'Saving…' : '✓ Save Connector' }}
    </button>
  </div>

  <div class="cs-save-msg" *ngIf="saveMsg">{{ saveMsg }}</div>

</div>
</div>
  `,
  styles: [`
    .cs-wrap { display: flex; justify-content: center; padding: 32px; background: #f0f2f5; min-height: 100%; }
    .cs-panel { width: 100%; max-width: 700px; background: white; border-radius: 14px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,.07); overflow: hidden; }

    .cs-header { display: flex; gap: 14px; align-items: flex-start; padding: 20px 24px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
      .cs-header__icon { font-size: 28px; color: #2563eb; }
      h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; }
      p  { font-size: 12px; color: #64748b; margin: 4px 0 0; }
    }

    .cs-active-badge {
      display: flex; align-items: center; gap: 8px; padding: 10px 24px;
      background: #f0fdf4; border-bottom: 1px solid #bbf7d0; font-size: 13px; color: #166534;
      .cs-badge-dot { width: 8px; height: 8px; background: #16a34a; border-radius: 50%; flex-shrink: 0; }
      strong { font-weight: 700; }
    }
    .cs-remove-btn { margin-left: auto; padding: 3px 10px; border: 1px solid #fca5a5; background: white; color: #dc2626; border-radius: 5px; cursor: pointer; font-size: 12px; font-family: inherit;
      &:hover { background: #fef2f2; }
    }

    .cs-section { padding: 18px 24px; border-bottom: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 12px; }
    .cs-step { display: flex; align-items: center; gap: 8px;
      .cs-step-num { width: 22px; height: 22px; background: #2563eb; color: white; border-radius: 50%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .cs-step-label { font-size: 13px; font-weight: 700; color: #0f172a; }
    }

    /* Source toggle */
    .cs-source-toggle { display: flex; background: #f1f5f9; border-radius: 8px; padding: 3px; gap: 3px;
      button { flex: 1; padding: 8px 12px; border: none; background: transparent; border-radius: 6px; font-size: 13px; font-weight: 500; color: #64748b; cursor: pointer; font-family: inherit; transition: .15s;
        &.active { background: white; color: #0f172a; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        &:hover:not(.active) { color: #0f172a; }
      }
    }

    /* Saved connections list */
    .cs-saved-wrap { display: flex; flex-direction: column; gap: 8px; }
    .cs-saved-list { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
    .cs-saved-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: .15s;
      &:hover { border-color: #93c5fd; background: #f8fafc; }
      &.selected { border-color: #2563eb; background: #eff6ff; }
    }
    .cs-saved-item__icon { font-size: 20px; flex-shrink: 0; }
    .cs-saved-item__info { flex: 1; }
    .cs-saved-item__name { font-size: 13px; font-weight: 600; color: #0f172a; }
    .cs-saved-item__server { font-size: 12px; font-family: monospace; color: #2563eb; }
    .cs-saved-item__check { font-size: 16px; color: #2563eb; font-weight: 700; }
    .cs-saved-empty { font-size: 13px; color: #94a3b8; padding: 20px; text-align: center; background: #f8fafc; border-radius: 8px;
      strong { color: #374151; }
    }

    .cs-field-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .cs-field { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 160px; position: relative;
      &.flex-2 { flex: 2; }
      label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
    }
    .cs-hint { font-size: 11px; color: #94a3b8; }

    .cs-input-row { display: flex; gap: 0; border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white;
      &:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      input { flex: 1; padding: 9px 12px; border: none; outline: none; font-size: 14px; font-family: inherit; color: #0f172a; background: transparent; }
    }
    .cs-load-btn { padding: 9px 12px, 9px 12px; border: none; border-left: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-size: 14px; color: #64748b; transition: .15s;
      &:hover:not(:disabled) { background: #eff6ff; color: #2563eb; }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }

    .cs-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 200px; overflow-y: auto; margin-top: 4px; }
    .cs-dropdown-item { padding: 9px 14px; font-size: 13px, cursor: pointer; color: #0f172a;
      &:hover { background: #eff6ff; color: #2563eb; }
    }

    /* Auth cards */
    .cs-auth-cards { display: flex; gap: 10px; flex-wrap: wrap; }
    .cs-auth-card {
      flex: 1; min-width: 200px; border: 2px solid #e5e7eb; border-radius: 10px;
      padding: 12px 14px; cursor: pointer; display: flex; gap: 10px; align-items: center; transition: .15s;
      .cs-auth-icon { font-size: 20px; flex-shrink: 0; }
      .cs-auth-name { font-size: 13px; font-weight: 600; color: #0f172a; display: block; }
      .cs-auth-desc { font-size: 11px; color: #64748b; display: block; }
      &.selected { border-color: #2563eb; background: #eff6ff; .cs-auth-name { color: #1d4ed8; } }
      &:hover:not(.selected) { border-color: #93c5fd; }
    }

    /* Connect row */
    .cs-connect-row { display: flex; align-items: center; gap: 12px; }
    .cs-connect-btn {
      padding: 9px 18px; border: 1.5px solid #2563eb; background: #eff6ff; color: #2563eb;
      border-radius: 8px; font-size: 13px; font-weight: 600, cursor: pointer; font-family: inherit; transition: .15s;
      &:hover:not(:disabled) { background: #2563eb; color: white; }
      &:disabled { opacity: .5, cursor: not-allowed; }
    }
    .cs-connect-status { font-size: 12px; display: flex; align-items: center; gap: 6px; font-weight: 500; }
    .cs-connect-status--err { color: #dc2626; }
    .cs-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .cs-status-dot--ok { background: #16a34a; }
    .cs-status-dot--err { background: #dc2626; }

    /* Mapping table */
    .cs-mapping-note { display: flex; gap: 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #1e40af;
      .cs-info-icon { font-size: 16px; flex-shrink: 0; }
    }
    .cs-columns-wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .cs-col-header, .cs-col-row { display: grid; grid-template-columns: 1fr 1fr 120px; align-items: center; padding: 8px 14px; gap: 8px; }
    .cs-col-header { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; background: #f8fafc; }
    .cs-col-row { border-top: 1px solid #f1f5f9; font-size: 13px; &:hover { background: #f8fafc; } }
    .cs-col-name  { font-weight: 600; color: #0f172a; font-family: monospace; font-size: 13px; }
    .cs-col-field code { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #2563eb; }
    .cs-no-field  { color: #d1d5db; }
    .cs-matched   { color: #16a34a; font-weight: 600; font-size: 12px; }
    .cs-unmatched { color: #f59e0b; font-size: 12px; }
    .cs-pk-badge  { background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }

    .cs-section > .cs-field { flex: none; width: 100%; }
    .cs-section > .cs-field input, .cs-section > .cs-field textarea {
      padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; color: #0f172a;
      &:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    }

    /* Test result */
    .cs-test-result { margin: 16px 24px; padding: 12px 16px; border-radius: 8px; display: flex; gap: 12px; align-items: flex-start; font-size: 13px;
      .cs-test-icon { font-size: 18px; font-weight: 700; flex-shrink: 0; }
      .cs-test-msg  { font-weight: 600; }
      .cs-test-cols { font-size: 12px; margin-top: 4px; opacity: .8; }
      &.cs-test--ok  { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }
      &.cs-test--err { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    }

    .cs-footer { display: flex; gap: 10px; padding: 16px 24px; border-top: 1px solid #e5e7eb; }
    .cs-test-btn {
      padding: 10px 20px; border: 1.5px solid #2563eb; background: transparent; color: #2563eb;
      border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: .15s;
      &:hover:not(:disabled) { background: #eff6ff; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .cs-save-btn {
      padding: 10px 24px; border: none; background: #2563eb; color: white;
      border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: .15s;
      &:hover:not(:disabled) { background: #1d4ed8; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .cs-save-msg { padding: 0 24px 14px; font-size: 13px; font-weight: 600; color: #16a34a; }
  `]
})
export class ConnectorSettingsComponent implements OnInit {
  @Input() form!: FormDefinition;
  @Output() saved = new EventEmitter<void>();

  private http    = inject(HttpClient);
  private apiBase = environment.apiBase;

  connectionMode: 'saved' | 'manual' = 'saved';
  savedConnections: SavedConnection[] = [];

  config: ConnectorConfig = {
    externalConnectionId: undefined,
    serverName: '', authType: 'Windows', username: '', password: '',
    databaseName: '', schemaName: 'dbo', tableName: '',
    primaryKeyColumn: 'Id', excludeColumns: '', defaultFilter: '', defaultOrderBy: ''
  };

  hasConnector  = false;
  serverConnected = false;
  serverError = '';
  connectingServer = false;
  showPassword = false;

  databases: string[] = [];
  tables:    string[] = [];
  columns:   string[] = [];

  showDbList    = false;
  showTableList = false;
  showColList   = false;

  loadingDbs    = false;
  loadingTables = false;
  loadingCols   = false;
  testing       = false;
  saving        = false;

  testResult?: TestResult;
  saveMsg = '';

  ngOnInit() {
    this.loadSavedConnections();
    this.loadConnector();
  }

  // ---- Build HTTP headers for server credentials ----
  private getCredentialHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.externalConnectionId) {
      headers['X-Connection-Id'] = String(this.config.externalConnectionId);
    } else {
      if (this.config.serverName) headers['X-Server-Name'] = this.config.serverName;
      if (this.config.authType)   headers['X-Auth-Type'] = this.config.authType;
      if (this.config.authType === 'SqlServer') {
        if (this.config.username) headers['X-Username'] = this.config.username;
        if (this.config.password) headers['X-Password'] = this.config.password;
      }
    }
    return headers;
  }

  loadSavedConnections() {
    this.http.get<any>(`${this.apiBase}/api/connections`).subscribe({
      next: res => { this.savedConnections = res.data || []; },
      error: () => {}
    });
  }

  selectSavedConnection(conn: SavedConnection) {
    this.config.externalConnectionId = conn.id;
    this.config.serverName   = conn.serverName;
    this.config.authType     = conn.authType;
    this.config.username     = conn.username || '';
    this.config.password     = '';
    this.serverConnected = false;
    this.serverError = '';
    this.databases = [];
    this.tables = [];
    this.columns = [];
    this.config.databaseName = '';
    this.config.tableName = '';
  }

  canConnect(): boolean {
    if (this.connectionMode === 'saved') {
      return !!this.config.externalConnectionId;
    }
    if (!this.config.serverName) return false;
    if (this.config.authType === 'SqlServer' && (!this.config.username || !this.config.password)) return false;
    return true;
  }

  loadConnector() {
    this.http.get<any>(`${this.apiBase}/api/forms/${this.form.id}/connector`)
      .subscribe({
        next: res => {
          if (res.data) {
            this.hasConnector = true;
            this.config.externalConnectionId = res.data.externalConnectionId || undefined;
            this.config.serverName      = res.data.serverName || '';
            this.config.authType        = res.data.authType || 'Windows';
            this.config.username        = res.data.username || '';
            this.config.password        = '';
            this.config.databaseName    = res.data.databaseName;
            this.config.schemaName      = res.data.schemaName;
            this.config.tableName       = res.data.tableName;
            this.config.primaryKeyColumn = res.data.primaryKeyColumn;
            this.config.excludeColumns  = res.data.excludeColumns || '';
            this.config.defaultFilter   = res.data.defaultFilter  || '';
            this.config.defaultOrderBy  = res.data.defaultOrderBy || '';

            if (this.config.externalConnectionId) {
              this.connectionMode = 'saved';
            } else if (this.config.serverName) {
              this.connectionMode = 'manual';
            }
            this.serverConnected = true;
            this.loadColumns();

            // Auto-fix: existing connector with no linked connection
            if (!this.config.externalConnectionId && this.config.serverName) {
              this.autoFixMissingConnection();
            }
          }
        }
      });
  }

  /**
   * Auto-create an ExternalConnection and re-save the connector
   * for legacy connectors that were saved without a connectionId.
   */
  private autoFixMissingConnection() {
    this.saveMsg = 'Linking connection credentials… Please wait.';
    this.ensureConnectionId().then(() => {
      this.http.post<any>(`${this.apiBase}/api/forms/${this.form.id}/connector`, this.buildPayload())
        .subscribe({
          next: () => {
            this.saveMsg = '✓ Connection linked automatically. Records tab is ready.';
            this.saved.emit();
            setTimeout(() => this.saveMsg = '', 4000);
          },
          error: () => {
            this.saveMsg = '⚠ Could not auto-link connection. Please click Save Connector to fix.';
          }
        });
    }).catch(() => {
      this.saveMsg = '⚠ Could not create connection. Please re-enter credentials and Save.';
    });
  }

  connectToServer() {
    this.connectingServer = true;
    this.serverError = '';
    this.serverConnected = false;

    this.http.get<any>(`${this.apiBase}/api/external/databases`, {
      headers: this.getCredentialHeaders()
    }).subscribe({
      next: res => {
        this.databases = res.data;
        this.serverConnected = true;
        this.connectingServer = false;
        this.showDbList = true;
      },
      error: err => {
        this.connectingServer = false;
        this.serverError = err?.error?.message || 'Failed to connect. Check server name and credentials.';
      }
    });
  }

  onServerChange() {
    this.config.externalConnectionId = undefined;
    this.serverConnected = false;
    this.serverError = '';
    this.databases = [];
    this.tables = [];
    this.columns = [];
    this.config.databaseName = '';
    this.config.tableName = '';
  }

  onAuthChange() {
    this.serverConnected = false;
    this.serverError = '';
    this.config.username = '';
    this.config.password = '';
  }

  loadDatabases() {
    this.loadingDbs = true;
    this.http.get<any>(`${this.apiBase}/api/external/databases`, {
      headers: this.getCredentialHeaders()
    }).subscribe({
      next: res => { this.databases = res.data; this.showDbList = true; this.loadingDbs = false; },
      error: () => { this.loadingDbs = false; }
    });
  }

  selectDb(db: string) {
    this.config.databaseName = db;
    this.showDbList = false;
    this.tables = [];
    this.columns = [];
    this.config.tableName = '';
  }

  onDbChange() {
    this.tables = [];
    this.columns = [];
    this.config.tableName = '';
    this.showDbList = false;
    this.showTableList = false;
  }

  loadTables() {
    if (!this.config.databaseName) return;
    this.loadingTables = true;
    this.http.get<any>(
      `${this.apiBase}/api/external/databases/${this.config.databaseName}/tables`,
      {
        headers: this.getCredentialHeaders(),
        params: { schema: this.config.schemaName || 'dbo' }
      }
    ).subscribe({
      next: res => { this.tables = res.data; this.showTableList = true; this.loadingTables = false; },
      error: () => { this.loadingTables = false; }
    });
  }

  selectTable(t: string) {
    this.config.tableName = t;
    this.showTableList = false;
    this.loadColumns();
  }

  onTableChange() {
    this.columns = [];
    this.showTableList = false;
    this.showColList = false;
  }

  loadColumns() {
    if (!this.config.tableName || !this.config.databaseName) return;

    if (this.hasConnector) {
      this.loadingCols = true;
      this.http.get<any>(`${this.apiBase}/api/forms/${this.form.id}/connector/columns`)
        .subscribe({
          next: res => { this.columns = res.data; this.loadingCols = false; },
          error: () => { this.loadingCols = false; }
        });
      return;
    }

    this.loadingCols = true;
    this.http.get<any>(
      `${this.apiBase}/api/external/databases/${this.config.databaseName}/tables/${this.config.tableName}/columns`,
      {
        headers: this.getCredentialHeaders(),
        params: { schema: this.config.schemaName || 'dbo' }
      }
    ).subscribe({
      next: res => { this.columns = res.data; this.showColList = true; this.loadingCols = false; },
      error: () => { this.loadingCols = false; }
    });
  }

  selectPk(col: string) {
    this.config.primaryKeyColumn = col;
    this.showColList = false;
  }

  getFormField(colName: string): string | undefined {
    return this.form?.controls
      ?.find(c => c.fieldName.toLowerCase() === colName.toLowerCase())
      ?.fieldName;
  }

  testConnection() {
    this.testing = true;
    this.testResult = undefined;
    this.ensureConnectionId().then(() => {
      this.http.post<any>(`${this.apiBase}/api/forms/${this.form.id}/connector`, this.buildPayload())
        .subscribe({
          next: () => {
            this.http.post<any>(`${this.apiBase}/api/forms/${this.form.id}/connector/test`, {})
              .subscribe({
                next: res => { this.testResult = res.data; this.testing = false; this.hasConnector = true; this.loadColumns(); },
                error: () => { this.testing = false; }
              });
          },
          error: () => { this.testing = false; }
        });
    }).catch(() => { this.testing = false; });
  }

  saveConnector() {
    this.saving = true;
    this.saveMsg = '';
    this.ensureConnectionId().then(() => {
      this.http.post<any>(`${this.apiBase}/api/forms/${this.form.id}/connector`, this.buildPayload())
        .subscribe({
          next: () => {
            this.saving = false;
            this.hasConnector = true;
            this.saveMsg = '✓ Connector saved! Records tab will now use this external table.';
            this.saved.emit();
            setTimeout(() => this.saveMsg = '', 4000);
          },
          error: err => {
            this.saving = false;
            this.saveMsg = '✗ ' + (err?.error?.message || 'Save failed');
          }
        });
    }).catch(() => {
      this.saving = false;
      this.saveMsg = '✗ Failed to create connection. Please try again.';
    });
  }

  /**
   * If no saved connectionId exists (manual mode), auto-create an
   * ExternalConnection so the backend always has credentials to use.
   */
  private ensureConnectionId(): Promise<void> {
    if (this.config.externalConnectionId) {
      return Promise.resolve();
    }

    const payload = {
      name:        `Auto: ${this.config.serverName}/${this.config.databaseName}`,
      serverName:  this.config.serverName,
      authType:    this.config.authType,
      username:    this.config.authType === 'SqlServer' ? this.config.username : null,
      password:    this.config.authType === 'SqlServer' ? this.config.password : null,
      description: `Auto-created for form "${this.form.name}" connector`
    };

    return new Promise((resolve, reject) => {
      this.http.post<any>(`${this.apiBase}/api/connections`, payload).subscribe({
        next: res => {
          this.config.externalConnectionId = res.data?.id || res.data;
          this.loadSavedConnections();
          resolve();
        },
        error: reject
      });
    });
  }

  removeConnector() {
    if (!confirm('Remove connector? The form will go back to using FormRecords.')) return;
    this.http.delete<any>(`${this.apiBase}/api/forms/${this.form.id}/connector`)
      .subscribe({
        next: () => {
          this.hasConnector = false;
          this.serverConnected = false;
          this.columns = [];
          this.testResult = undefined;
          this.saved.emit();
        }
      });
  }

  private buildPayload() {
    return {
      externalConnectionId: this.config.externalConnectionId || null,
      serverName:       this.config.serverName,
      authType:         this.config.authType,
      username:         this.config.authType === 'SqlServer' ? this.config.username : null,
      password:         this.config.authType === 'SqlServer' ? this.config.password : null,
      databaseName:     this.config.databaseName,
      schemaName:       this.config.schemaName || 'dbo',
      tableName:        this.config.tableName,
      primaryKeyColumn: this.config.primaryKeyColumn || 'Id',
      excludeColumns:   this.config.excludeColumns || null,
      defaultFilter:    this.config.defaultFilter   || null,
      defaultOrderBy:   this.config.defaultOrderBy  || null,
    };
  }
}
