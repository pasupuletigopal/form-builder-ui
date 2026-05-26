# CLAUDE.md — form-builder-ui

> **Purpose:** This file is automatically read by Claude Code on every session start.
> It gives Claude full project context so you can jump straight into features or fixes
> without re-explaining the architecture each time.

---

## 🚀 HOW TO USE CLAUDE CODE IN VS CODE

### Step 1 — Install the Extension (one-time)

1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac) to open Extensions
3. Search **"Claude Code"** → install the official **Anthropic** extension
4. After install, a **Spark icon ⚡** appears in the sidebar
5. Click it, sign in with your Anthropic account, and you're live

> The extension bundles the CLI — no separate npm install required for VS Code usage.
> If the Spark icon doesn't appear, run **"Developer: Reload Window"** from the Command Palette (`Ctrl+Shift+P`).

### Step 2 — Open This Project

```
File → Open Folder → select the form-builder-ui root
```

Claude Code auto-detects this `CLAUDE.md` and loads project context immediately.

### Step 3 — Start a Session

- Click the **Spark ⚡** icon in the sidebar → opens the Claude Code chat panel
- Or press `Ctrl+N` (Windows) / `Cmd+N` (Mac) inside the panel for a new conversation
- Or open the **integrated terminal** (`Ctrl+\``) and type `claude`

### Key Shortcuts

| Action | Windows/Linux | Mac |
|---|---|---|
| Open Extensions | `Ctrl+Shift+X` | `Cmd+Shift+X` |
| Open Claude panel | Click ⚡ in sidebar | Click ⚡ in sidebar |
| New conversation | `Ctrl+N` | `Cmd+N` |
| Open terminal | `Ctrl+\`` | `Ctrl+\`` |
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| @-mention a file | `Alt+K` | `Option+K` |

---

## 📁 PROJECT OVERVIEW

**App:** `form-builder-ui`
**Purpose:** Drag-and-drop Angular form designer connected to a .NET REST API backend.
**Backend API base:** `http://localhost:8080` (dev) — configured in `environments/environment.ts`

All API responses follow this envelope shape:
```ts
{ success: boolean; message: string; data: T; statusCode: number }
```
Paginated lists return:
```ts
PagedResult<T> = { items, totalCount, page, pageSize }
```

---

## 🛠️ TECH STACK

| Layer | Technology |
|---|---|
| Framework | Angular 18 (Standalone Components) |
| Language | TypeScript 5.4 |
| HTTP | `HttpClient` + RxJS 7.8 |
| Forms | `FormsModule` — template-driven, `[(ngModel)]` |
| Styling | Inline component `styles` + global `styles.css` — **no UI library** |
| Build | Angular CLI 18 (`ng serve`, `ng build --configuration production`) |
| State | Component-local only — **no NgRx / signals store** |
| DI | `inject()` function — **never constructor injection** |

---

## 📂 FILE & FOLDER STRUCTURE

```
src/
  app/
    models/
      form-builder.models.ts       ← ALL shared interfaces & constants
    services/
      api.service.ts               ← ALL HTTP calls centralised here
    components/
      app.component.ts / .html     ← Root shell + view router
      control-preview.component.ts
      data-source-editor.component.ts
      form-renderer.component.ts
      connector-settings.component.ts
      connection-manager.component.ts
      analytics-dashboard.component.ts
      report-builder.component.ts
      sp-report.component.ts
      api-manager.component.ts
  environments/
    environment.ts                 ← dev  (apiBase = localhost:8080)
    environment.prod.ts            ← prod
```

---

## 🧩 CORE MODELS (always import from `form-builder.models.ts`)

| Model | Purpose |
|---|---|
| `FormDefinition` | Full form with `controls: FormControl[]` |
| `FormSummary` | Lightweight list item (no controls) |
| `FormControl` | Single field — layout, style, validation, data-source |
| `ControlType` | Master list of control types |
| `DataSource` | Static / API / Database source |
| `DataSourceItem` | `{ id, value, label, sortOrder, isDefault, isActive }` |
| `ValidationRule` | Regex / built-in rules |
| `ApiResponse<T>` | HTTP envelope |
| `PagedResult<T>` | Paginated response |

**Constants (never hardcode these):**
```ts
FONT_FAMILIES      // allowed fonts
FONT_WEIGHTS       // weight values
COL_SPAN_OPTIONS   // [1..12]
CONTROL_CATEGORIES // ['Input','Display','Action','Layout']
```

---

## ⚙️ CODING RULES CLAUDE MUST FOLLOW

