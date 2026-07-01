import { HttpClient, HttpParams, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private url = 'https://api.hydra.cl/api';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.auth.getAccessToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
  }

  private handleRequest<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return from(this.auth.refresh()).pipe(
            switchMap((refreshed) => {
              if (refreshed) {
                return from(this.getAuthHeaders()).pipe(
                  switchMap((headers) => {
                    const url = error.url || '';
                    const method = error.error?.message ? 'POST' : 'GET';
                    return this.http.request<T>(method, url, { headers });
                  })
                );
              }
              this.auth.logout();
              return throwError(() => new Error('Sesion expirada'));
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  getPacientes() {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.get<any[]>(`${this.url}/pacientes`, { headers: h }))
      )
    );
  }

  getPaciente(run: string) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.get<any>(`${this.url}/pacientes/${run}`, { headers: h }))
      )
    );
  }

  postPacientes(data: any) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.post<any>(`${this.url}/pacientes`, data, { headers: h }))
      )
    );
  }

  updatePaciente(run: string, data: any) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.put<any>(`${this.url}/pacientes/${run}`, data, { headers: h }))
      )
    );
  }

  deletePaciente(run: string) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.delete(`${this.url}/pacientes/${run}`, { headers: h }))
      )
    );
  }

  getPaises() {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.get<any[]>(`${this.url}/pais`, { headers: h }))
      )
    );
  }

  getPais(id: number) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.get<any>(`${this.url}/pais/${id}`, { headers: h }))
      )
    );
  }

  postPais(data: any) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.post<any>(`${this.url}/pais`, data, { headers: h }))
      )
    );
  }

  updatePais(id: number, data: any) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.put<any>(`${this.url}/pais/${id}`, data, { headers: h }))
      )
    );
  }

  deletePais(id: number) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.delete(`${this.url}/pais/${id}`, { headers: h }))
      )
    );
  }

  getFamiliares() {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.get<any[]>(`${this.url}/familiares`, { headers: h }))
      )
    );
  }

  getFamiliar(run: string) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.get<any>(`${this.url}/familiares/${run}`, { headers: h }))
      )
    );
  }

  getPacientesDeFamiliar(run: string) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.get<any[]>(`${this.url}/familiares/${run}/pacientes`, { headers: h }))
      )
    );
  }

  postBpm(data: any) {
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.post<any>(`${this.url}/bpm`, data, { headers: h }))
      )
    );
  }

  getBpmPorRango(runP: string, inicio: string, fin: string) {
    const params = new HttpParams().set('runP', runP).set('inicio', inicio).set('fin', fin);
    return this.handleRequest(
      from(this.getAuthHeaders()).pipe(
        switchMap(h => this.http.get<any[]>(`${this.url}/bpm/search`, { headers: h, params }))
      )
    );
  }
}
