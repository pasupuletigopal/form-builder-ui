// src/app/app.component.ts
import { Component, OnInit, ViewEncapsulation, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { ApiService } from './services/api.service';
import {
  ControlType, DataSource, DataType, ValidationRule,
  FormDefinition, FormSummary, FormControl,
  FONT_FAMILIES, COL_SPAN_OPTIONS,
  AiFormDraft, AiControlDraft, AiLayoutSuggestion, AiAssistantAction
} from './models/form-builder.models';
import { ControlPreviewComponent }    from './components/control-preview.component';
import { DataSourceEditorComponent }  from './components/data-source-editor.component';
import { FormRendererComponent }      from './components/form-renderer.component';
import { ConnectorSettingsComponent } from './components/connector-settings.component';
import { ConnectionManagerComponent } from './components/connection-manager.component';
import { AnalyticsDashboardComponent } from './components/analytics-dashboard.component';
import { ReportBuilderComponent } from './components/report-builder.component';
import { SpReportComponent } from './components/sp-report.component';
import { ApiManagerComponent } from './components/api-manager.component';
import { AiFormGeneratorComponent } from './components/ai-form-generator.component';
import { AiLayoutSuggestionsComponent } from './components/ai-layout-suggestions.component';
import { AiValidationSuggestionsComponent, ApplyValidationEvent } from './components/ai-validation-suggestions.component';
import { AiAssistantPanelComponent } from './components/ai-assistant-panel.component';
import { forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';

type AppView = 'forms' | 'datasources' | 'controltypes' | 'connections' | 'analytics' | 'reports' | 'sp-reports' | 'api-manager';
type DesignerTab = 'design' | 'settings' | 'preview' | 'json' | 'records' | 'connector';
type PropsTab = 'general' | 'style' | 'validate' | 'layout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
      CommonModule, FormsModule, HttpClientModule, DatePipe, ConnectionManagerComponent,
      ControlPreviewComponent, DataSourceEditorComponent, ReportBuilderComponent, FormRendererComponent, ConnectorSettingsComponent, AnalyticsDashboardComponent, SpReportComponent, ApiManagerComponent,
      AiFormGeneratorComponent, AiLayoutSuggestionsComponent, AiValidationSuggestionsComponent, AiAssistantPanelComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  // App State
  activeView: AppView = 'forms';
  isDark = false;
  loading = false;

  // Forms list
  forms: FormSummary[] = [];
  searchTerm = '';

  // Designer state
  designerOpen = false;
  currentForm!: FormDefinition;
  designerTab: DesignerTab = 'design';
  propsTab: PropsTab = 'general';
  previewDevice: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  isDirty = false;

  // Palette
  controlTypes: ControlType[] = [];
  paletteSearch = '';
  controlCategories: string[] = [];
  canvasDragOver = false;
  private draggingPaletteType?: ControlType;

  // Selected control
  selectedControlId?: number;
  get selectedControl(): FormControl | undefined {
    return this.currentForm?.controls.find(c => c.id === this.selectedControlId);
  }

  // Master data
  dataTypes: DataType[] = [];
  dataSources: DataSource[] = [];
  validationRules: ValidationRule[] = [];

  // Data Source Editor
  showDataSourceEditor = false;
  editingDataSource?: DataSource;

  // Modals
  createFormModal = false;
  newFormData: Partial<FormDefinition> = {};
  cloneFormModal = false;
  cloneFormName = '';
  private cloningForm?: FormSummary;

  // Toast
  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  // AI features
  showAiGenerator = false;
  showLayoutSuggestions = false;
  showValidationSuggestions = false;

  // Constants
  fontFamilies = FONT_FAMILIES;
  colSpanOptions = COL_SPAN_OPTIONS;

  private iconMap: Record<string, string> = {
    TextBox: '⬜', MultiTextBox: '⊟', NumberBox: '123', EmailBox: '@',
    PasswordBox: '🔒', DatePicker: '📅', DateTimePicker: '⏰', TimePicker: '🕐',
    DropdownList: '▾', MultiSelect: '☑', RadioButton: '⊙', Checkbox: '☑',
    CheckboxGroup: '⊞', ToggleSwitch: '⊡', Slider: '⟷', FileUpload: '📎',
    ImageUpload: '🖼', RichTextEditor: 'A', ColorPicker: '🎨', Label: 'T',
    Heading: 'H', Divider: '—', HtmlContent: '</>', Button: '⬡',
    LinkButton: '🔗', IconButton: '⊕', Section: '▤', Grid: '⊞',
    Tabs: '⊟', Spacer: '⬝'
  };

  ngOnInit() {
    this.loadForms();
    this.loadMasterData();
  }

  // ---- Navigation ----
  setView(view: AppView) {
    this.activeView = view;
    this.designerOpen = false;
    if (view === 'datasources') this.loadDataSources();
  }
  toggleDark() { this.isDark = !this.isDark; }

  // ---- Forms ----
  loadForms() {
    this.loading = true;
    this.api.getForms(1, 50, this.searchTerm || undefined).subscribe({
      next: r => { this.forms = r.items; this.loading = false; },
      error: () => { this.loading = false; this.showToast('Failed to load forms', 'error'); }
    });
  }

  onSearch() { this.loadForms(); }

  loadMasterData() {
    this.loadControlTypes();
    this.api.getDataTypes().subscribe(dt => this.dataTypes = dt);
    this.loadDataSources();
    this.api.getValidationRules().subscribe(vr => this.validationRules = vr);
  }

  private loadControlTypes() {
    this.api.getControlTypes().subscribe(ct => {
      this.controlTypes = ct;
      const seen = new Set<string>();
      this.controlCategories = ct
        .map(c => c.category)
        .filter(cat => cat && !seen.has(cat) && seen.add(cat))
        .sort();
    });
  }

  loadDataSources() {
    this.api.getDataSources().subscribe(ds => this.dataSources = ds);
  }

  openCreateForm() {
    this.newFormData = {
      name: '', title: '', description: '',
      backgroundColor: '#FFFFFF', primaryColor: '#1976D2',
      fontFamily: 'Segoe UI', fontSize: 14, borderRadius: 8, padding: 24, maxWidth: 800
    };
    this.createFormModal = true;
  }

  createForm() {
    if (!this.newFormData.name?.trim()) {
      this.showToast('Form name is required', 'error'); return;
    }
    this.api.createForm(this.newFormData).subscribe({
      next: form => {
        this.createFormModal = false;
        this.loadForms();
        this.openDesigner(form.id);
      },
      error: () => this.showToast('Failed to create form', 'error')
    });
  }

  openDesigner(formId: number) {
    this.loadControlTypes();
    this.api.getForm(formId).subscribe({
      next: form => {
        this.currentForm = form;
        this.designerOpen = true;
        this.activeView = 'forms';
        this.selectedControlId = undefined;
        this.designerTab = 'design';
        this.isDirty = false;
      },
      error: () => this.showToast('Failed to load form', 'error')
    });
  }

  closeDesigner() {
    if (this.isDirty && !confirm('You have unsaved changes. Leave anyway?')) return;
    this.designerOpen = false;
    this.isDirty = false;
    this.loadForms();
  }

  saveForm() {
    const controls = this.currentForm.controls.map((c, i) => ({ ...c, sortOrder: i }));
    this.api.updateFormControls(this.currentForm.id, controls).subscribe({
      next: form => {
        this.api.updateForm(this.currentForm.id, this.currentForm as any).subscribe({
          next: updated => {
            this.currentForm = { ...updated, controls: form.controls };
            this.isDirty = false;
            this.showToast('Form saved successfully!');
          }
        });
      },
      error: () => this.showToast('Failed to save', 'error')
    });
  }

  deleteForm(form: FormSummary) {
    if (!confirm(`Delete "${form.name}"?`)) return;
    this.api.deleteForm(form.id).subscribe({
      next: () => { this.loadForms(); this.showToast('Form deleted'); },
      error: () => this.showToast('Failed to delete form', 'error')
    });
  }

  cloneFormDialog(form: FormSummary) {
    this.cloningForm = form;
    this.cloneFormName = `${form.name} (Copy)`;
    this.cloneFormModal = true;
  }

  cloneForm() {
    if (!this.cloneFormName.trim() || !this.cloningForm) return;
    this.api.cloneForm(this.cloningForm.id, this.cloneFormName).subscribe({
      next: newId => {
        this.cloneFormModal = false;
        this.loadForms();
        this.showToast('Form cloned!');
        this.openDesigner(newId);
      },
      error: () => this.showToast('Clone failed', 'error')
    });
  }

  previewForm(formId: number) {
    this.openDesigner(formId);
    setTimeout(() => this.designerTab = 'preview', 300);
  }

  openRecords(formId: number) {
    this.api.getForm(formId).subscribe({
      next: form => {
        this.currentForm = form;
        this.designerOpen = true;
        this.designerTab = 'records';
        this.isDirty = false;
      }
    });
  }

  // ---- Palette ----
  getControlsByCategory(cat: string): ControlType[] {
    return this.controlTypes.filter(ct =>
      ct.category === cat &&
      (!this.paletteSearch || ct.displayName.toLowerCase().includes(this.paletteSearch.toLowerCase()))
    );
  }
  getControlIcon(name: string): string { return this.iconMap[name] || '⬜'; }

  onPaletteDragStart(e: DragEvent, ct: ControlType) {
    this.draggingPaletteType = ct;
    e.dataTransfer?.setData('text/plain', 'palette');
  }
  onControlDragStart(e: DragEvent, control: FormControl) {
    e.dataTransfer?.setData('text/plain', 'canvas');
    e.stopPropagation();
  }
  onCanvasDragOver(e: DragEvent) { e.preventDefault(); }
  onCanvasDrop(e: DragEvent) {
    e.preventDefault();
    this.canvasDragOver = false;
    if (this.draggingPaletteType) {
      this.addControlFromPalette(this.draggingPaletteType);
      this.draggingPaletteType = undefined;
    }
  }

  addControlFromPalette(ct: ControlType) {
    const newControl: FormControl = {
      id: Date.now(),
      formId: this.currentForm.id,
      controlTypeId: ct.id,
      controlTypeName: ct.name,
      controlTypeDisplayName: ct.displayName,
      controlTypeCategory: ct.category,
      fieldName: this.generateFieldName(ct.name),
      label: ct.displayName,
      rowIndex: this.getNextRow(),
      colIndex: 0,
      colSpan: this.getDefaultColSpan(ct.name),
      rowSpan: 1,
      sortOrder: this.currentForm.controls.length,
      isRequired: false, isReadOnly: false, isDisabled: false, isHidden: false,
      validations: [],
      rows: ct.name === 'MultiTextBox' ? 3 : undefined,
      buttonType:    ct.name === 'Button' ? 'button'     : undefined,
      buttonVariant: ct.name === 'Button' ? 'contained'  : undefined,
    };
    this.currentForm.controls.push(newControl);
    this.selectedControlId = newControl.id;
    this.markDirty();
  }

  private generateFieldName(typeName: string): string {
    const base  = typeName.toLowerCase().replace(/[^a-z]/g, '');
    const count = this.currentForm.controls.filter(c => c.controlTypeName === typeName).length;
    return `${base}${count > 0 ? count + 1 : ''}`;
  }
  private getNextRow(): number {
    if (!this.currentForm.controls.length) return 0;
    return Math.max(...this.currentForm.controls.map(c => c.rowIndex)) + 1;
  }
  private getDefaultColSpan(typeName: string): number {
    const wide = ['MultiTextBox','RichTextEditor','HtmlContent','Section','Grid','Tabs','Divider','Heading'];
    const half = ['Button','IconButton','LinkButton','DatePicker','TimePicker','ColorPicker','Checkbox','ToggleSwitch'];
    if (wide.includes(typeName)) return 12;
    if (half.includes(typeName)) return 4;
    return 6;
  }

  // ---- Canvas ----
  getRows(): FormControl[][] {
    if (!this.currentForm?.controls.length) return [];
    const sorted = [...this.currentForm.controls].sort((a, b) => a.sortOrder - b.sortOrder);
    const rows = new Map<number, FormControl[]>();
    sorted.forEach(c => {
      if (!rows.has(c.rowIndex)) rows.set(c.rowIndex, []);
      rows.get(c.rowIndex)!.push(c);
    });
    return Array.from(rows.keys()).sort((a, b) => a - b).map(k => rows.get(k)!);
  }

  selectControl(control: FormControl) {
    this.selectedControlId = control.id;
    this.propsTab = 'general';
  }
  moveControl(control: FormControl, dir: -1 | 1) {
    const idx = this.currentForm.controls.findIndex(c => c.id === control.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this.currentForm.controls.length) return;
    [this.currentForm.controls[idx], this.currentForm.controls[newIdx]] =
      [this.currentForm.controls[newIdx], this.currentForm.controls[idx]];
    this.currentForm.controls.forEach((c, i) => c.sortOrder = i);
    this.markDirty();
  }
  duplicateControl(control: FormControl) {
    const clone: FormControl = {
      ...JSON.parse(JSON.stringify(control)),
      id: Date.now(),
      fieldName: control.fieldName + '_copy',
      sortOrder: this.currentForm.controls.length,
      rowIndex: control.rowIndex + 1
    };
    this.currentForm.controls.push(clone);
    this.selectedControlId = clone.id;
    this.markDirty();
  }
  removeControl(control: FormControl) {
    const idx = this.currentForm.controls.findIndex(c => c.id === control.id);
    this.currentForm.controls.splice(idx, 1);
    if (this.selectedControlId === control.id) this.selectedControlId = undefined;
    this.markDirty();
  }
  hasDataSource(typeName: string): boolean {
    return ['DropdownList','MultiSelect','RadioButton','CheckboxGroup'].includes(typeName);
  }
  onDataSourceChange() {
    const ds = this.dataSources.find(d => d.id === this.selectedControl?.dataSourceId);
    if (this.selectedControl && ds) {
      const ctrl = this.selectedControl;
      ctrl.dataSourceName = ds.name;
      if (ds.sourceType === 'Static') {
        ctrl.dataSourceItems = ds.items;
      } else {
        ctrl.dataSourceItems = [];
        this.api.getDataSourceItems(ds.id).subscribe({
          next: items => {
            ctrl.dataSourceItems = items;
            this.cdr.detectChanges();
          },
          error: () => this.showToast('Failed to load data source items', 'error')
        });
      }
    }
    this.markDirty();
  }
  markDirty() { this.isDirty = true; }

  // ---- JSON / Preview ----
  getFormJson(): string {
    return JSON.stringify({
      id: this.currentForm.id, name: this.currentForm.name,
      title: this.currentForm.title,
      styling: {
        backgroundColor: this.currentForm.backgroundColor,
        primaryColor:    this.currentForm.primaryColor,
        fontFamily:      this.currentForm.fontFamily,
        fontSize:        this.currentForm.fontSize,
        borderRadius:    this.currentForm.borderRadius,
        padding:         this.currentForm.padding,
        maxWidth:        this.currentForm.maxWidth,
      },
      controls: this.currentForm.controls.map(c => ({
        fieldName: c.fieldName, controlType: c.controlTypeName,
        dataType: c.dataTypeName, label: c.label,
        isRequired: c.isRequired, colSpan: c.colSpan, rowIndex: c.rowIndex,
      }))
    }, null, 2);
  }
  copyJson() {
    navigator.clipboard.writeText(this.getFormJson())
      .then(() => this.showToast('JSON copied!'));
  }

  // ---- Data Sources CRUD ----
  openDataSourceDialog(ds?: DataSource) {
    this.editingDataSource = ds;
    this.showDataSourceEditor = true;
  }
  editDataSource(ds: DataSource)   { this.openDataSourceDialog(ds); }
  onDataSourceSaved(ds: DataSource) {
    this.showDataSourceEditor = false;
    this.editingDataSource = undefined;
    this.loadDataSources();
    this.showToast(ds.name + ' saved!');
  }
  onDataSourceEditorClosed() {
    this.showDataSourceEditor = false;
    this.editingDataSource = undefined;
  }
  deleteDataSource(ds: DataSource) {
    if (!confirm(`Delete "${ds.name}"?`)) return;
    this.api.deleteDataSource(ds.id).subscribe({
      next: () => { this.loadDataSources(); this.showToast('Deleted'); },
      error: () => this.showToast('Failed to delete', 'error')
    });
  }

  // ---- Control Types CRUD ----
  openControlTypeDialog() { this.showToast('Add via SQL INSERT into ControlTypes'); }
  editControlType(ct: ControlType) { }
  deleteControlType(ct: ControlType) {
    if (!confirm(`Delete "${ct.displayName}"?`)) return;
    this.api.deleteControlType(ct.id).subscribe({
      next: () => { this.api.getControlTypes().subscribe(c => this.controlTypes = c); this.showToast('Deleted'); },
      error: () => this.showToast('Failed to delete', 'error')
    });
  }

  // ---- Toast ----
  showToast(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType    = type;
    this.toastVisible = true;
    setTimeout(() => this.toastVisible = false, 3000);
  }
    onConnectorSaved() {
        this.showToast('Connector saved! Records tab now uses the external table.');
        this.designerTab = 'connector';
    }

  // ==================== AI: Form Generator (+ DataSource wiring) ====================

  onAiFormGenerated(draft: AiFormDraft): void {
    this.showAiGenerator = false;
    this.loading = true;

    const controlsNeedingDataSource = draft.controls.filter(
      c => c.dataSourceItems && c.dataSourceItems.length > 0
    );

    const dataSourceCreation$ = controlsNeedingDataSource.length
      ? forkJoin(
          controlsNeedingDataSource.map(c =>
            this.api.createDataSource({
              name: `${draft.name} — ${c.label || c.fieldName}`,
              description: `Auto-created by AI form generator for field "${c.fieldName}"`,
              sourceType: 'Static',
              valueField: 'value',
              labelField: 'label',
              isActive: true,
              items: c.dataSourceItems!.map((it, idx) => ({
                value: it.value,
                label: it.label,
                sortOrder: idx,
                isDefault: idx === 0,
                isActive: true
              }))
            } as Partial<DataSource>).pipe(
              map(ds => ({ fieldName: c.fieldName, dataSource: ds }))
            )
          )
        )
      : of([] as { fieldName: string; dataSource: DataSource }[]);

    dataSourceCreation$.subscribe({
      next: (created) => {
        const dsByField = new Map(created.map(x => [x.fieldName, x.dataSource]));

        this.api.createForm({
          name: draft.name,
          title: draft.title,
          description: draft.description,
          submitMethod: 'POST',
          isActive: true
        }).subscribe({
          next: (form) => {
            const controls = draft.controls.map((c, i) =>
              this.mapAiControlToFormControl(c, i, dsByField)
            );
            this.api.updateFormControls(form.id, controls).subscribe({
              next: (withControls) => {
                this.loading = false;
                this.loadForms();
                this.loadDataSources();
                this.currentForm = withControls;
                this.designerOpen = true;
                this.activeView = 'forms';
                this.designerTab = 'design';
                this.selectedControlId = undefined;
                this.isDirty = false;
                this.showToast('AI-generated form created — review and adjust as needed!');
              },
              error: () => {
                this.loading = false;
                this.showToast('Form created, but adding AI fields failed — opening empty form', 'error');
                this.openDesigner(form.id);
              }
            });
          },
          error: () => {
            this.loading = false;
            this.showToast('Failed to create AI-generated form', 'error');
          }
        });
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to create data sources for AI-generated form fields', 'error');
      }
    });
  }

  private mapAiControlToFormControl(
    c: AiControlDraft,
    index: number,
    dsByField: Map<string, DataSource>
  ): Partial<FormControl> {
    const ct = this.controlTypes.find(t => t.name === c.controlTypeName);
    const ds = dsByField.get(c.fieldName);
    return {
      controlTypeId: ct?.id ?? this.controlTypes[0]?.id,
      fieldName: c.fieldName,
      label: c.label,
      placeholder: c.placeholder,
      helperText: c.helperText,
      rowIndex: c.rowIndex,
      colIndex: 0,
      colSpan: c.colSpan,
      rowSpan: 1,
      sortOrder: index,
      isRequired: c.isRequired,
      isReadOnly: false,
      isDisabled: false,
      isHidden: false,
      validations: [],
      dataSourceId: ds?.id
    };
  }

  // ==================== AI: Layout suggestions ====================

  onApplyLayoutSuggestions(suggestions: AiLayoutSuggestion[]): void {
    this.showLayoutSuggestions = false;
    const byField = new Map(suggestions.map(s => [s.fieldName, s]));
    this.currentForm.controls.forEach(c => {
      const s = byField.get(c.fieldName);
      if (s) {
        c.rowIndex = s.rowIndex;
        c.colIndex = s.colIndex;
        c.colSpan = s.colSpan;
        c.sortOrder = s.sortOrder;
      }
    });
    this.markDirty();
    this.showToast('Layout updated — remember to Save');
  }

  // ==================== AI: Validation suggestions ====================

  onApplyValidationSuggestions(result: ApplyValidationEvent): void {
    if (!this.selectedControl) return;
    this.showValidationSuggestions = false;

    this.selectedControl.isRequired = result.isRequired;
    if (result.minLength !== undefined) this.selectedControl.minLength = result.minLength;
    if (result.maxLength !== undefined) this.selectedControl.maxLength = result.maxLength;
    if (result.minValue !== undefined) this.selectedControl.minValue = result.minValue;
    if (result.maxValue !== undefined) this.selectedControl.maxValue = result.maxValue;
    if (result.pattern) this.selectedControl.pattern = result.pattern;

    result.ruleNames.forEach(name => {
      const rule = this.validationRules.find(r => r.name === name);
      if (!rule) return;
      const exists = this.selectedControl!.validations.some(v => v.validationRuleId === rule.id);
      if (!exists) {
        this.selectedControl!.validations.push({
          validationRuleId: rule.id,
          validationRuleName: rule.displayName
        });
      }
    });

    this.markDirty();
    this.showToast('Validation rules applied — remember to Save');
  }

  // ==================== AI: cross-cutting assistant ====================

  onAssistantAction(action: AiAssistantAction): void {
    switch (action.type) {
      case 'navigate_to_view': {
        const view = action.params?.['view'];
        if (view) this.activeView = view;
        break;
      }
      case 'open_form_by_name': {
        const name = String(action.params?.['name'] || '').toLowerCase();
        const match = this.forms.find(f => f.name.toLowerCase().includes(name));
        if (match) this.openDesigner(match.id);
        else this.showToast(`No form found matching "${action.params?.['name']}"`, 'error');
        break;
      }
      case 'open_ai_form_generator': {
        this.activeView = 'forms';
        this.showAiGenerator = true;
        break;
      }
      case 'optimize_current_form_layout': {
        if (this.designerOpen && this.currentForm?.controls?.length) {
          this.showLayoutSuggestions = true;
        } else {
          this.showToast('Open a form in the designer first', 'error');
        }
        break;
      }
      case 'create_form': {
        const name = action.params?.['name'] || 'Untitled Form';
        this.api.createForm({ name, submitMethod: 'POST', isActive: true }).subscribe({
          next: (form) => { this.loadForms(); this.openDesigner(form.id); },
          error: () => this.showToast('Failed to create form', 'error')
        });
        break;
      }
      default:
        break;
    }
  }
}
