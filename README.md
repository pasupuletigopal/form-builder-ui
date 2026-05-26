# Form Builder UI

Angular 18 standalone application for building dynamic forms.

## Prerequisites
- Node.js v18+ 
- npm v9+

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run the development server
```bash
npm start
```
Open http://localhost:4200 in your browser.

### 3. Build for production
```bash
npm run build:prod
```

## Project Structure
```
src/
├── app/
│   ├── components/          # Standalone feature components
│   │   ├── analytics-dashboard.component.ts
│   │   ├── api-manager.component.ts
│   │   ├── connection-manager.component.ts
│   │   ├── connector-settings.component.ts
│   │   ├── control-preview.component.ts
│   │   ├── data-source-editor.component.ts
│   │   ├── form-renderer.component.ts
│   │   ├── report-builder.component.ts
│   │   └── sp-report.component.ts
│   ├── models/
│   │   └── form-builder.models.ts   # Shared interfaces & types
│   ├── services/
│   │   └── api.service.ts           # HTTP API service
│   ├── app.component.ts             # Root component
│   ├── app.component.html           # Root template
│   ├── app.component.scss           # Root styles
│   └── app.config.ts                # Application config (providers)
├── environments/
│   ├── environment.ts               # Development environment
│   └── environment.prod.ts          # Production environment
├── main.ts                          # Bootstrap entry point
├── index.html                       # HTML shell
└── styles.scss                      # Global styles
```

## VS Code

Recommended extensions are listed in `.vscode/extensions.json`.
Install them via: **Extensions panel → "Show Recommended Extensions"**.
