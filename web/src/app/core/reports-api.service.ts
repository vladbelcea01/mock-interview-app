import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { SearchResults, Summary } from './api.models';

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);

  summary() {
    return this.http.get<Summary>(`${environment.apiUrl}/reports/summary`);
  }
  search(q: string) {
    return this.http.get<SearchResults>(`${environment.apiUrl}/search`, { params: { q } });
  }
}
