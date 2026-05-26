// src/app/models/form-builder.models.ts

export interface ControlType {
  id: number;
  name: string;
  displayName: string;
  icon?: string;
  description?: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

export interface DataType {
  id: number;
  name: string;
  displayName: string;
  dotNetType: string;
  isCollection: boolean;
  isActive: boolean;
}

export interface DataSourceItem {
  id: number;
  value: string;
  label: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface DataSource {
  id: number;
  name: string;
  description?: string;
  sourceType: 'Static' | 'API' | 'Database';
  apiUrl?: string;
  apiMethod?: string;
  apiHeaders?: string;
  valueField: string;
  labelField: string;
  isActive: boolean;
  items: DataSourceItem[];

  // Database source fields
  externalConnectionId?: number;
  databaseName?: string;
  schemaName?: string;
  tableName?: string;
  valueColumn?: string;
  labelColumn?: string;
  filterExpression?: string;
  orderByExpression?: string;
}

export interface ValidationRule {
  id: number;
  name: string;
  displayName: string;
  pattern?: string;
  errorMessage?: string;
  isActive: boolean;
}

export interface FormControlStyle {
  labelColor?: string;
  controlColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
  customCssClass?: string;
  customCss?: string;
}

export interface FormControlLayout {
  rowIndex: number;
  colIndex: number;
  colSpan: number;
  rowSpan: number;
  sortOrder: number;
  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
}

export interface FormControlValidation {
  id?: number;
  validationRuleId: number;
  validationRuleName?: string;
  customMessage?: string;
}

export interface FormControl {
  id: number;
  formId: number;
  controlTypeId: number;
  controlTypeName: string;
  controlTypeDisplayName: string;
  controlTypeCategory: string;
  dataTypeId?: number;
  dataTypeName?: string;
  dataSourceId?: number;
  dataSourceName?: string;

  fieldName: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  defaultValue?: string;
  tooltip?: string;

  // Layout
  rowIndex: number;
  colIndex: number;
  colSpan: number;
  rowSpan: number;
  sortOrder: number;
  width?: string;
  height?: string;

  // Styling
  labelColor?: string;
  controlColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
  customCssClass?: string;
  customCss?: string;

  // Validation
  isRequired: boolean;
  isReadOnly: boolean;
  isDisabled: boolean;
  isHidden: boolean;
  minValue?: string;
  maxValue?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Button
  buttonType?: string;
  buttonVariant?: string;
  clickAction?: string;

  // TextArea
  rows?: number;
  autoResize?: boolean;

  extendedOptions?: string;

  dataSourceItems?: DataSourceItem[];
  validations: FormControlValidation[];

  // UI state (client-only)
  _isSelected?: boolean;
  _isDragging?: boolean;
}

export interface FormDefinition {
  id: number;
  name: string;
  description?: string;
  title?: string;
  submitUrl?: string;
  submitMethod: string;
  isActive: boolean;
  version: number;
  backgroundColor?: string;
  primaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  borderRadius?: number;
  padding?: number;
  maxWidth?: number;
  createdAt: string;
  updatedAt: string;
  controls: FormControl[];
}

export interface FormSummary {
  id: number;
  name: string;
  description?: string;
  title?: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  controlCount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// For form designer drag state
export interface DesignerState {
  selectedControlId?: number;
  isDragging: boolean;
  dragSourceType?: 'palette' | 'canvas';
  dragControlType?: ControlType;
  dragControl?: FormControl;
  zoom: number;
  showGrid: boolean;
}

// Control category groups
export const CONTROL_CATEGORIES = ['Input', 'Display', 'Action', 'Layout'] as const;
export type ControlCategory = typeof CONTROL_CATEGORIES[number];

export const FONT_FAMILIES = [
  'Segoe UI', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS',
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins'
];

export const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900',
  'normal', 'bold', 'lighter', 'bolder'];

export const COL_SPAN_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12];
