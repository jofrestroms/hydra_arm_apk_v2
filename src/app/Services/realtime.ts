import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable, Subject } from 'rxjs';

/**
 * Cliente del puente realtime (hydra_realtime) vía Server-Sent Events.
 * Conecta contra {realtimeUrl}/api/realtime/stream y re-emite los eventos
 * por nombre de tabla o canal (mensajes, bpm, geolocalizacion, ...).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {

  private es: EventSource | null = null;
  private subjects = new Map<string, Subject<any>>();
  private openSubject = new Subject<void>();
  private errorSubject = new Subject<void>();
  private reconectar = false;
  private conRetraso = false;

  private getUrl(): string {
    return (environment.realtimeUrl || 'http://localhost:8083') + '/api/realtime/stream';
  }

  conectar(eventos: string[] = [
    'hello', 'mensajes', 'bpm', 'geolocalizacion',
    'historial_bpm', 'historial_geolocalizacion'
  ]): void {
    this.desconectar();
    this.reconectar = true;

    const es = new EventSource(this.getUrl());
    this.es = es;

    es.onopen = () => {
      this.conRetraso = false;
      this.openSubject.next();
    };

    es.onerror = () => {
      try { es.close(); } catch (e) { }
      this.errorSubject.next();
      if (this.reconectar) {
        setTimeout(() => { if (this.reconectar) this.conectar(); }, this.conRetraso ? 15000 : 1000);
      }
      this.conRetraso = true;
    };

    for (const ev of eventos) {
      es.addEventListener(ev, (e: MessageEvent) => this.emitir(ev, e.data));
    }
  }

  on(evento: string): Observable<any> {
    if (!this.subjects.has(evento)) {
      this.subjects.set(evento, new Subject<any>());
    }
    return this.subjects.get(evento)!.asObservable();
  }

  onOpen(): Observable<void> {
    return this.openSubject.asObservable();
  }

  onError(): Observable<void> {
    return this.errorSubject.asObservable();
  }

  desconectar(): void {
    this.reconectar = false;
    if (this.es) {
      try { this.es.close(); } catch (e) { }
      this.es = null;
    }
  }

  private emitir(evento: string, data: string): void {
    let json: any = null;
    try { json = JSON.parse(String(data)); } catch (e) { }
    const subj = this.subjects.get(evento);
    if (subj) subj.next(json);
  }
}