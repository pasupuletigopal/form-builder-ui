# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm start                    # dev server → http://localhost:4200
npm run build:prod           # production build
ng serve                     # equivalent to npm start
ng build --configuration production
```

There is **no test runner** configured in this project. TypeScript strict mode is on (`strict: true`, `strictTemplates: true`).

Backend must be running at `http://localhost:8080` (configured in `src/environments/environment.ts`).

---

## Architecture

**Angular 18 standalone components** — no NgModule anywhere. All components declared with `standalone: true`.

`AppComponent` is the root shell and acts as the view router. Navigation is done via `activeView: AppView` state — no Angular Router. `setView(view)` switches views.

```ts
type AppView = 'forms' | 'datasources' | 'controltypes' | 'connections'
             | 'analytics' | 'reports' | 'sp-reports' | 'api-manager';
```

### Component template styles

- `AppComponent` uses a separate `.html` + `.scss` with `ViewEncapsulation.None`
- All other feature components (`analytics-dashboard`, `report-builder`, `sp-report`, `api-manager`, etc.) use **inline `template` and `styles`** inside the `.ts` file — there are no separate HTML/SCSS files for them

### HTTP layer

All HTTP calls go through `ApiService` (`src/app/services/api.service.ts`). Components never import `HttpClient` directly — only `ApiService`. Exception: the large inline-template components (`analytics-dashboard`, `report-builder`, `sp-report`, `api-manager`) inject `HttpClient` directly because they manage their own API calls outside the shared service.

Every response follows this envelope:
```ts
{ success: boolean; message: string; data: T; statusCode: number }
```
Paginated responses:
```ts
PagedResult<T> = { items, totalCount, page, pageSize }
```
Unwrap in the service with `.pipe(map(r => r.data))`.

### Models

All shared interfaces live in `src/app/models/form-builder.models.ts`. Never define interfaces in components or services. Key types: `FormDefinition`, `FormSummary`, `FormControl`, `ControlType`, `DataSource`, `DataSourceItem`, `ValidationRule`, `ApiResponse<T>`, `PagedResult<T>`.

Constants (`FONT_FAMILIES`, `COL_SPAN_OPTIONS`, etc.) also live there — never hardcode these values.

### Charts

Chart.js is **not in package.json** — it is loaded at runtime by injecting a `<script>` tag pointing to the CDN when the first chart widget renders. The `chartLib` field on `AnalyticsDashboardComponent` caches the loaded `Chart` constructor.

---

## Coding rules

### TypeScript
- Use `inject()` — never constructor injection
- `private readonly api = inject(ApiService)` pattern
- `interface` over `type` for object shapes
- No `any` without a `// TODO: type` comment
- UI-state fields prefixed with `_`

### HTTP / RxJS
- Always subscribe with `{ next, error }` object form
- Always include an `error` branch that calls `showToast('...', 'error')`
- When sending a plain string as a JSON body to a .NET `[FromBody] string` endpoint, use `JSON.stringify(value)` with `{ headers: { 'Content-Type': 'application/json' } }` — Angular will otherwise send it as `text/plain` causing a 415

### Templates
- Use `*ngIf` / `*ngFor` — **not** `@if` / `@for`
- Two-way binding: `[(ngModel)]`
- Conditional classes: `[class.foo]="expr"` — avoid `[ngClass]` for simple cases
- No complex logic in templates — move to component methods

### Styling
- CSS lives in the component `styles` array (or `app.component.scss` for the root)
- Use CSS custom properties from `styles.css`
- Prefix component classes with 2–3 letter abbreviation (e.g. `cm-`, `ds-`, `ad-`)

---

## Key patterns

### Toast (never use `alert()` or `prompt()`)
```ts
this.showToast('Success message');
this.showToast('Error message', 'error');
```
Modals replace `prompt()` — use a boolean flag + overlay div pattern (see `cloneFormModal` in `AppComponent` for the canonical example).

### Dirty tracking
```ts
this.markDirty(); // call after any mutation of currentForm or its controls
```

### Saving a form (two-step)
```ts
// 1. PUT /api/forms/{id}/controls
// 2. PUT /api/forms/{id}
// Merge: currentForm = { ...updated, controls: form.controls }
```

### Analytics modal placement
Dashboard-level modals in `AnalyticsDashboardComponent` must live **outside** `<div *ngIf="activeDashboard">` — otherwise they are not rendered when the user is on the dashboard list view.

---

## DO NOT

- Add `NgModule` — everything is standalone
- Install new npm packages without confirming necessity
- Use constructor injection — use `inject()`
- Duplicate interfaces — all types in `form-builder.models.ts`
- Call `HttpClient` directly from components (except the large self-contained components that already do)
- Use `alert()` / `prompt()` — use `showToast()` and modal patterns
- Add router config — navigation via `activeView` in `AppComponent`
- Add state management library — component state is sufficient
