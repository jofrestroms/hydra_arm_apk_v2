import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

export interface EstadoBateria {
  /** Porcentaje de 0 a 100. */
  nivel: number;
  cargando: boolean;
}

type EscuchaBateria = (estado: EstadoBateria | null) => void;

/**
 * Bateria del dispositivo que ejecuta la app.
 *
 * Solo consulta la API nativa cuando la app corre como APK (Android/iOS).
 * En el navegador devuelve null y las pantallas ocultan la tarjeta.
 */
@Injectable({ providedIn: 'root' })
export class BatteryService {

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly escuchas = new Set<EscuchaBateria>();
  private ultimoEstado: EstadoBateria | null = null;
  private leyendo = false;

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') {
      void this.actualizar();
    }
  };

  esNativo(): boolean {
    return Capacitor.isNativePlatform();
  }

  async obtener(): Promise<EstadoBateria | null> {
    if (!this.esNativo()) return null;

    try {
      const info = await Device.getBatteryInfo();
      // -1 significa que la plataforma no pudo determinar el nivel.
      if (info.batteryLevel == null || info.batteryLevel < 0) return null;

      return {
        nivel: Math.round(info.batteryLevel * 100),
        cargando: !!info.isCharging
      };
    } catch (e) {
      console.error('No se pudo leer la bateria del dispositivo', e);
      return null;
    }
  }

  /**
   * Suscribe una pantalla a la bateria del dispositivo. Permite que Corazon y
   * Dashboard esten activos a la vez sin pisarse el uno al otro.
   * Devuelve la funcion para cancelar la suscripcion.
   */
  suscribir(escucha: EscuchaBateria): () => void {
    if (!this.esNativo()) {
      escucha(null);
      return () => {};
    }

    this.escuchas.add(escucha);
    // Al volver a una pantalla ya visitada, muestra de inmediato el ultimo dato.
    escucha(this.ultimoEstado);

    if (this.escuchas.size === 1) {
      document.addEventListener('visibilitychange', this.onVisibility);
      void this.actualizar();
      this.timer = setInterval(() => void this.actualizar(), 30000);
    } else if (this.ultimoEstado === null) {
      void this.actualizar();
    }

    return () => {
      this.escuchas.delete(escucha);
      if (this.escuchas.size === 0) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        document.removeEventListener('visibilitychange', this.onVisibility);
      }
    };
  }

  private async actualizar(): Promise<void> {
    if (this.leyendo) return;

    this.leyendo = true;
    try {
      const estado = await this.obtener();
      this.ultimoEstado = estado;
      this.escuchas.forEach((escucha) => escucha(estado));
    } finally {
      this.leyendo = false;
    }
  }
}
