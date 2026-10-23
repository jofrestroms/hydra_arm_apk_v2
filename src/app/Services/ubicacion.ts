import { Injectable } from '@angular/core';
import BackgroundGeolocation from '@transistorsoft/capacitor-background-geolocation';

/**
 * Tracking de ubicación en segundo plano con el SDK nativo
 * (transistorsoft). Envía directo al backend de geolocalización sin pasar
 * por el WebView, por lo que sigue funcionando aunque la app se cierre.
 *
 * El cuerpo enviado queda plano gracias a rootProperty ".":
 * { "latitud": ..., "longitud": ..., "rutPaciente": "<RUN cifrado>" }
 */
@Injectable({ providedIn: 'root' })
export class UbicacionService {

  private readonly URL_ACTUALIZAR = 'https://geolocalizaci-n-1.onrender.com/api/geolocalizacion/actualizar';
  private readonly PLANTILLA = '{"latitud":<%= latitude %>,"longitud":<%= longitude %>}';

  async iniciar(runPaciente: string): Promise<boolean> {
    if (!runPaciente) return false;

    try {
      await BackgroundGeolocation.ready({
        geolocation: {
          desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
          distanceFilter: 0,
          locationUpdateInterval: 30000,
          locationAuthorizationRequest: 'Always'
        },
        http: {
          url: this.URL_ACTUALIZAR,
          autoSync: true,
          method: 'POST',
          rootProperty: '.'
        },
        app: {
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
          heartbeatInterval: 60,
          backgroundPermissionRationale: {
            title: 'Permitir ubicación siempre',
            message: 'Hydra necesita registrar tu ubicación incluso con la pantalla apagada para el monitoreo médico.',
            positiveAction: 'Abrir configuración',
            negativeAction: 'Cancelar'
          },
          notification: {
            title: 'Hydra monitoreando',
            text: 'Registrando ubicación para monitoreo médico',
            channelName: 'Hydra ubicación',
            sticky: true
          }
        },
        persistence: {
          locationTemplate: this.PLANTILLA,
          extras: { rutPaciente: runPaciente },
          maxDaysToPersist: 3
        }
      });

      const estado = await BackgroundGeolocation.requestPermission();
      if (estado !== BackgroundGeolocation.AuthorizationStatus.Always) {
        console.warn('[Ubicacion] Permiso "todo el tiempo" no concedido:', estado);
      }

      const state = await BackgroundGeolocation.getState();
      if (!state.enabled) {
        await BackgroundGeolocation.start();
      }
      return true;
    } catch (e) {
      console.error('[Ubicacion] No se pudo iniciar el tracking', e);
      return false;
    }
  }

  async detener(): Promise<void> {
    try {
      const state = await BackgroundGeolocation.getState();
      if (state.enabled) {
        await BackgroundGeolocation.stop();
      }
    } catch (e) {
      console.error('[Ubicacion] No se pudo detener el tracking', e);
    }
  }
}