### TypeScript
- Use `inject()` — never constructor injection
- Injected services: `private readonly api = inject(ApiService)`
- Explicit return types on public methods
- `interface` over `type` for object shapes
- UI-state fields prefixed with `_` (e.g. `_isSelected`)
- Never use `any` without a `// TODO: type` comment

### HTTP / RxJS
- All HTTP calls via `ApiService` only — no direct `HttpClient` in components
- Unwrap envelope in service: `.pipe(map(r => r.data))`
- Subscribe with `{ next, error }` object form — never `.subscribe(fn, fn)`
- Always have an `error` branch calling `showToast('...', 'error')`

```ts
// ✅ Correct
this.api.getForms().subscribe({
  next: r  => { this.forms = r.items; this.loading = false; },
  error: () => { this.loading = false; this.showToast('Failed', 'error'); }
});

// ❌ Wrong
this.api.getForms().subscribe(r => this.forms = r.items);
```

### Templates
- Use `*ngIf` / `*ngFor` — NOT `@if` / `@for` (Angular 18 classic syntax)
- Two-way binding: `[(ngModel)]`
- No complex logic in templates — move to component methods
- Conditional classes: `[class.foo]="expr"` — avoid `[ngClass]` for simple cases

### Styling
- CSS lives in the component `styles` array — no separate `.scss` files
- Use CSS custom properties (`--primary`, `--bg`, etc.) from `styles.css`
- Prefix all component classes with a 2–3 letter abbreviation:
  - `cm-` = connection-manager, `ds-` = data-source-editor, etc.
- `ViewEncapsulation.None` — AppComponent only

---

## 🔑 KEY PATTERNS

### Toast Notifications (never use `alert()`)
```ts
this.showToast('Success message');
this.showToast('Error message', 'error');
```

### Dirty Tracking
```ts
this.markDirty(); // call after any mutation of currentForm or its controls
```

### Saving a Form (two-step)
```ts
// 1. PUT /api/forms/{id}/controls
// 2. PUT /api/forms/{id}
// Merge: currentForm = { ...updated, controls: form.controls }
```

### ApiService Pattern
```ts
getSomething(id: number): Observable<Thing> {
  return this.http.get<ApiResponse<Thing>>(`${this.base}/things/${id}`)
    .pipe(map(r => r.data));
}
```

### View Navigation
```ts
type AppView = 'forms' | 'datasources' | 'controltypes' | 'connections'
             | 'analytics' | 'reports' | 'sp-reports' | 'api-manager';
// Use setView(view) — no RouterModule
```

---

## 🚫 DO NOT

- ❌ Add `NgModule` — everything is standalone
- ❌ Install new npm packages without confirming necessity
- ❌ Use constructor injection — use `inject()`
- ❌ Duplicate interfaces — all types in `form-builder.models.ts`
- ❌ Call `HttpClient` directly from components
- ❌ Use `alert()` / `prompt()` — use `showToast()` and modal patterns
- ❌ Add router config — navigation via `activeView` in `AppComponent`
- ❌ Add state management library — component state is sufficient
- ❌ Hardcode colours, fonts, or spacing

---

## ✅ PRE-WORK CHECKLIST (every feature/fix)

- [ ] Does the feature need a new model, or can it extend an existing one?
- [ ] Does it call a new endpoint? Add the method to `ApiService` first.
- [ ] Is this self-contained in an existing component, or does it need a new one?
- [ ] Every `subscribe` block has an `error` branch with `showToast`.
- [ ] Any mutation of `currentForm` calls `markDirty()`.
- [ ] New CSS classes use the component's 2–3 letter prefix.
- [ ] No breaking changes to existing `@Input()` / `@Output()` contracts.

---

## 🏃 RUNNING THE PROJECT

```bash
npm install          # install dependencies
ng serve             # dev server → http://localhost:4200
ng build --configuration production   # production build
```

Backend must be running at `http://localhost:8080`.

---

## 💡 RECOMMENDED VS CODE SETTINGS

Add these to `.vscode/settings.json` in the project root for the best Claude Code experience:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "angular.enable-strict-mode-prompt": false,
  "files.associations": {
    "CLAUDE.md": "markdown",
    "CLAUDE.local.md": "markdown"
  },
  "files.exclude": {
    "node_modules": true,
    "dist": true,
    "**/.claude": true
  },
  "search.exclude": {
    "node_modules": true,
    "dist": true,
    "**/.claude": true
  },
  "terminal.integrated.inheritEnv": true
}
```

---

*Place this file at the project root. Claude Code reads it automatically on every session.*
