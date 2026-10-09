import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  Feedback,
  FeedbackInput,
  Paginated,
  Session,
  SessionDetail,
  SessionInput,
  SessionListItem,
  SessionQuery,
} from './api.models';

@Injectable({ providedIn: 'root' })
export class SessionsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/sessions`;

  list(query: SessionQuery) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<Paginated<SessionListItem>>(this.base, { params });
  }
  get(id: string) {
    return this.http.get<SessionDetail>(`${this.base}/${id}`);
  }
  create(input: SessionInput) {
    return this.http.post<Session>(this.base, input);
  }
  update(id: string, input: Partial<SessionInput>) {
    return this.http.patch<Session>(`${this.base}/${id}`, input);
  }
  complete(id: string) {
    return this.http.post<Session>(`${this.base}/${id}/complete`, {});
  }
  cancel(id: string) {
    return this.http.post<Session>(`${this.base}/${id}/cancel`, {});
  }
  saveFeedback(id: string, input: FeedbackInput) {
    return this.http.put<Feedback>(`${this.base}/${id}/feedback`, input);
  }
}
