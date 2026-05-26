// src/app/components/api-manager.component.ts

import {
  Component, OnInit, inject, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

// ---- Interfaces ----
interface ApiEnvironment {
  id: number;
  name: string;
  variables: { key: string; value: string }[];
  isActive: boolean;
}

interface ApiHeader {
  key: string;
  value: string;
  enabled: boolean;
}

interface ApiParam {
  key: string;
  value: string;
  enabled: boolean;
}

interface ApiRequest {
  id: number;
  collectionId: number;
  folderId?: number;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: ApiHeader[];
  params: ApiParam[];
  authType: 'none' | 'bearer' | 'apikey' | 'basic';
  authToken?: string;
  authApiKey?: string;
  authApiKeyHeader?: string;
  authUsername?: string;
  authPassword?: string;
  body?: string;
  bodyType: 'json' | 'form';
  sortOrder: number;
}

interface ApiFolder {
  id: number;
  collectionId: number;
  name: string;
  expanded: boolean;
  sortOrder: number;
}

interface ApiCollection {
  id: number;
  name: string;
  expanded: boolean;
  sortOrder: number;
}

interface ApiResponse {
  status: number;
  statusText: string;
  time: number;
  size: string;
  headers: { key: string; value: string }[];
  body: string;
  isJson: boolean;
}

@Component({
  selector: 'app-api-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="am-shell">

  <!-- ===== ENVIRONMENT BAR ===== -->
  <div class="am-envbar">
    <div class="am-envbar__left">
      <span class="am-envbar__label">Environment</span>
      <select [(ngModel)]="activeEnvId" (change)="onEnvChange()" class="am-env-select">
        <option [ngValue]="0">No Environment</option>
        <option *ngFor="let env of environments" [ngValue]="env.id">{{ env.name }}</option>
      </select>
      <button class="am-env-btn" (click)="showEnvModal = true" title="Manage Environments">&#9881;</button>
    </div>
    <div class="am-envbar__right">
      <span class="am-envbar__hint" *ngIf="activeEnv">
        {{ activeEnv.variables.length }} variable(s) &mdash; use {{ '{' }}{{ '{' }}key{{ '}' }}{{ '}' }} in URLs
      </span>
    </div>
  </div>

  <div class="am-main">

    <!-- ===== LEFT: Collections Tree ===== -->
    <div class="am-sidebar">
      <div class="am-sidebar__header">
        <h3>Collections</h3>
        <button class="am-sidebar__btn" (click)="addCollection()" title="New Collection">+</button>
      </div>

      <div class="am-tree">
        <div *ngFor="let col of collections" class="am-tree-collection">
          <!-- Collection header -->
          <div class="am-tree-node am-tree-node--collection"
            [class.expanded]="col.expanded"
            (click)="col.expanded = !col.expanded">
            <span class="am-tree-arrow">{{ col.expanded ? '&#9662;' : '&#9656;' }}</span>
            <span class="am-tree-icon">&#128193;</span>
            <span class="am-tree-name" *ngIf="editingNodeId !== 'col-'+col.id">{{ col.name }}</span>
            <input *ngIf="editingNodeId === 'col-'+col.id" class="am-tree-rename"
              [(ngModel)]="col.name" (blur)="editingNodeId=null" (keydown.enter)="editingNodeId=null"
              autofocus />
            <div class="am-tree-actions" (click)="$event.stopPropagation()">
              <button (click)="addFolder(col)" title="Add Folder">&#128194;</button>
              <button (click)="addRequest(col.id)" title="Add Request">+</button>
              <button (click)="editingNodeId='col-'+col.id" title="Rename">&#9998;</button>
              <button class="danger" (click)="deleteCollection(col)" title="Delete">&times;</button>
            </div>
          </div>

          <!-- Folders & Requests -->
          <div class="am-tree-children" *ngIf="col.expanded">
            <!-- Folders -->
            <div *ngFor="let folder of getFolders(col.id)" class="am-tree-folder">
              <div class="am-tree-node am-tree-node--folder"
                [class.expanded]="folder.expanded"
                (click)="folder.expanded = !folder.expanded">
                <span class="am-tree-arrow">{{ folder.expanded ? '&#9662;' : '&#9656;' }}</span>
                <span class="am-tree-icon">&#128194;</span>
                <span class="am-tree-name" *ngIf="editingNodeId !== 'fol'+folder.id">{{ folder.name }}</span>
                <input *ngIf="editingNodeId === 'fol'+folder.id" class="am-tree-rename"
                  [(ngModel)]="folder.name" (blur)="editingNodeId=null" (keydown.enter)="editingNodeId=null"
                  autofocus />
                <div class="am-tree-actions" (click)="$event.stopPropagation()">
                  <button (click)="addRequest(col.id, folder.id)" title="Add Request">+</button>
                  <button (click)="editingNodeId='fol'+folder.id" title="Rename">&#9998;</button>
                  <button class="danger" (click)="deleteFolder(folder)" title="Delete">&times;</button>
                </div>
              </div>
              <div class="am-tree-children" *ngIf="folder.expanded">
                <div *ngFor="let req of getRequests(col.id, folder.id)"
                  class="am-tree-node am-tree-node--request"
                  [class.active]="activeRequest?.id === req.id"
                  (click)="selectRequest(req)">
                  <span class="am-method-badge" [class]="'method-'+req.method">{{ req.method }}</span>
                  <span class="am-tree-name">{{ req.name }}</span>
                  <div class="am-tree-actions" (click)="$event.stopPropagation()">
                    <button (click)="duplicateRequest(req)">&#8853;</button>
                    <button class="danger" (click)="deleteRequest(req)">&times;</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Root-level requests (no folder) -->
            <div *ngFor="let req of getRequests(col.id, undefined)"
              class="am-tree-node am-tree-node--request"
              [class.active]="activeRequest?.id === req.id"
              (click)="selectRequest(req)">
              <span class="am-method-badge" [class]="'method-'+req.method">{{ req.method }}</span>
              <span class="am-tree-name">{{ req.name }}</span>
              <div class="am-tree-actions" (click)="$event.stopPropagation()">
                <button (click)="duplicateRequest(req)">&#8853;</button>
                <button class="danger" (click)="deleteRequest(req)">&times;</button>
              </div>
            </div>
          </div>
        </div>

        <div class="am-tree-empty" *ngIf="collections.length === 0">
          <p>No collections yet</p>
          <button class="am-btn am-btn--primary am-btn--sm" (click)="addCollection()">+ New Collection</button>
        </div>
      </div>
    </div>

    <!-- ===== RIGHT: Request Editor ===== -->
    <div class="am-editor">
      <div class="am-editor-empty" *ngIf="!activeRequest">
        <div class="am-editor-empty__icon">&#9633;</div>
        <h3>API Manager</h3>
        <p>Select a request from the sidebar or create a new one to get started</p>
      </div>

      <div class="am-editor-content" *ngIf="activeRequest">

        <!-- Request name -->
        <div class="am-req-name-row">
          <input class="am-req-name" [(ngModel)]="activeRequest.name" placeholder="Request Name" />
        </div>

        <!-- URL bar -->
        <div class="am-url-bar">
          <select class="am-method-select" [(ngModel)]="activeRequest.method"
            [class]="'method-'+activeRequest.method">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input class="am-url-input" [(ngModel)]="activeRequest.url"
            [placeholder]="urlPlaceholder"
            (keydown.enter)="sendRequest()" />
          <button class="am-send-btn" (click)="sendRequest()" [disabled]="sending">
            {{ sending ? '...' : 'Send' }}
          </button>
        </div>

        <!-- Request tabs -->
        <div class="am-req-tabs">
          <button [class.active]="reqTab === 'params'" (click)="reqTab='params'">
            Params <span class="am-tab-count" *ngIf="enabledParams > 0">{{ enabledParams }}</span>
          </button>
          <button [class.active]="reqTab === 'headers'" (click)="reqTab='headers'">
            Headers <span class="am-tab-count" *ngIf="enabledHeaders > 0">{{ enabledHeaders }}</span>
          </button>
          <button [class.active]="reqTab === 'auth'" (click)="reqTab='auth'">Authorization</button>
          <button [class.active]="reqTab === 'body'" (click)="reqTab='body'">Body</button>
        </div>

        <!-- Params tab -->
        <div class="am-tab-content" *ngIf="reqTab === 'params'">
          <div class="am-kv-header">
            <span></span><span>Key</span><span>Value</span><span></span>
          </div>
          <div class="am-kv-row" *ngFor="let p of activeRequest.params; let i = index">
            <label class="am-kv-check">
              <input type="checkbox" [(ngModel)]="p.enabled" />
            </label>
            <input class="am-kv-input" [(ngModel)]="p.key" placeholder="key" />
            <input class="am-kv-input" [(ngModel)]="p.value" placeholder="value" />
            <button class="am-kv-del" (click)="activeRequest.params.splice(i, 1)">&times;</button>
          </div>
          <button class="am-kv-add" (click)="addParam()">
            + Add Param
          </button>
        </div>

        <!-- Headers tab -->
        <div class="am-tab-content" *ngIf="reqTab === 'headers'">
          <div class="am-kv-header">
            <span></span><span>Key</span><span>Value</span><span></span>
          </div>
          <div class="am-kv-row" *ngFor="let h of activeRequest.headers; let i = index">
            <label class="am-kv-check">
              <input type="checkbox" [(ngModel)]="h.enabled" />
            </label>
            <input class="am-kv-input" [(ngModel)]="h.key" placeholder="Header name" />
            <input class="am-kv-input" [(ngModel)]="h.value" placeholder="Header value" />
            <button class="am-kv-del" (click)="activeRequest.headers.splice(i, 1)">&times;</button>
          </div>
          <button class="am-kv-add" (click)="addHeader()">
            + Add Header
          </button>
        </div>

        <!-- Authorization tab -->
        <div class="am-tab-content" *ngIf="reqTab === 'auth'">
          <div class="am-auth-type">
            <label>Auth Type</label>
            <select [(ngModel)]="activeRequest.authType">
              <option value="none">No Auth</option>
              <option value="bearer">Bearer Token</option>
              <option value="apikey">API Key</option>
              <option value="basic">Basic Auth</option>
            </select>
          </div>

          <div class="am-auth-fields" *ngIf="activeRequest.authType === 'bearer'">
            <label>Token</label>
            <input type="text" [(ngModel)]="activeRequest.authToken"
              placeholder="Paste your Bearer token" />
          </div>

          <div class="am-auth-fields" *ngIf="activeRequest.authType === 'apikey'">
            <div class="am-auth-row">
              <div class="am-auth-field">
                <label>Header Name</label>
                <input type="text" [(ngModel)]="activeRequest.authApiKeyHeader"
                  placeholder="X-API-Key" />
              </div>
              <div class="am-auth-field">
                <label>API Key</label>
                <input type="text" [(ngModel)]="activeRequest.authApiKey"
                  placeholder="your-api-key" />
              </div>
            </div>
          </div>

          <div class="am-auth-fields" *ngIf="activeRequest.authType === 'basic'">
            <div class="am-auth-row">
              <div class="am-auth-field">
                <label>Username</label>
                <input type="text" [(ngModel)]="activeRequest.authUsername" placeholder="user" />
              </div>
              <div class="am-auth-field">
                <label>Password</label>
                <input type="password" [(ngModel)]="activeRequest.authPassword" placeholder="****" />
              </div>
            </div>
          </div>

          <div class="am-auth-none" *ngIf="activeRequest.authType === 'none'">
            <span>This request does not use any authorization.</span>
          </div>
        </div>

        <!-- Body tab -->
        <div class="am-tab-content" *ngIf="reqTab === 'body'">
          <div class="am-body-toolbar">
            <div class="am-body-type-row">
              <span class="am-body-label">Body Type</span>
              <select class="am-body-type-select" [(ngModel)]="activeRequest.bodyType"
                (ngModelChange)="onBodyTypeChange()">
                <option value="json">JSON</option>
                <option value="form">x-www-form-urlencoded</option>
              </select>
            </div>
            <button class="am-body-format" (click)="formatBody()" title="Format"
              *ngIf="activeRequest.bodyType === 'json'">Format</button>
          </div>
          <textarea class="am-body-editor" [(ngModel)]="activeRequest.body"
            [placeholder]="activeRequest.bodyType === 'form' ? formBodyPlaceholder : bodyPlaceholder"
            rows="8"></textarea>
          <span class="am-body-hint" *ngIf="activeRequest.bodyType === 'form'">
            Use key=value&amp;key2=value2 format, e.g. grant_type=password&amp;username=admin&amp;password=secret
          </span>
        </div>

        <!-- ===== Response Panel ===== -->
        <div class="am-response" *ngIf="response || responseError">
          <div class="am-response-bar">
            <span class="am-response-title">Response</span>
            <div class="am-response-meta" *ngIf="response">
              <span class="am-status" [class]="getStatusClass(response.status)">
                {{ response.status }} {{ response.statusText }}
              </span>
              <span class="am-meta-item">Time: {{ response.time }}ms</span>
              <span class="am-meta-item">Size: {{ response.size }}</span>
            </div>
            <div class="am-response-actions">
              <button class="am-resp-btn" (click)="copyResponse()" *ngIf="response"
                title="Copy response">Copy</button>
            </div>
          </div>

          <!-- Error -->
          <div class="am-response-error" *ngIf="responseError">
            <span>&#9888; {{ responseError }}</span>
          </div>

          <!-- Response tabs -->
          <div class="am-resp-tabs" *ngIf="response">
            <button [class.active]="respTab === 'body'" (click)="respTab='body'">Body</button>
            <button [class.active]="respTab === 'headers'" (click)="respTab='headers'">
              Headers <span class="am-tab-count">{{ response.headers.length }}</span>
            </button>
            <button [class.active]="respTab === 'raw'" (click)="respTab='raw'">Raw</button>
          </div>

          <!-- Response body -->
          <div class="am-resp-body" *ngIf="response && respTab === 'body'">
            <pre class="am-json" *ngIf="response.isJson">{{ response.body }}</pre>
            <pre class="am-raw" *ngIf="!response.isJson">{{ response.body }}</pre>
          </div>

          <!-- Response headers -->
          <div class="am-resp-headers" *ngIf="response && respTab === 'headers'">
            <div class="am-kv-header"><span>Key</span><span>Value</span></div>
            <div class="am-resp-header-row" *ngFor="let h of response.headers">
              <span class="am-resp-hkey">{{ h.key }}</span>
              <span class="am-resp-hval">{{ h.value }}</span>
            </div>
          </div>

          <!-- Raw -->
          <div class="am-resp-body" *ngIf="response && respTab === 'raw'">
            <pre class="am-raw">{{ response.body }}</pre>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ===== ENVIRONMENT MODAL ===== -->
  <div class="am-overlay" *ngIf="showEnvModal" (click)="onOverlay($event)">
    <div class="am-modal">
      <div class="am-modal__header">
        <h3>Manage Environments</h3>
        <button (click)="showEnvModal=false">&times;</button>
      </div>
      <div class="am-modal__body">
        <div class="am-env-list">
          <div class="am-env-item" *ngFor="let env of environments; let i = index"
            [class.active]="editingEnvIdx === i" (click)="editingEnvIdx = i">
            <span>{{ env.name }}</span>
            <button class="danger" (click)="deleteEnvironment(i); $event.stopPropagation()">&times;</button>
          </div>
          <button class="am-kv-add" (click)="addEnvironment()">+ Add Environment</button>
        </div>

        <div class="am-env-editor" *ngIf="editingEnvIdx >= 0 && environments[editingEnvIdx]">
          <div class="am-env-name-row">
            <label>Name</label>
            <input type="text" [(ngModel)]="environments[editingEnvIdx].name" placeholder="e.g. Dev, UAT, Prod" />
          </div>
          <div class="am-env-vars-header">
            <span>Variable</span><span>Value</span><span></span>
          </div>
          <div class="am-kv-row" *ngFor="let v of environments[editingEnvIdx].variables; let vi = index">
            <input class="am-kv-input" [(ngModel)]="v.key" placeholder="baseUrl" />
            <input class="am-kv-input" [(ngModel)]="v.value" placeholder="https://api.dev.example.com" />
            <button class="am-kv-del" (click)="environments[editingEnvIdx].variables.splice(vi, 1)">&times;</button>
          </div>
          <button class="am-kv-add"
            (click)="addEnvVariable()">
            + Add Variable
          </button>
        </div>
      </div>
      <div class="am-modal__footer">
        <button class="am-btn am-btn--outline" (click)="showEnvModal=false">Close</button>
        <button class="am-btn am-btn--primary" (click)="saveEnvironments()">Save</button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="am-toast" [class.show]="toastVisible">{{ toastMsg }}</div>
</div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }

    /* Shell */
    .am-shell { display: flex; flex-direction: column; flex: 1; background: #f0f2f5; font-family: inherit; min-height: 0; overflow: hidden; }

    /* Environment bar */
    .am-envbar { display: flex; justify-content: space-between; align-items: center; padding: 6px 16px; background: #1e293b; flex-shrink: 0; }
    .am-envbar__left { display: flex; align-items: center; gap: 8px; }
    .am-envbar__label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
    .am-env-select { padding: 4px 10px; border: 1px solid #475569; border-radius: 6px; background: #334155; color: #e2e8f0; font-size: 12px; outline: none; font-family: inherit;
      &:focus { border-color: #60a5fa; } }
    .am-env-btn { width: 26px; height: 26px; border: 1px solid #475569; background: #334155; color: #94a3b8; border-radius: 6px; cursor: pointer; font-size: 12px;
      &:hover { background: #475569; color: #e2e8f0; } }
    .am-envbar__right { font-size: 11px; color: #64748b; code { background: #334155; padding: 1px 5px; border-radius: 3px; color: #60a5fa; } }
    .am-envbar__hint { font-size: 11px; color: #64748b; }

    /* Main layout */
    .am-main { display: flex; flex: 1; overflow: hidden; min-height: 0; }

    /* Sidebar */
    .am-sidebar { width: 280px; background: #fff; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
    .am-sidebar__header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #e5e7eb;
      h3 { font-size: 14px; font-weight: 600; color: #0f172a; margin: 0; } }
    .am-sidebar__btn { width: 28px; height: 28px; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; cursor: pointer; font-size: 16px; color: #2563eb;
      &:hover { background: #eff6ff; } }

    /* Tree */
    .am-tree { flex: 1; overflow-y: auto; padding: 8px 0; }
    .am-tree-node { display: flex; align-items: center; gap: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; color: #374151; position: relative; user-select: none;
      &:hover { background: #f8fafc; }
      &:hover .am-tree-actions { opacity: 1; }
      &.active { background: #eff6ff; color: #1d4ed8; } }
    .am-tree-node--collection { font-weight: 600; padding-left: 8px; }
    .am-tree-node--folder { padding-left: 24px; }
    .am-tree-node--request { padding-left: 40px; font-weight: 400; }
    .am-tree-children .am-tree-node--request { padding-left: 48px; }
    .am-tree-arrow { width: 14px; font-size: 10px; color: #94a3b8; flex-shrink: 0; }
    .am-tree-icon { font-size: 14px; flex-shrink: 0; }
    .am-tree-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .am-tree-rename { flex: 1; padding: 2px 6px; border: 1px solid #2563eb; border-radius: 4px; font-size: 13px; outline: none; font-family: inherit; }
    .am-tree-actions { display: flex; gap: 2px; opacity: 0; transition: .15s;
      button { width: 22px; height: 22px; border: none; background: transparent; cursor: pointer; font-size: 11px; color: #94a3b8; border-radius: 4px;
        &:hover { background: #eff6ff; color: #2563eb; }
        &.danger:hover { background: #fef2f2; color: #dc2626; } } }
    .am-tree-empty { padding: 24px 16px; text-align: center; color: #94a3b8; font-size: 13px; }
    .am-method-badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; flex-shrink: 0; letter-spacing: .02em; }
    .method-GET { background: #dcfce7; color: #166534; }
    .method-POST { background: #fef3c7; color: #92400e; }
    .method-PUT { background: #dbeafe; color: #1e40af; }
    .method-PATCH { background: #f3e8ff; color: #6b21a8; }
    .method-DELETE { background: #fee2e2; color: #991b1b; }

    /* Editor */
    .am-editor { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
    .am-editor-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8;
      .am-editor-empty__icon { font-size: 48px; margin-bottom: 12px; }
      h3 { font-size: 18px; color: #374151; margin: 0 0 6px; }
      p { font-size: 14px; } }
    .am-editor-content { flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 16px 20px; gap: 12px; min-height: 0; }

    /* Request name */
    .am-req-name-row { display: flex; }
    .am-req-name { flex: 1; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-weight: 600; outline: none; font-family: inherit; color: #0f172a;
      &:focus { border-color: #2563eb; } }

    /* URL bar */
    .am-url-bar { display: flex; gap: 0; border: 2px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff;
      &:focus-within { border-color: #2563eb; } }
    .am-method-select { padding: 10px 12px; border: none; border-right: 1px solid #e5e7eb; font-size: 13px; font-weight: 700; font-family: inherit; outline: none; cursor: pointer; background: #f8fafc; min-width: 90px; }
    .am-url-input { flex: 1; padding: 10px 14px; border: none; font-size: 14px; font-family: monospace; outline: none; color: #0f172a; }
    .am-send-btn { padding: 10px 24px; border: none; background: #2563eb; color: white; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: .15s;
      &:hover:not(:disabled) { background: #1d4ed8; }
      &:disabled { opacity: .6; cursor: not-allowed; } }

    /* Request tabs */
    .am-req-tabs { display: flex; gap: 0; border-bottom: 1px solid #e5e7eb;
      button { padding: 8px 16px; border: none, background: transparent; font-size: 13px; font-weight: 500; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; display: flex; align-items: center; gap: 5px;
        &.active { color: #2563eb; border-bottom-color: #2563eb; }
        &:hover:not(.active) { color: #0f172a; } } }
    .am-tab-count { font-size: 10px; background: #dbeafe; color: #1d4ed8; padding: 0 6px; border-radius: 99px; font-weight: 700; }
    .am-tab-content { padding: 12px 0; }

    /* Key-Value rows */
    .am-kv-header { display: grid; grid-template-columns: 28px 1fr 1fr 28px; gap: 8px; padding: 4px 0; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: .05em; }
    .am-kv-row { display: grid; grid-template-columns: 28px 1fr 1fr 28px; gap: 8px; align-items: center; padding: 4px 0; }
    .am-kv-check input { width: 14px; height: 14px; accent-color: #2563eb; cursor: pointer; }
    .am-kv-input { padding: 7px 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; font-family: inherit; outline: none; color: #0f172a;
      &:focus { border-color: #2563eb; } }
    .am-kv-del { width: 26px; height: 26px; border: none; background: transparent; cursor: pointer; font-size: 13px; color: #94a3b8; border-radius: 4px;
      &:hover { background: #fef2f2; color: #dc2626; } }
    .am-kv-add { padding: 6px 14px; border: 1px dashed #d1d5db; background: transparent; border-radius: 6px; font-size: 12px; color: #64748b; cursor: pointer; font-family: inherit; margin-top: 4px;
      &:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; } }

    /* Auth */
    .am-auth-type { display: flex; flex-direction: column; gap: 6px; max-width: 300px;
      label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; }
      select { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: inherit; outline: none; &:focus { border-color: #2563eb; } } }
    .am-auth-fields { margin-top: 14px; display: flex; flex-direction: column; gap: 8px;
      label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; }
      input { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: inherit; outline: none; &:focus { border-color: #2563eb; } } }
    .am-auth-row { display: flex; gap: 12px; .am-auth-field { flex: 1; display: flex; flex-direction: column; gap: 5px; } }
    .am-auth-none { padding: 16px 0; color: #94a3b8; font-size: 13px; }

    /* Body */
    .am-body-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .am-body-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; }
    .am-body-format { padding: 4px 10px; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: monospace; color: #64748b;
      &:hover { background: #eff6ff; color: #2563eb; border-color: #2563eb; } }
    .am-body-editor { width: 100%; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: monospace; outline: none; resize: vertical; color: #0f172a; line-height: 1.5;
      &:focus { border-color: #2563eb; } }
    .am-body-type-row { display: flex; align-items: center; gap: 8px; }
    .am-body-type-select { padding: 4px 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; font-family: inherit; outline: none; cursor: pointer; background: #f8fafc;
      &:focus { border-color: #2563eb; } }
    .am-body-hint { font-size: 11px; color: #94a3b8; margin-top: 6px; display: block; }

    /* Response */
    .am-response { border-top: 2px solid #e5e7eb; margin-top: 8px; }
    .am-response-bar { display: flex; align-items: center; gap: 12px; padding: 10px 0; flex-wrap: wrap; }
    .am-response-title { font-size: 13px; font-weight: 600; color: #374151; }
    .am-response-meta { display: flex; gap: 12px; align-items: center; }
    .am-status { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 6px; }
    .am-status.status-2xx { background: #dcfce7; color: #166534; }
    .am-status.status-3xx { background: #dbeafe; color: #1e40af; }
    .am-status.status-4xx { background: #fef3c7; color: #92400e; }
    .am-status.status-5xx { background: #fee2e2; color: #991b1b; }
    .am-meta-item { font-size: 12px; color: #64748b; }
    .am-response-actions { margin-left: auto; }
    .am-resp-btn { padding: 4px 12px; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; color: #374151;
      &:hover { background: #f8fafc; } }
    .am-response-error { padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; color: #dc2626; margin-bottom: 8px; }
    .am-resp-tabs { display: flex; border-bottom: 1px solid #e5e7eb;
      button { padding: 6px 14px; border: none; background: transparent; font-size: 12px; font-weight: 500; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; display: flex; align-items: center; gap: 5px;
        &.active { color: #2563eb; border-bottom-color: #2563eb; } } }
    .am-resp-body { max-height: 350px; overflow: auto; }
    .am-json { padding: 12px; font-size: 12px; font-family: monospace; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: #0f172a; margin: 0; background: #f8fafc; border-radius: 6px; }
    .am-raw { padding: 12px; font-size: 12px; font-family: monospace; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: #374151; margin: 0; }
    .am-resp-header-row { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    .am-resp-hkey { color: #64748b; font-weight: 600; }
    .am-resp-hval { color: #0f172a; font-family: monospace; word-break: break-all; }

    /* Modal */
    .am-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 16px; backdrop-filter: blur(4px); }
    .am-modal { background: white; border-radius: 16px; width: 100%; max-width: 700px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 24px 48px rgba(0,0,0,.2); animation: amSlide .2s ease; overflow: hidden; }
    @keyframes amSlide { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: none; } }
    .am-modal__header { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #e5e7eb;
      h3 { font-size: 15px; font-weight: 600; color: #0f172a; margin: 0; }
      button { width: 28px; height: 28px; border: none; background: #f1f5f9; border-radius: 50%; cursor: pointer; font-size: 13px; color: #64748b; &:hover { background: #fef2f2; color: #ef4444; } } }
    .am-modal__body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; gap: 16px; }
    .am-modal__footer { display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px; border-top: 1px solid #e5e7eb; }
    .am-env-list { width: 180px; border-right: 1px solid #e5e7eb; padding-right: 16px; display: flex; flex-direction: column; gap: 4px; }
    .am-env-item { padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; justify-content: space-between; align-items: center;
      &:hover { background: #f8fafc; }
      &.active { background: #eff6ff; color: #1d4ed8; font-weight: 500; }
      button { width: 22px; height: 22px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #94a3b8; border-radius: 4px; &.danger:hover { color: #dc2626; } } }
    .am-env-editor { flex: 1; display: flex; flex-direction: column; gap: 10px; }
    .am-env-name-row { display: flex; flex-direction: column; gap: 4px;
      label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; }
      input { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: inherit; outline: none; &:focus { border-color: #2563eb; } } }
    .am-env-vars-header { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; }

    /* Buttons */
    .am-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; transition: .15s; }
    .am-btn--primary { background: #2563eb; color: white; &:hover { background: #1d4ed8; } }
    .am-btn--outline { background: transparent; border: 1px solid #e5e7eb; color: #374151; &:hover { background: #f8fafc; } }
    .am-btn--sm { padding: 5px 12px; font-size: 12px; }

    /* Toast */
    .am-toast { position: fixed; bottom: 24px; right: 24px; background: #0f172a; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; opacity: 0; transform: translateY(8px); transition: .25s; pointer-events: none; z-index: 9999;
      &.show { opacity: 1; transform: none; } }
  `]
})
export class ApiManagerComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private api = environment.apiBase;
  private storageKey = 'api_manager_state';

  // Collections / Requests
  collections: ApiCollection[] = [];
  folders: ApiFolder[] = [];
  requests: ApiRequest[] = [];

  // Active state
  activeRequest?: ApiRequest;
  reqTab: 'params' | 'headers' | 'auth' | 'body' = 'params';
  respTab: 'body' | 'headers' | 'raw' = 'body';

  // Environments
  environments: ApiEnvironment[] = [];
  activeEnvId = 0;
  showEnvModal = false;
  editingEnvIdx = -1;

  get activeEnv(): ApiEnvironment | undefined {
    return this.environments.find(e => e.id === this.activeEnvId);
  }

  // Response
  response?: ApiResponse;
  responseError?: string;
  sending = false;

  // UI state
  editingNodeId: string | null = null;
  toastVisible = false;
  toastMsg = '';
  private nextId = 1;

  get enabledParams(): number { return this.activeRequest?.params.filter(p => p.enabled && p.key).length ?? 0; }
  get enabledHeaders(): number { return this.activeRequest?.headers.filter(h => h.enabled && h.key).length ?? 0; }
  urlPlaceholder = 'https://api.example.com/endpoint or {{baseUrl}}/endpoint';
  bodyPlaceholder = '{ "key": "value" }';
  formBodyPlaceholder = 'key=value&key2=value2';

  addParam() { this.activeRequest?.params.push({ key: '', value: '', enabled: true }); }
  addHeader() { this.activeRequest?.headers.push({ key: '', value: '', enabled: true }); }

  onBodyTypeChange() {
    if (!this.activeRequest) return;
    const ct = this.activeRequest.bodyType === 'form'
      ? 'application/x-www-form-urlencoded'
      : 'application/json';
    const existing = this.activeRequest.headers.find(
      h => h.key.toLowerCase() === 'content-type'
    );
    if (existing) {
      existing.value = ct;
    } else {
      this.activeRequest.headers.unshift({ key: 'Content-Type', value: ct, enabled: true });
    }
  }

  addEnvVariable() {
    if (this.editingEnvIdx >= 0 && this.environments[this.editingEnvIdx]) {
      this.environments[this.editingEnvIdx].variables.push({ key: '', value: '' });
    }
  }

  ngOnInit() {
    this.loadState();
    if (this.collections.length === 0) {
      this.collections.push({ id: this.genId(), name: 'My Collection', expanded: true, sortOrder: 0 });
      this.saveState();
    }
  }

  // ---- Collections ----
  addCollection() {
    const col: ApiCollection = {
      id: this.genId(), name: 'New Collection', expanded: true, sortOrder: this.collections.length
    };
    this.collections.push(col);
    this.editingNodeId = 'col-' + col.id;
    this.saveState();
  }

  deleteCollection(col: ApiCollection) {
    if (!confirm(`Delete collection "${col.name}" and all its requests?`)) return;
    this.requests = this.requests.filter(r => r.collectionId !== col.id);
    this.folders = this.folders.filter(f => f.collectionId !== col.id);
    this.collections = this.collections.filter(c => c.id !== col.id);
    if (this.activeRequest && !this.requests.find(r => r.id === this.activeRequest!.id)) {
      this.activeRequest = undefined;
    }
    this.saveState();
  }

  // ---- Folders ----
  addFolder(col: ApiCollection) {
    const folder: ApiFolder = {
      id: this.genId(), collectionId: col.id, name: 'New Folder', expanded: true,
      sortOrder: this.folders.filter(f => f.collectionId === col.id).length
    };
    this.folders.push(folder);
    this.editingNodeId = 'fol-' + folder.id;
    col.expanded = true;
    this.saveState();
  }

  deleteFolder(folder: ApiFolder) {
    if (!confirm(`Delete folder "${folder.name}" and all its requests?`)) return;
    this.requests = this.requests.filter(r => r.folderId !== folder.id);
    this.folders = this.folders.filter(f => f.id !== folder.id);
    if (this.activeRequest && !this.requests.find(r => r.id === this.activeRequest!.id)) {
      this.activeRequest = undefined;
    }
    this.saveState();
  }

  getFolders(collectionId: number): ApiFolder[] {
    return this.folders.filter(f => f.collectionId === collectionId).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ---- Requests ----
  addRequest(collectionId: number, folderId?: number) {
    const req: ApiRequest = {
      id: this.genId(), collectionId, folderId,
      name: 'New Request', method: 'GET', url: '',
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      params: [], authType: 'none', body: '',
      bodyType: 'json',
      sortOrder: this.requests.filter(r => r.collectionId === collectionId).length
    };
    this.requests.push(req);
    this.selectRequest(req);
    this.saveState();
  }

  getRequests(collectionId: number, folderId: number | undefined): ApiRequest[] {
    return this.requests
      .filter(r => r.collectionId === collectionId && r.folderId === folderId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  selectRequest(req: ApiRequest) {
    this.activeRequest = req;
    this.response = undefined;
    this.responseError = undefined;
    this.reqTab = 'params';
    this.respTab = 'body';
  }

  duplicateRequest(req: ApiRequest) {
    const clone: ApiRequest = {
      ...JSON.parse(JSON.stringify(req)),
      id: this.genId(),
      name: req.name + ' (Copy)'
    };
    this.requests.push(clone);
    this.selectRequest(clone);
    this.saveState();
  }

  deleteRequest(req: ApiRequest) {
    this.requests = this.requests.filter(r => r.id !== req.id);
    if (this.activeRequest?.id === req.id) this.activeRequest = undefined;
    this.saveState();
  }

  // ---- Send Request ----
  sendRequest() {
    if (!this.activeRequest) return;
    const req = this.activeRequest;
    const url = this.resolveVariables(req.url);

    // Build query params as string
    const enabledParams = req.params.filter(p => p.enabled && p.key);
    let queryParams: string | undefined;
    if (enabledParams.length > 0) {
      queryParams = enabledParams.map(p =>
        `${encodeURIComponent(this.resolveVariables(p.key))}=${encodeURIComponent(this.resolveVariables(p.value))}`
      ).join('&');
    }

    // Build headers as [{key, value, enabled}] array (backend expects List<KeyValueEnabled>)
    const headersList = req.headers
      .filter(h => h.key)
      .map(h => ({
        key: this.resolveVariables(h.key),
        value: this.resolveVariables(h.value),
        enabled: h.enabled
      }));

    // Ensure Content-Type matches bodyType for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body?.trim()) {
      const expectedCt = req.bodyType === 'form'
        ? 'application/x-www-form-urlencoded'
        : 'application/json';
      const ctIdx = headersList.findIndex(h => h.key.toLowerCase() === 'content-type');
      if (ctIdx >= 0) {
        headersList[ctIdx].value = expectedCt;
        headersList[ctIdx].enabled = true;
      } else {
        headersList.push({ key: 'Content-Type', value: expectedCt, enabled: true });
      }
    }

    // Build auth config
    let authConfig: string | undefined;
    if (req.authType === 'bearer' && req.authToken) {
      authConfig = JSON.stringify({ token: this.resolveVariables(req.authToken) });
    } else if (req.authType === 'apikey' && req.authApiKey) {
      authConfig = JSON.stringify({
        headerName: req.authApiKeyHeader || 'X-API-Key',
        apiKey: this.resolveVariables(req.authApiKey)
      });
    } else if (req.authType === 'basic' && req.authUsername) {
      authConfig = JSON.stringify({
        username: req.authUsername,
        password: req.authPassword || ''
      });
    }

    // Build body
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body?.trim()) {
      body = req.body;
    }

    this.sending = true;
    this.response = undefined;
    this.responseError = undefined;

    const payload = {
      method: req.method,
      url,
      headers: headersList.length > 0 ? JSON.stringify(headersList) : null,
      queryParams: queryParams || null,
      authType: req.authType !== 'none' ? req.authType : null,
      authConfig: authConfig || null,
      body: body || null,
      bodyType: body ? req.bodyType : null,
      environmentId: null,
      requestId: null
    };

    this.http.post<any>(`${this.api}/api/api-manager/send`, payload).subscribe({
      next: res => {
        const data = res.data || res;
        const respBody = data.responseBody || '';
        let isJson = false;
        let formatted = respBody;
        try {
          const parsed = JSON.parse(respBody);
          formatted = JSON.stringify(parsed, null, 2);
          isJson = true;
        } catch {}

        // Parse response headers
        const respHeaders: { key: string; value: string }[] = [];
        if (data.responseHeaders) {
          try {
            const hdr = JSON.parse(data.responseHeaders);
            Object.keys(hdr).forEach(k => {
              const val = Array.isArray(hdr[k]) ? hdr[k].join(', ') : String(hdr[k]);
              respHeaders.push({ key: k, value: val });
            });
          } catch {}
        }

        this.response = {
          status: data.statusCode,
          statusText: data.statusText || '',
          time: data.durationMs || 0,
          size: this.formatSize(data.responseSizeBytes || respBody.length),
          headers: respHeaders,
          body: formatted,
          isJson
        };
        this.sending = false;
        this.saveState();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        const errMsg = err.error?.message || err.message || 'Request failed';
        this.responseError = errMsg;
        this.sending = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ---- Environment ----
  onEnvChange() { this.saveState(); }

  addEnvironment() {
    const env: ApiEnvironment = {
      id: this.genId(), name: 'New Environment',
      variables: [{ key: 'baseUrl', value: 'https://api.example.com' }],
      isActive: false
    };
    this.environments.push(env);
    this.editingEnvIdx = this.environments.length - 1;
  }

  deleteEnvironment(idx: number) {
    const env = this.environments[idx];
    if (this.activeEnvId === env.id) this.activeEnvId = 0;
    this.environments.splice(idx, 1);
    if (this.editingEnvIdx >= this.environments.length) this.editingEnvIdx = this.environments.length - 1;
  }

  saveEnvironments() {
    this.showEnvModal = false;
    this.saveState();
    this.toast('Environments saved');
  }

  private resolveVariables(text: string): string {
    if (!text) return text;
    return text.replace(/{{([^}]+)}}/g, (_, key) => {
      const varName = key.trim();
      const value = this.activeEnv?.variables.find(v => v.key === varName)?.value;
      return value !== undefined ? value : `{{${key}}}`;
    });
  }

  private genId(): number {
    return this.nextId++;
  }

  private saveState() {
    const state = {
      collections: this.collections,
      folders: this.folders,
      requests: this.requests,
      environments: this.environments,
      activeEnvId: this.activeEnvId
    };
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  private loadState() {
    const json = localStorage.getItem(this.storageKey);
    if (!json) return;
    const state = JSON.parse(json);
    this.collections = state.collections || [];
    this.folders = state.folders || [];
    this.requests = state.requests || [];
    this.environments = state.environments || [];
    this.activeEnvId = state.activeEnvId || 0;
    this.nextId = Math.max(1, ...this.requests.map(r => r.id), ...this.collections.map(c => c.id), ...this.folders.map(f => f.id));
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  }

  copyResponse() {
    if (this.response?.body) {
      navigator.clipboard.writeText(this.response.body).then(() => this.toast('Response copied'));
    }
  }

  onOverlay(e: Event) {
    if ((e.target as HTMLElement).classList.contains('am-overlay')) {
      this.showEnvModal = false;
    }
  }

  formatBody() {
    if (!this.activeRequest?.body) return;
    try {
      const parsed = JSON.parse(this.activeRequest.body);
      this.activeRequest.body = JSON.stringify(parsed, null, 2);
    } catch {
      this.toast('Invalid JSON');
    }
  }

  getStatusClass(status: number): string {
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 300 && status < 400) return 'status-3xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    return 'status-5xx';
  }

  private toast(msg: string) {
    this.toastMsg = msg;
    this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 3000);
  }
}
