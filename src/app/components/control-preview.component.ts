// src/app/components/control-preview.component.ts
import { Component, Input, OnChanges, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormControl } from '../models/form-builder.models';


@Component({
  selector: 'app-control-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="ctrl-preview" [class.ctrl-preview--selected]="isSelected" [ngStyle]="wrapperStyle">

      <!-- LABEL -->
      <label class="ctrl-label" *ngIf="showLabel" [ngStyle]="labelStyle">
        {{ control.label || control.fieldName }}
        <span class="required-star" *ngIf="control.isRequired">*</span>
      </label>

      <!-- TEXT BOX -->
      <input *ngIf="is('TextBox') || is('EmailBox') || is('PasswordBox') || is('NumberBox')"
        [type]="getInputType()"
        class="ctrl-input"
        [placeholder]="control.placeholder || ''"
        [disabled]="control.isDisabled || isPreview === false"
        [readonly]="control.isReadOnly"
        [ngStyle]="inputStyle"
        [value]="control.defaultValue || ''" />

      <!-- MULTI TEXTBOX (TextArea) -->
      <textarea *ngIf="is('MultiTextBox')"
        class="ctrl-input ctrl-textarea"
        [placeholder]="control.placeholder || ''"
        [disabled]="control.isDisabled || isPreview === false"
        [readonly]="control.isReadOnly"
        [rows]="control.rows || 3"
        [ngStyle]="inputStyle">{{ control.defaultValue || '' }}</textarea>

      <!-- DROPDOWN -->
      <select *ngIf="is('DropdownList') || is('MultiSelect')"
        class="ctrl-input ctrl-select"
        [disabled]="control.isDisabled || isPreview === false"
        [multiple]="is('MultiSelect')"
        [ngStyle]="inputStyle">
        <option value="">{{ control.placeholder || '-- Select --' }}</option>
        <option *ngFor="let item of getItems()" [value]="item.value" [selected]="item.isDefault">
          {{ item.label }}
        </option>
      </select>

      <!-- RADIO GROUP -->
      <div *ngIf="is('RadioButton')" class="ctrl-radio-group" [ngStyle]="inputStyle">
        <label *ngFor="let item of getItems()" class="ctrl-radio-option">
          <input type="radio" [name]="control.fieldName" [value]="item.value"
            [disabled]="control.isDisabled || isPreview === false" />
          <span>{{ item.label }}</span>
        </label>
        <div class="ctrl-placeholder" *ngIf="!getItems().length">
          <span class="radio-placeholder">⊙ Option 1  ⊙ Option 2  ⊙ Option 3</span>
        </div>
      </div>

      <!-- CHECKBOX -->
      <label *ngIf="is('Checkbox')" class="ctrl-checkbox" [ngStyle]="inputStyle">
        <input type="checkbox" [disabled]="control.isDisabled || isPreview === false" />
        <span>{{ control.label || 'Checkbox' }}</span>
      </label>

      <!-- CHECKBOX GROUP -->
      <div *ngIf="is('CheckboxGroup')" class="ctrl-checkbox-group" [ngStyle]="inputStyle">
        <label *ngFor="let item of getItems()" class="ctrl-checkbox-option">
          <input type="checkbox" [value]="item.value"
            [disabled]="control.isDisabled || isPreview === false" />
          <span>{{ item.label }}</span>
        </label>
        <div class="ctrl-placeholder" *ngIf="!getItems().length">
          <span>☐ Option A  ☐ Option B  ⊕ Option C</span>
        </div>
      </div>

      <!-- TOGGLE SWITCH -->
      <div *ngIf="is('ToggleSwitch')" class="ctrl-toggle-wrap" [ngStyle]="inputStyle">
        <label class="ctrl-toggle-label">
          <div class="ctrl-toggle" [class.disabled]="control.isDisabled">
            <input type="checkbox" [disabled]="control.isDisabled || isPreview === false" />
            <span class="ctrl-toggle-track"></span>
          </div>
          <span>{{ control.placeholder || 'Enable' }}</span>
        </label>
      </div>

      <!-- DATE PICKER -->
      <input *ngIf="is('DatePicker')"
        type="date"
        class="ctrl-input"
        [disabled]="control.isDisabled || isPreview === false"
        [ngStyle]="inputStyle" />

      <!-- DATE TIME PICKER -->
      <input *ngIf="is('DateTimePicker')"
        type="datetime-local"
        class="ctrl-input"
        [disabled]="control.isDisabled || isPreview === false"
        [ngStyle]="inputStyle" />

      <!-- TIME PICKER -->
      <input *ngIf="is('TimePicker')"
        type="time"
        class="ctrl-input"
        [disabled]="control.isDisabled || isPreview === false"
        [ngStyle]="inputStyle" />

      <!-- SLIDER -->
      <div *ngIf="is('Slider')" class="ctrl-slider-wrap" [ngStyle]="inputStyle">
        <input type="range"
          class="ctrl-slider"
          [min]="control.minValue || 0"
          [max]="control.maxValue || 100"
          [disabled]="control.isDisabled || isPreview === false" />
        <div class="ctrl-slider-labels">
          <span>{{ control.minValue || 0 }}</span>
          <span>{{ control.maxValue || 100 }}</span>
        </div>
      </div>

      <!-- FILE UPLOAD -->
      <div *ngIf="is('FileUpload') || is('ImageUpload')" class="ctrl-file-area" [ngStyle]="inputStyle">
        <div class="ctrl-file-inner">
          <span class="ctrl-file-icon">{{ is('ImageUpload') ? '🖼' : '📎' }}</span>
          <span>{{ control.placeholder || (is('ImageUpload') ? 'Click to upload image' : 'Click to upload file') }}</span>
          <span class="ctrl-file-hint">or drag and drop</span>
        </div>
        <input type="file" [disabled]="control.isDisabled || isPreview === false"
          [accept]="is('ImageUpload') ? 'image/*' : '*'" style="display:none" />
      </div>

      <!-- COLOR PICKER -->
      <div *ngIf="is('ColorPicker')" class="ctrl-color-wrap" [ngStyle]="inputStyle">
        <input type="color" class="ctrl-color" [disabled]="control.isDisabled || isPreview === false" />
        <input type="text" class="ctrl-input ctrl-color-text" placeholder="#000000"
          [disabled]="control.isDisabled || isPreview === false" />
      </div>

      <!-- RICH TEXT EDITOR -->
      <div *ngIf="is('RichTextEditor')" class="ctrl-rte" [ngStyle]="inputStyle">
        <div class="ctrl-rte-toolbar">
          <button>B</button><button><i>I</i></button><button><u>U</u></button>
          <button>•</button><button>⊞</button><button>🔗</button>
        </div>
        <div class="ctrl-rte-body" contenteditable="true">
          {{ control.defaultValue || control.placeholder || 'Start typing...' }}
        </div>
      </div>

      <!-- LABEL / STATIC TEXT -->
      <div *ngIf="is('Label')" class="ctrl-static-label" [ngStyle]="inputStyle">
        {{ control.defaultValue || control.label || 'Static Label' }}
      </div>

      <!-- HEADING -->
      <div *ngIf="is('Heading')" class="ctrl-heading" [ngStyle]="inputStyle">
        {{ control.defaultValue || control.label || 'Section Heading' }}
      </div>

      <!-- DIVIDER -->
      <hr *ngIf="is('Divider')" class="ctrl-divider" [ngStyle]="inputStyle" />

      <!-- HTML CONTENT -->
      <div *ngIf="is('HtmlContent')" class="ctrl-html" [ngStyle]="inputStyle">
        <span>{{ '< HTML Content Block >' }}</span>
      </div>

      <!-- BUTTON -->
      <button *ngIf="is('Button')" class="ctrl-button"
        [class]="'ctrl-btn-' + (control.buttonVariant || 'contained')"
        [disabled]="control.isDisabled"
        [ngStyle]="buttonStyle">
        {{ control.label || 'Button' }}
      </button>

      <!-- LINK BUTTON -->
      <a *ngIf="is('LinkButton')" class="ctrl-link-btn" [ngStyle]="inputStyle">
        {{ control.label || 'Click here' }}
      </a>

      <!-- ICON BUTTON -->
      <button *ngIf="is('IconButton')" class="ctrl-icon-btn" [disabled]="control.isDisabled" [ngStyle]="inputStyle">
        ⊕
      </button>

      <!-- SECTION -->
      <div *ngIf="is('Section')" class="ctrl-section" [ngStyle]="inputStyle">
        <div class="ctrl-section-header">
          {{ control.label || 'Section Title' }} <span>▾</span>
        </div>
        <div class="ctrl-section-body">
          <div class="ctrl-section-placeholder">Drop controls inside section</div>
        </div>
      </div>

      <!-- SPACER -->
      <div *ngIf="is('Spacer')" class="ctrl-spacer" [style.height]="control.height || '32px'"></div>

      <!-- DEFAULT FALLBACK for new/unknown types -->
      <div *ngIf="isUnknown()" class="ctrl-unknown">
        <span>{{ control.controlTypeDisplayName || control.controlTypeName }}</span>
        <span class="ctrl-unknown-hint">Control preview not configured</span>
      </div>

      <!-- Helper text -->
      <div class="ctrl-helper" *ngIf="control.helperText && showLabel">
        {{ control.helperText }}
      </div>
    </div>
  `,
  styles: [`
    /* Scope all styles under app-control-preview to avoid global leakage */
    app-control-preview {
      display: block;
    }
    app-control-preview .ctrl-preview {
      padding: 4px 0;
      position: relative;
    }
    app-control-preview .ctrl-preview--selected {
      outline: 2px solid #3b82f6;
      border-radius: 4px;
      padding: 4px;
    }
    app-control-preview .ctrl-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #374151;
    }
    app-control-preview .required-star {
      color: #ef4444;
      margin-left: 2px;
    }
    app-control-preview .ctrl-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      color: #111827;
      background: #fff;
      box-sizing: border-box;
      transition: border 0.2s;
      outline: none;
    }
    app-control-preview .ctrl-input:focus {
      border-color: #3b82f6;
    }
    app-control-preview .ctrl-input:disabled {
      background: #f3f4f6;
      color: #9ca3af;
      cursor: not-allowed;
    }
    app-control-preview .ctrl-textarea {
      resize: vertical;
    }
    app-control-preview .ctrl-select {
      cursor: pointer;
    }
    app-control-preview .ctrl-radio-group,
    app-control-preview .ctrl-checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    app-control-preview .ctrl-radio-option,
    app-control-preview .ctrl-checkbox-option {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    app-control-preview .radio-placeholder {
      color: #9ca3af;
      font-size: 13px;
    }
    app-control-preview .ctrl-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    app-control-preview .ctrl-toggle-wrap {
      display: flex;
      align-items: center;
    }
    app-control-preview .ctrl-toggle-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
    }
    app-control-preview .ctrl-toggle {
      position: relative;
      width: 44px;
      height: 24px;
    }
    app-control-preview .ctrl-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    app-control-preview .ctrl-toggle-track {
      position: absolute;
      inset: 0;
      background: #d1d5db;
      border-radius: 99px;
      transition: 0.2s;
    }
    app-control-preview .ctrl-toggle-track::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: 0.2s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    app-control-preview .ctrl-toggle input:checked + .ctrl-toggle-track {
      background: #3b82f6;
    }
    app-control-preview .ctrl-toggle input:checked + .ctrl-toggle-track::after {
      transform: translateX(20px);
    }
    app-control-preview .ctrl-toggle.disabled .ctrl-toggle-track {
      opacity: 0.5;
    }
    app-control-preview .ctrl-slider-wrap {
      padding: 8px 0;
    }
    app-control-preview .ctrl-slider {
      width: 100%;
      accent-color: #3b82f6;
    }
    app-control-preview .ctrl-slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #6b7280;
    }
    app-control-preview .ctrl-file-area {
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: 0.2s;
    }
    app-control-preview .ctrl-file-area:hover {
      border-color: #3b82f6;
      background: #eff6ff;
    }
    app-control-preview .ctrl-file-inner {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
      color: #6b7280;
    }
    app-control-preview .ctrl-file-icon {
      font-size: 24px;
    }
    app-control-preview .ctrl-file-hint {
      font-size: 12px;
      color: #9ca3af;
    }
    app-control-preview .ctrl-color-wrap {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    app-control-preview .ctrl-color {
      width: 42px;
      height: 36px;
      padding: 2px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      cursor: pointer;
    }
    app-control-preview .ctrl-color-text {
      flex: 1;
    }
    app-control-preview .ctrl-rte {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      overflow: hidden;
    }
    app-control-preview .ctrl-rte-toolbar {
      display: flex;
      gap: 4px;
      padding: 6px 8px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    app-control-preview .ctrl-rte-toolbar button {
      padding: 2px 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 12px;
    }
    app-control-preview .ctrl-rte-body {
      min-height: 80px;
      padding: 8px 12px;
      font-size: 14px;
      color: #374151;
    }
    app-control-preview .ctrl-static-label {
      font-size: 14px;
      color: #374151;
      padding: 4px 0;
    }
    app-control-preview .ctrl-heading {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      padding: 4px 0;
    }
    app-control-preview .ctrl-divider {
      border: none;
      border-top: 2px solid #e5e7eb;
      margin: 8px 0;
    }
    app-control-preview .ctrl-html {
      padding: 8px 12px;
      background: #f9fafb;
      border: 1px dashed #d1d5db;
      border-radius: 4px;
      color: #6b7280;
      font-family: monospace;
      font-size: 13px;
    }
    app-control-preview .ctrl-button {
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: 0.2s;
    }
    app-control-preview .ctrl-btn-contained {
      background: #1976D2;
      color: white;
    }
    app-control-preview .ctrl-btn-contained:hover {
      background: #1565c0;
    }
    app-control-preview .ctrl-btn-outlined {
      background: transparent;
      border: 2px solid #1976D2 !important;
      color: #1976D2;
    }
    app-control-preview .ctrl-btn-text {
      background: transparent;
      color: #1976D2;
    }
    app-control-preview .ctrl-link-btn {
      color: #1976D2;
      text-decoration: underline;
      cursor: pointer;
    }
    app-control-preview .ctrl-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: #f3f4f6;
      cursor: pointer;
      font-size: 18px;
    }
    app-control-preview .ctrl-section {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    app-control-preview .ctrl-section-header {
      display: flex;
      justify-content: space-between;
      padding: 10px 16px;
      background: #f9fafb;
      font-weight: 500;
      border-bottom: 1px solid #e5e7eb;
      cursor: pointer;
    }
    app-control-preview .ctrl-section-body {
      padding: 16px;
      min-height: 60px;
    }
    app-control-preview .ctrl-section-placeholder {
      color: #9ca3af;
      font-size: 13px;
      text-align: center;
      padding: 12px;
    }
    app-control-preview .ctrl-spacer {
      display: block;
    }
    app-control-preview .ctrl-unknown {
      border: 2px dashed #fbbf24;
      border-radius: 6px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: #fefce8;
    }
    app-control-preview .ctrl-unknown span:first-child {
      font-weight: 500;
      color: #92400e;
    }
    app-control-preview .ctrl-unknown-hint {
      font-size: 12px;
      color: #a16207;
    }
    app-control-preview .ctrl-helper {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    app-control-preview .ctrl-placeholder {
      color: #9ca3af;
      font-size: 13px;
    }
  `]
})
export class ControlPreviewComponent implements OnChanges {
  @Input() control!: FormControl;
  @Input() isSelected = false;
  @Input() isPreview = false;

  wrapperStyle: Record<string, string> = {};
  labelStyle: Record<string, string> = {};
  inputStyle: Record<string, string> = {};
  buttonStyle: Record<string, string> = {};

  private knownTypes = new Set([
    'TextBox','EmailBox','PasswordBox','NumberBox','MultiTextBox','DropdownList','MultiSelect',
    'RadioButton','Checkbox','CheckboxGroup','ToggleSwitch','DatePicker','DateTimePicker',
    'TimePicker','Slider','FileUpload','ImageUpload','ColorPicker','RichTextEditor','Label',
    'Heading','Divider','HtmlContent','Button','LinkButton','IconButton','Section','Spacer'
  ]);

  ngOnChanges() { this.buildStyles(); }

  is(type: string): boolean { return this.control?.controlTypeName === type; }

  isUnknown(): boolean {
    return !!this.control && !this.knownTypes.has(this.control.controlTypeName);
  }

  get showLabel(): boolean {
    return !this.is('Checkbox') && !this.is('Divider') && !this.is('Spacer') &&
           !this.is('Label') && !this.is('Button') && !this.is('LinkButton') &&
           !this.is('IconButton');
  }

  getInputType(): string {
    if (this.is('EmailBox')) return 'email';
    if (this.is('PasswordBox')) return 'password';
    if (this.is('NumberBox')) return 'number';
    return 'text';
  }

  getItems() { return this.control?.dataSourceItems || []; }

  buildStyles() {
    if (!this.control) return;

    this.inputStyle = {
      ...(this.control.fontFamily ? { fontFamily: this.control.fontFamily } : {}),
      ...(this.control.fontSize ? { fontSize: `${this.control.fontSize}px` } : {}),
      ...(this.control.fontWeight ? { fontWeight: this.control.fontWeight } : {}),
      ...(this.control.fontStyle ? { fontStyle: this.control.fontStyle } : {}),
      ...(this.control.textColor ? { color: this.control.textColor } : {}),
      ...(this.control.backgroundColor ? { backgroundColor: this.control.backgroundColor } : {}),
      ...(this.control.borderColor ? { borderColor: this.control.borderColor } : {}),
      ...(this.control.borderWidth !== undefined ? { borderWidth: `${this.control.borderWidth}px` } : {}),
      ...(this.control.borderRadius !== undefined ? { borderRadius: `${this.control.borderRadius}px` } : {}),
      ...(this.control.padding ? { padding: this.control.padding } : {}),
    };

    this.labelStyle = {
      ...(this.control.labelColor ? { color: this.control.labelColor } : {}),
      ...(this.control.fontFamily ? { fontFamily: this.control.fontFamily } : {}),
    };

    this.buttonStyle = {
      ...this.inputStyle,
      ...(this.control.controlColor && this.control.buttonVariant === 'contained'
        ? { backgroundColor: this.control.controlColor, borderColor: this.control.controlColor }
        : {}),
      ...(this.control.controlColor && this.control.buttonVariant === 'outlined'
        ? { borderColor: this.control.controlColor, color: this.control.controlColor }
        : {}),
    };

    this.wrapperStyle = {
      ...(this.control.margin ? { margin: this.control.margin } : {}),
      ...(this.control.width && this.control.width !== '100%' ? { width: this.control.width } : {}),
    };
  }
}
