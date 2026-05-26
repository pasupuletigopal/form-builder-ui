// src/app/services/api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse, PagedResult, ControlType, DataType, DataSource,
  ValidationRule, FormDefinition, FormSummary, FormControl
} from '../models/form-builder.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
    private base = `${environment.apiBase}/api`;

  // --- Master Data ---
  getControlTypes(): Observable<ControlType[]> {
    return this.http.get<ApiResponse<ControlType[]>>(`${this.base}/controltypes`)
      .pipe(map(r => r.data));
  }
  createControlType(data: Partial<ControlType>): Observable<ControlType> {
    return this.http.post<ApiResponse<ControlType>>(`${this.base}/controltypes`, data)
      .pipe(map(r => r.data));
  }
  updateControlType(id: number, data: Partial<ControlType>): Observable<ControlType> {
    return this.http.put<ApiResponse<ControlType>>(`${this.base}/controltypes/${id}`, data)
      .pipe(map(r => r.data));
  }
  deleteControlType(id: number): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(`${this.base}/controltypes/${id}`)
      .pipe(map(r => r.data));
  }

  getDataTypes(): Observable<DataType[]> {
    return this.http.get<ApiResponse<DataType[]>>(`${this.base}/datatypes`)
      .pipe(map(r => r.data));
  }

  getDataSources(): Observable<DataSource[]> {
    return this.http.get<ApiResponse<DataSource[]>>(`${this.base}/datasources`)
      .pipe(map(r => r.data));
  }
  getDataSource(id: number): Observable<DataSource> {
    return this.http.get<ApiResponse<DataSource>>(`${this.base}/datasources/${id}`)
      .pipe(map(r => r.data));
  }
  createDataSource(data: Partial<DataSource>): Observable<DataSource> {
    return this.http.post<ApiResponse<DataSource>>(`${this.base}/datasources`, data)
      .pipe(map(r => r.data));
  }
  updateDataSource(id: number, data: Partial<DataSource>): Observable<DataSource> {
    return this.http.put<ApiResponse<DataSource>>(`${this.base}/datasources/${id}`, data)
      .pipe(map(r => r.data));
  }
  deleteDataSource(id: number): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(`${this.base}/datasources/${id}`)
      .pipe(map(r => r.data));
  }

  getValidationRules(): Observable<ValidationRule[]> {
    return this.http.get<ApiResponse<ValidationRule[]>>(`${this.base}/validationrules`)
      .pipe(map(r => r.data));
  }

  // --- Forms ---
  getForms(page = 1, pageSize = 20, search?: string): Observable<PagedResult<FormSummary>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    return this.http.get<ApiResponse<PagedResult<FormSummary>>>(`${this.base}/forms`, { params })
      .pipe(map(r => r.data));
  }
  getForm(id: number): Observable<FormDefinition> {
    return this.http.get<ApiResponse<FormDefinition>>(`${this.base}/forms/${id}`)
      .pipe(map(r => r.data));
  }
  createForm(data: Partial<FormDefinition>): Observable<FormDefinition> {
    return this.http.post<ApiResponse<FormDefinition>>(`${this.base}/forms`, data)
      .pipe(map(r => r.data));
  }
  updateForm(id: number, data: Partial<FormDefinition>): Observable<FormDefinition> {
    return this.http.put<ApiResponse<FormDefinition>>(`${this.base}/forms/${id}`, data)
      .pipe(map(r => r.data));
  }
  deleteForm(id: number): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(`${this.base}/forms/${id}`)
      .pipe(map(r => r.data));
  }
  updateFormControls(formId: number, controls: Partial<FormControl>[]): Observable<FormDefinition> {
    return this.http.put<ApiResponse<FormDefinition>>(`${this.base}/forms/${formId}/controls`, { controls })
      .pipe(map(r => r.data));
  }
  cloneForm(formId: number, newName: string): Observable<number> {
    return this.http.post<ApiResponse<number>>(`${this.base}/forms/${formId}/clone`, newName)
      .pipe(map(r => r.data));
  }
  submitForm(formId: number, data: object): Observable<string> {
    return this.http.post<ApiResponse<string>>(`${this.base}/forms/${formId}/submit`, data)
      .pipe(map(r => r.data));
  }
  getSubmissions(formId: number): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.base}/forms/${formId}/submissions`)
      .pipe(map(r => r.data));
  }
}
