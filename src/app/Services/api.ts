import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private url = 'https://hydra-crud.onrender.com/api';

  constructor(
    private http: HttpClient
  ) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  private handleRequest<T>(request: Observable<T>): Observable<T> {
    return request;
  }

  getPacientes() {
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/pacientes`, { headers: this.getHeaders() })
    );
  }

  getPaciente(run: string) {
    return this.handleRequest(
      this.http.get<any>(`${this.url}/pacientes/${run}`, { headers: this.getHeaders() })
    );
  }

  postPacientes(data: any) {
    return this.handleRequest(
      this.http.post<any>(`${this.url}/pacientes`, data, { headers: this.getHeaders() })
    );
  }

  updatePaciente(run: string, data: any) {
    return this.handleRequest(
      this.http.put<any>(`${this.url}/pacientes/${run}`, data, { headers: this.getHeaders() })
    );
  }

  deletePaciente(run: string) {
    return this.handleRequest(
      this.http.delete(`${this.url}/pacientes/${run}`, { headers: this.getHeaders() })
    );
  }

  getPaises() {
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/pais`, { headers: this.getHeaders() })
    );
  }

  getPais(id: number) {
    return this.handleRequest(
      this.http.get<any>(`${this.url}/pais/${id}`, { headers: this.getHeaders() })
    );
  }

  postPais(data: any) {
    return this.handleRequest(
      this.http.post<any>(`${this.url}/pais`, data, { headers: this.getHeaders() })
    );
  }

  updatePais(id: number, data: any) {
    return this.handleRequest(
      this.http.put<any>(`${this.url}/pais/${id}`, data, { headers: this.getHeaders() })
    );
  }

  deletePais(id: number) {
    return this.handleRequest(
      this.http.delete(`${this.url}/pais/${id}`, { headers: this.getHeaders() })
    );
  }

  getFamiliares() {
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/familiares`, { headers: this.getHeaders() })
    );
  }

  getFamiliar(run: string) {
    return this.handleRequest(
      this.http.get<any>(`${this.url}/familiares/${run}`, { headers: this.getHeaders() })
    );
  }

  getPacientesDeFamiliar(run: string) {
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/familiares/${run}/pacientes`, { headers: this.getHeaders() })
    );
  }

  postBpm(data: any) {
    return this.handleRequest(
      this.http.post<any>(`${this.url}/bpm`, data, { headers: this.getHeaders() })
    );
  }

  getBpmPorRango(runP: string, inicio: string, fin: string) {
    const params = new HttpParams().set('runP', runP).set('inicio', inicio).set('fin', fin);
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/bpm/search`, { headers: this.getHeaders(), params })
    );
  }
}