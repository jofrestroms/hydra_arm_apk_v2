import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private url = 'https://hydra-crud.onrender.com/api';
  private geoUrl = 'https://geolocalizaci-n-1.onrender.com/api';

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

  updateFamiliar(run: string, data: any) {
    return this.handleRequest(
      this.http.put<any>(`${this.url}/familiares/${run}`, data, { headers: this.getHeaders() })
    );
  }

  postBpm(data: any) {
    return this.handleRequest(
      this.http.post<any>(`${this.url}/bpm`, data, { headers: this.getHeaders() })
    );
  }

  /**
   * Historial de BPM de un paciente.
   *
   * Antes apuntaba a GET /api/bpm/search, que no existe en ningun backend:
   * caia en obtenerBpmActual con runP="search" y devolvia 404. La ruta real es
   * /api/bpm/{runP}/historial, que acepta un limite en vez de un rango.
   *
   * El runP viaja cifrado: la tabla bpm la sigue escribiendo el ESP32.
   */
  getBpmPorRango(runP: string, _inicio: string, _fin: string, limite = 100) {
    const params = new HttpParams().set('limite', String(limite));
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/bpm/${encodeURIComponent(runP)}/historial`, { headers: this.getHeaders(), params })
    );
  }

  // ── Mensajes (mensajería 1:1 paciente/familiar <-> cuidador/medico) ──

  getEmpleados() {
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/empleados`, { headers: this.getHeaders() })
    );
  }

  enviarMensaje(data: any) {
    return this.handleRequest(
      this.http.post<any>(`${this.url}/mensajes`, data, { headers: this.getHeaders() })
    );
  }

  getConversacion(runA: string, runB: string) {
    const params = new HttpParams().set('runA', runA).set('runB', runB);
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/mensajes/conversacion`, { headers: this.getHeaders(), params })
    );
  }

  getNoLeidos(destinoRun: string, rolDestino: string) {
    const params = new HttpParams().set('destinoRun', destinoRun).set('rolDestino', rolDestino);
    return this.handleRequest(
      this.http.get<any[]>(`${this.url}/mensajes/no-leidos`, { headers: this.getHeaders(), params })
    );
  }

  marcarLeido(id: number) {
    return this.handleRequest(
      this.http.patch<any>(`${this.url}/mensajes/${id}/leer`, {}, { headers: this.getHeaders() })
    );
  }

  eliminarMensaje(id: number) {
    return this.handleRequest(
      this.http.delete<any>(`${this.url}/mensajes/${id}`, { headers: this.getHeaders() })
    );
  }

  // ── Geolocalización (API geolocalizaci-n) ──

  postGeolocalizacion(data: any) {
    return this.handleRequest(
      this.http.post<any>(`${this.geoUrl}/geolocalizacion/actualizar`, data, { headers: this.getHeaders() })
    );
  }

  getUbicacionActual(rut: string) {
    return this.handleRequest(
      this.http.get<any>(`${this.geoUrl}/geolocalizacion/${encodeURIComponent(rut)}`, { headers: this.getHeaders() })
    );
  }

  getHistorialGeo(rut: string, limite?: number) {
    const params = new HttpParams().set('limite', (limite || 200).toString());
    return this.handleRequest(
      this.http.get<any[]>(`${this.geoUrl}/geolocalizacion/${encodeURIComponent(rut)}/historial`, { headers: this.getHeaders(), params })
    );
  }
}