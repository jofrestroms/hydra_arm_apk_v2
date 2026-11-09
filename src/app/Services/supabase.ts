import { Injectable, NgZone } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Fila cruda de la tabla bpm (columnas snake_case de Postgres). */
export interface BpmFila {
  paciente_run_p: string;
  valor_bpm: number;
  spo2?: number;
  fecha?: string;
  bateria?: number;
  latitud?: number;
  longitud?: number;
}

/** Fila cruda de historial_bpm (la columna del paciente se llama run_p). */
export interface HistorialBpmFila {
  run_p: string;
  valor_bpm: number;
  spo2?: number;
  fecha?: string;
}

/**
 * Acceso directo a Supabase para el BPM.
 *
 * El ESP32 escribe en la tabla bpm; el APK se suscribe a los cambios de esa
 * tabla por Realtime. No pasa por hydra_realtime, así que las columnas llegan
 * snake_case tal como están en Postgres.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {

  private readonly client: SupabaseClient;

  constructor(private zone: NgZone) {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  /** Emite la fila nueva cada vez que el ESP32 hace upsert en bpm. */
  verBpm(runP: string): Observable<BpmFila> {
    return new Observable<BpmFila>(observer => {
      const canal = this.client
        .channel('bpm-' + runP)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bpm',
            filter: `paciente_run_p=eq.${runP}`
          },
          (payload: any) => {
            const fila = payload?.new as BpmFila | undefined;
            if (fila) {
              // El callback del WebSocket corre fuera de Angular.
              this.zone.run(() => observer.next(fila));
            }
          }
        )
        .subscribe(status => {
          console.log('Canal BPM Supabase:', status);
        });

      return () => {
        void this.client.removeChannel(canal);
      };
    });
  }

  /** Último valor guardado, para mostrarlo apenas se abre la pantalla. */
  async getBpmActual(runP: string): Promise<BpmFila | null> {
    const { data, error } = await this.client
      .from('bpm')
      .select('paciente_run_p,valor_bpm,spo2,fecha')
      .eq('paciente_run_p', runP)
      .maybeSingle();

    if (error) throw error;
    return data as BpmFila | null;
  }

  /** Últimas lecturas para llenar el gráfico al abrir el dashboard. */
  async getHistorialBpm(runP: string, limite = 100): Promise<HistorialBpmFila[]> {
    const { data, error } = await this.client
      .from('historial_bpm')
      .select('run_p,valor_bpm,spo2,fecha')
      .eq('run_p', runP)
      .order('fecha', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return ((data ?? []) as HistorialBpmFila[]).reverse();
  }
}
