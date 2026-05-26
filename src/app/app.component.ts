// src/app/app.component.ts
import { Component, OnInit, ViewEncapsulation, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { ApiService } from './services/api.service';
import {
  ControlType, DataSource, DataType, ValidationRule,
  FormDefinition, FormSummary, FormControl,
  FONT_FAMILIES, COL_SPAN_OPTIONS
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
import { environment } from '../environments/environment';

type AppView = 'forms' | 'datasources' | 'controltypes' | 'connections' | 'analytics' | 'reports' | 'sp-reports' | 'api-manager';
type DesignerTab = 'design' | 'settings' | 'preview' | 'json' | 'records' | 'connector';
type PropsTab = 'general' | 'style' | 'validate' | 'layout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
      CommonModule, FormsModule, HttpClientModule, DatePipe, ConnectionManagerComponent,
      ControlPreviewComponent, DataSourceEditorComponent, ReportBuilderComponent, FormRendererComponent, ConnectorSettingsComponent, AnalyticsDashboardComponent, SpReportComponent, ApiManagerComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);
  private http = inject(HttpClient);
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
  controlCategories = ['Input', 'Display', 'Action', 'Layout'];
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

  // Toast
  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

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
    this.api.getControlTypes().subscribe(ct => this.controlTypes = ct);
    this.api.getDataTypes().subscribe(dt => this.dataTypes = dt);
    this.loadDataSources();
    this.api.getValidationRules().subscribe(vr => this.validationRules = vr);
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
    const name = prompt('New form name:', `${form.name} (Copy)`);
    if (!name) return;
    this.api.cloneForm(form.id, name).subscribe({
      next: newId => { this.loadForms(); this.showToast('Form cloned!'); this.openDesigner(newId); },
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
        this.http.get<any>(`${environment.apiBase}/api/datasources/${ds.id}/items`).subscribe({
          next: res => {
            const rows = res.data || res || [];
            if (Array.isArray(rows)) {
              ctrl.dataSourceItems = rows.map((r: any) => ({
                id: r.id ?? 0,
                value: String(r.value ?? r.Value ?? ''),
                label: String(r.label ?? r.Label ?? r.text ?? r.Text ?? ''),
                sortOrder: r.sortOrder ?? 0,
                isDefault: r.isDefault ?? false,
                isActive: true
              }));
              this.cdr.detectChanges();
            }
          }
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
}
