// src/app/components/connection-manager.component.ts — NEW FILE

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
interface ExternalConnection {
  id: number;
  name: string;
  serverName: string;
  authType: 'Windows' | 'SqlServer';
  username?: string;
  description?: string;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  formsCount: number;
}

interface ConnectionForm {
  name: string;
  serverName: string;
  authType: 'Windows' | 'SqlServer';
  username: string;
  password: string;
  description: string;
}

@Component({
  selector: 'app-connection-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
<div class="cm-page">

  <!-- Header -->
  <div class="cm-header">
    <div>
      <h1>External Connections</h1>
      <p>Manage saved database connections. Used by form connectors to access external tables.</p>
    </div>
    <button class="cm-btn cm-btn--primary" (click)="openCreate()">+ New Connection</button>
  </div>

  <!-- Connection cards -->
  <div class="cm-list" *ngIf="!loading">

    <div class="cm-empty" *ngIf="connections.length === 0">
      <div class="cm-empty__icon">⊡</div>
      <h3>No connections yet</h3>
      <p>Create your first saved connection to use in form connectors</p>
      <button class="cm-btn cm-btn--primary" (click)="openCreate()">+ New Connection</button>
    </div>

    <div class="cm-card" *ngFor="let conn of connections">
      <div class="cm-card__left">
        <div class="cm-card__icon"
          [class.icon--windows]="conn.authType === 'Windows'"
          [class.icon--sql]="conn.authType === 'SqlServer'">
          {{ conn.authType === 'Windows' ? '⊞' : '⊡' }}
        </div>
        <div>
          <div class="cm-card__name">{{ conn.name }}</div>
          <div class="cm-card__server">{{ conn.serverName }}</div>
          <div class="cm-card__meta">
            <span class="cm-badge"
              [class.badge--windows]="conn.authType === 'Windows'"
              [class.badge--sql]="conn.authType === 'SqlServer'">
              {{ conn.authType === 'Windows' ? 'Windows Auth' : 'SQL Server Auth' }}
            </span>
            <span class="cm-badge badge--forms" *ngIf="conn.formsCount > 0">
              {{ conn.formsCount }} form{{ conn.formsCount > 1 ? 's' : '' }}
            </span>
            <span class="cm-test-ok"  *ngIf="conn.lastTestOk === true">✓ Connected</span>
            <span class="cm-test-err" *ngIf="conn.lastTestOk === false">✗ Failed</span>
          </div>
          <div class="cm-card__desc" *ngIf="conn.description">{{ conn.description }}</div>
        </div>
      </div>
      <div class="cm-card__actions">
        <button class="cm-icon-btn test-btn"
          (click)="testConnection(conn)"
          [disabled]="testingId === conn.id"
          title="Test connection">
          {{ testingId === conn.id ? '…' : '⊡' }}
        </button>
        <button class="cm-icon-btn edit-btn" (click)="openEdit(conn)" title="Edit">✏</button>
        <button class="cm-icon-btn del-btn"
          (click)="deleteConnection(conn)"
          [disabled]="conn.formsCount > 0"
          [title]="conn.formsCount > 0 ? 'In use by ' + conn.formsCount + ' form(s)' : 'Delete'">
          ⊗
        </button>
      </div>
    </div>
  </div>

  <div class="cm-loading" *ngIf="loading">
    <div class="cm-spinner"></div><span>Loading…</span>
  </div>

  <!-- ====== CREATE / EDIT MODAL ====== -->
  <div class="cm-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
    <div class="cm-modal">

      <div class="cm-modal__header">
        <h3>{{ editingId ? 'Edit Connection' : 'New Connection' }}</h3>
        <button class="cm-modal__close" (click)="closeModal()">✕</button>
      </div>

      <div class="cm-modal__body">

        <!-- Name -->
        <div class="cm-field">
          <label>Connection Name <span class="req">*</span></label>
          <input type="text" [(ngModel)]="form.name"
            placeholder="e.g. Production CRM, LUMIÈRE DB"
            [class.field--error]="submitted && !form.name" />
          <span class="err-msg" *ngIf="submitted && !form.name">Name is required</span>
        </div>

        <!-- Server -->
        <div class="cm-field">
          <label>Server Name <span class="req">*</span></label>
          <input type="text" [(ngModel)]="form.serverName"
            placeholder="e.g. DESKTOP-ABC\SQLEXPRESS  or  192.168.1.10  or  ."
            [class.field--error]="submitted && !form.serverName" />
          <span class="err-msg" *ngIf="submitted && !form.serverName">Server name is required</span>
          <div class="cm-hints">
            <span (click)="form.serverName = '.'">Use <code>.</code> for local</span>
            <span (click)="form.serverName = 'localhost'">Use <code>localhost</code></span>
            <span (click)="form.serverName = '(localdb)\\mssqllocaldb'">Use LocalDB</span>
          </div>
        </div>

        <!-- Auth Type -->
        <div class="cm-field">
          <label>Authentication</label>
          <div class="cm-auth-cards">
            <div class="cm-auth-card"
              [class.selected]="form.authType === 'Windows'"
              (click)="form.authType = 'Windows'">
              <span class="auth-icon">⊞</span>
              <div>
                <div class="auth-name">Windows Authentication</div>
                <div class="auth-desc">Uses current Windows identity (Integrated Security)</div>
              </div>
            </div>
            <div class="cm-auth-card"
              [class.selected]="form.authType === 'SqlServer'"
              (click)="form.authType = 'SqlServer'">
              <span class="auth-icon">⊡</span>
              <div>
                <div class="auth-name">SQL Server Authentication</div>
                <div class="auth-desc">Username and password login</div>
              </div>
            </div>
          </div>
        </div>

        <!-- SQL Server credentials -->
        <div class="cm-field-row" *ngIf="form.authType === 'SqlServer'">
          <div class="cm-field">
            <label>Username <span class="req">*</span></label>
            <input type="text" [(ngModel)]="form.username"
              placeholder="sa"
              [class.field--error]="submitted && form.authType === 'SqlServer' && !form.username" />
          </div>
          <div class="cm-field">
            <label>Password {{ editingId ? '(leave blank to keep existing)' : '' }}</label>
            <div class="cm-pw-row">
              <input [type]="showPassword ? 'text' : 'password'"
                [(ngModel)]="form.password"
                placeholder="{{ editingId ? '••••••••' : 'Enter password' }}" />
              <button type="button" class="cm-pw-toggle"
                (click)="showPassword = !showPassword">
                {{ showPassword ? '🙈' : '👁' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="cm-field">
          <label>Description <span class="optional">(optional)</span></label>
          <input type="text" [(ngModel)]="form.description"
            placeholder="What is this connection for?" />
        </div>

        <!-- Test result -->
        <div class="cm-test-banner"
          *ngIf="modalTestResult"
          [class.test--ok]="modalTestResult.success"
          [class.test--err]="!modalTestResult.success">
          <span>{{ modalTestResult.success ? '✓' : '✗' }}</span>
          <span>{{ modalTestResult.message }}</span>
        </div>

      </div>

      <div class="cm-modal__footer">
        <button class="cm-btn cm-btn--outline" (click)="testDirect()"
          [disabled]="modalTesting || !form.serverName">
          {{ modalTesting ? 'Testing…' : '⊡ Test Connection' }}
        </button>
        <div class="cm-modal__right">
          <button class="cm-btn cm-btn--ghost" (click)="closeModal()">Cancel</button>
          <button class="cm-btn cm-btn--primary" (click)="save()" [disabled]="saving">
            {{ saving ? 'Saving…' : (editingId ? '✓ Update' : '✓ Create') }}
          </button>
        </div>
      </div>

    </div>
  </div>

  <!-- Toast -->
  <div class="cm-toast" [class.show]="toastVisible" [class.toast--err]="toastError">
    {{ toastMsg }}
  </div>

</div>
  `,
  styles: [`
    .cm-page { padding: 28px 32px; max-width: 900px; margin: 0 auto; font-family: inherit; }

    .cm-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px;
      h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 6px; }
      p  { font-size: 14px; color: #64748b; margin: 0; }
    }

    /* Buttons */
    .cm-btn { padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: .15s; }
    .cm-btn--primary { background: #2563eb; color: white; }
    .cm-btn--primary:hover { background: #1d4ed8; }
    .cm-btn--primary:disabled { opacity: .5; cursor: not-allowed; }
    .cm-btn--outline { background: transparent; border: 1.5px solid #2563eb; color: #2563eb; }
    .cm-btn--outline:hover { background: #eff6ff; }
    .cm-btn--outline:disabled { opacity: .5; cursor: not-allowed; }
    .cm-btn--ghost { background: transparent; border: 1.5px solid #e5e7eb; color: #64748b; }
    .cm-btn--ghost:hover { background: #f8fafc; }

    /* List */
    .cm-list { display: flex; flex-direction: column; gap: 12px; }
    .cm-empty { text-align: center; padding: 80px 20px; color: #94a3b8;
      .cm-empty__icon { font-size: 48px; }
      h3 { font-size: 18px; font-weight: 600; color: #374151; margin: 12px 0 8px; }
      p  { font-size: 14px; margin-bottom: 20px; }
    }

    /* Card */
    .cm-card {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 20px; background: white; border: 1.5px solid #e5e7eb;
      border-radius: 12px; gap: 16px; transition: .15s;
      &:hover { border-color: #93c5fd; box-shadow: 0 2px 12px rgba(37,99,235,.08); }
    }
    .cm-card__left { display: flex; gap: 14px; align-items: flex-start; flex: 1; }
    .cm-card__icon { font-size: 28px; flex-shrink: 0; padding-top: 2px;
      &.icon--windows { color: #0078d4; }
      &.icon--sql     { color: #e74c3c; }
    }
    .cm-card__name   { font-size: 15px; font-weight: 700; color: #0f172a; }
    .cm-card__server { font-size: 13px; font-family: monospace; color: #2563eb; margin: 2px 0 6px; }
    .cm-card__meta   { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .cm-card__desc   { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .cm-badge { font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 99px;
      &.badge--windows { background: #dbeafe; color: #1d4ed8; }
      &.badge--sql     { background: #fee2e2; color: #b91c1c; }
      &.badge--forms   { background: #f1f5f9; color: #475569; }
    }
    .cm-test-ok  { font-size: 12px; color: #16a34a; font-weight: 600; }
    .cm-test-err { font-size: 12px; color: #dc2626; font-weight: 600; }

    .cm-card__actions { display: flex; gap: 6px; flex-shrink: 0; }
    .cm-icon-btn { width: 32px; height: 32px; border: 1.5px solid #e5e7eb; background: white; border-radius: 7px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: .15s;
      &.test-btn:hover:not(:disabled) { background: #eff6ff; border-color: #2563eb; color: #2563eb; }
      &.edit-btn:hover { background: #fefce8; border-color: #ca8a04; color: #ca8a04; }
      &.del-btn:hover:not(:disabled)  { background: #fef2f2; border-color: #dc2626; color: #dc2626; }
      &:disabled { opacity: .35; cursor: not-allowed; }
    }

    /* Loading */
    .cm-loading { display: flex; align-items: center; gap: 12px; padding: 60px; color: #64748b; justify-content: center; }
    .cm-spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Modal */
    .cm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 16px; backdrop-filter: blur(4px); }
    .cm-modal { background: white; border-radius: 16px; width: 100%; max-width: 580px; box-shadow: 0 24px 48px rgba(0,0,0,.2); animation: slideUp .2s ease; overflow: hidden; }
    @keyframes slideUp { from { opacity:0; transform: translateY(16px) scale(.97); } to { opacity:1; transform: none; } }

    .cm-modal__header { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #e5e7eb;
      h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    }
    .cm-modal__close { width: 28px; height: 28px; border: none; background: #f1f5f9; border-radius: 50%; cursor: pointer; font-size: 13px; color: #64748b;
      &:hover { background: #fef2f2; color: #ef4444; }
    }
    .cm-modal__body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; max-height: 60vh; overflow-y: auto; }
    .cm-modal__footer { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid #e5e7eb; }
    .cm-modal__right { display: flex; gap: 8px; }

    /* Form fields */
    .cm-field { display: flex; flex-direction: column; gap: 5px;
      label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
      input { padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; color: #0f172a; transition: .15s;
        &:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
        &.field--error { border-color: #ef4444; }
      }
    }
    .cm-field-row { display: flex; gap: 12px; }
    .cm-field-row .cm-field { flex: 1; }
    .req { color: #ef4444; }
    .optional { color: #94a3b8; font-weight: 400; text-transform: none; }
    .err-msg { font-size: 12px; color: #ef4444; }

    .cm-hints { display: flex; gap: 8px; flex-wrap: wrap;
      span { font-size: 11px; color: #2563eb; cursor: pointer; text-decoration: underline;
        code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
        &:hover { color: #1d4ed8; }
      }
    }

    /* Auth cards */
    .cm-auth-cards { display: flex; flex-direction: column; gap: 8px; }
    .cm-auth-card { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: .15s;
      &.selected { border-color: #2563eb; background: #eff6ff; }
      &:hover:not(.selected) { border-color: #93c5fd; }
      .auth-icon { font-size: 20px; flex-shrink: 0; }
      .auth-name { font-size: 13px; font-weight: 600; color: #0f172a; }
      .auth-desc { font-size: 12px; color: #64748b; margin-top: 2px; }
    }

    /* Password row */
    .cm-pw-row { display: flex; border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden;
      &:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      input { flex: 1; padding: 10px 12px; border: none; outline: none; font-size: 14px; font-family: inherit; color: #0f172a; }
    }
    .cm-pw-toggle { padding: 0 12px; border: none; border-left: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-size: 14px; }

    /* Test banner */
    .cm-test-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
      &.test--ok  { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }
      &.test--err { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    }

    /* Toast */
    .cm-toast { position: fixed; bottom: 24px; right: 24px; background: #0f172a; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; opacity: 0; transform: translateY(8px); transition: .25s; pointer-events: none;
      &.show { opacity: 1; transform: none; }
      &.toast--err { background: #dc2626; }
    }
  `]
})
export class ConnectionManagerComponent implements OnInit {
  private http    = inject(HttpClient);
    private apiBase = environment.apiBase;

  connections: ExternalConnection[] = [];
  loading     = false;
  showModal   = false;
  editingId?: number;
  submitted   = false;
  saving      = false;
  showPassword = false;
  testingId?: number;
  modalTesting   = false;
  modalTestResult?: { success: boolean; message: string };
  toastVisible   = false;
  toastMsg       = '';
  toastError     = false;

  form: ConnectionForm = this.emptyForm();

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<any>(`${this.apiBase}/api/connections`).subscribe({
      next: res => { this.connections = res.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openCreate() {
    this.editingId      = undefined;
    this.form           = this.emptyForm();
    this.submitted      = false;
    this.modalTestResult = undefined;
    this.showPassword   = false;
    this.showModal      = true;
  }

  openEdit(conn: ExternalConnection) {
    this.editingId = conn.id;
    this.form = {
      name:        conn.name,
      serverName:  conn.serverName,
      authType:    conn.authType,
      username:    conn.username || '',
      password:    '',   // never pre-fill password
      description: conn.description || ''
    };
    this.submitted       = false;
    this.modalTestResult = undefined;
    this.showPassword    = false;
    this.showModal       = true;
  }

  closeModal() { this.showModal = false; }

  onOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('cm-overlay')) this.closeModal();
  }

  save() {
    this.submitted = true;
    if (!this.form.name || !this.form.serverName) return;
    if (this.form.authType === 'SqlServer' && !this.form.username) return;

    this.saving = true;
    const payload = {
      name:        this.form.name,
      serverName:  this.form.serverName,
      authType:    this.form.authType,
      username:    this.form.authType === 'SqlServer' ? this.form.username : null,
      password:    this.form.authType === 'SqlServer' && this.form.password ? this.form.password : null,
      description: this.form.description || null
    };

    const obs = this.editingId
      ? this.http.put<any>(`${this.apiBase}/api/connections/${this.editingId}`, payload)
      : this.http.post<any>(`${this.apiBase}/api/connections`, payload);

    obs.subscribe({
      next: () => {
        this.saving    = false;
        this.showModal = false;
        this.load();
        this.toast(this.editingId ? 'Connection updated!' : 'Connection created!');
      },
      error: err => {
        this.saving = false;
        this.toast(err?.error?.message || 'Save failed', true);
      }
    });
  }

  testDirect() {
    this.modalTesting    = true;
    this.modalTestResult = undefined;

    const payload = {
      serverName:   this.form.serverName,
      authType:     this.form.authType,
      username:     this.form.authType === 'SqlServer' ? this.form.username : null,
      password:     this.form.authType === 'SqlServer' ? this.form.password : null,
      databaseName: null
    };

    this.http.post<any>(`${this.apiBase}/api/connections/test`, payload).subscribe({
      next: res => {
        this.modalTesting    = false;
        this.modalTestResult = { success: res.data.success, message: res.data.message };
      },
      error: () => {
        this.modalTesting    = false;
        this.modalTestResult = { success: false, message: 'Test request failed' };
      }
    });
  }

  testConnection(conn: ExternalConnection) {
    this.testingId = conn.id;
    this.http.post<any>(`${this.apiBase}/api/connections/${conn.id}/test`, {})
      .subscribe({
        next: res => {
          this.testingId = undefined;
          conn.lastTestOk = res.data.success;
          this.toast(res.data.message, !res.data.success);
        },
        error: () => { this.testingId = undefined; }
      });
  }

  deleteConnection(conn: ExternalConnection) {
    if (!confirm(`Delete "${conn.name}"?`)) return;
    this.http.delete<any>(`${this.apiBase}/api/connections/${conn.id}`).subscribe({
      next: () => { this.load(); this.toast('Connection deleted'); },
      error: () => this.toast('Failed to delete', true)
    });
  }

  private emptyForm(): ConnectionForm {
    return { name: '', serverName: '', authType: 'Windows', username: '', password: '', description: '' };
  }

  private toast(msg: string, error = false) {
    this.toastMsg     = msg;
    this.toastError   = error;
    this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 3000);
  }
}
