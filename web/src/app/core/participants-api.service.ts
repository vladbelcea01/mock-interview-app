import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Paginated, Participant, ParticipantInput, SessionListItem, Trends } from './api.models';

@Injectable({ providedIn: 'root' })
export class ParticipantsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/participants`;

  list(q = '', page = 1, pageSize = 20) {
    const params = new HttpParams({ fromObject: { page, pageSize, ...(q ? { q } : {}) } });
    return this.http.get<Paginated<Participant>>(this.base, { params });
  }
  get(id: string) {
    return this.http.get<Participant>(`${this.base}/${id}`);
  }
  create(input: ParticipantInput) {
    return this.http.post<Participant>(this.base, input);
  }
  update(id: string, input: Partial<ParticipantInput>) {
    return this.http.patch<Participant>(`${this.base}/${id}`, input);
  }
  sessions(id: string) {
    return this.http.get<SessionListItem[]>(`${this.base}/${id}/sessions`);
  }
  trends(id: string) {
    return this.http.get<Trends>(`${environment.apiUrl}/reports/trends`, { params: { participantId: id } });
  }
}
