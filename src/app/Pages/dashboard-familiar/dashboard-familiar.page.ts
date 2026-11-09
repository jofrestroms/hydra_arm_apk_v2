import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Subscription } from 'rxjs';
import { ApiService } from '../../Services/api';
import { RealtimeService } from '../../Services/realtime';
import { SupabaseService } from '../../Services/supabase';
import { Crypto } from '../../Services/crypto';
import { BatteryService } from '../../Services/battery';
import Chart from 'chart.js/auto';
import * as L from 'leaflet';

@Component({
  selector: 'app-dashboard-familiar',
  templateUrl: './dashboard-familiar.page.html',
  styleUrls: ['./dashboard-familiar.page.scss'],
  standalone: false
})
export class DashboardFamiliarPage implements OnInit, OnDestroy, AfterViewInit {

  runPaciente = '';
  pacienteNombre = '';
  familiarNombre = '';

  bpmActual = '--';
  spo2Actual: number | null = null;
  esNativo = Capacitor.isNativePlatform();
  bateriaActual = 0;
  bateriaLeida = false;
  cargandoDispositivo = false;
  latitud = 0;
  longitud = 0;

  promedio = 0;
  maximo = 0;
  minimo = 999;
  totalLecturas = 0;

  @ViewChild('liveChart') liveChartCanvas!: ElementRef<HTMLCanvasElement>;
  liveChart!: Chart;
  bpmData: number[] = [];
  timestamps: string[] = [];
  maxDataPoints = 30;

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private polyline: L.Polyline | null = null;
  private trailPoints: [number, number][] = [];
  private readonly MAPA_INICIAL: [number, number] = [-33.4489, -70.6693];

  private realtimeSuscripciones: any[] = [];
  private bpmSub?: Subscription;
  private bateriaSub?: () => void;

  constructor(
    private api: ApiService,
    private realtime: RealtimeService,
    private router: Router,
    private cripto: Crypto,
    private supabase: SupabaseService,
    private battery: BatteryService
  ) {}

  async ngOnInit() {
    const sesion = localStorage.getItem('hydra_sesion');
    if (!sesion) {
      this.router.navigate(['/login']);
      return;
    }

    const s = JSON.parse(sesion);
    this.runPaciente = s.runPaciente || '';
    this.pacienteNombre = s.pacienteNombre || '';
    this.familiarNombre = s.display?.nombre || '';

    if (!this.runPaciente) {
      this.router.navigate(['/login']);
      return;
    }

    await this.cargarHistorialBpm();
    this.iniciarBpmTiempoReal();
    this.iniciarBateriaDispositivo();
    this.cargarHistorialPosicion();
    void this.iniciarRealtimeGeo();
  }

  ngAfterViewInit() {
    this.iniciarGrafico();
    this.iniciarMapa();
  }

  ngOnDestroy() {
    this.bpmSub?.unsubscribe();
    this.bateriaSub?.();
    this.realtime.desconectar();
    if (this.liveChart) this.liveChart.destroy();
  }

  private async cargarHistorialBpm() {
    try {
      const filas = await this.supabase.getHistorialBpm(this.runPaciente, 50);
      filas.forEach(f => this.agregarLectura(f.valor_bpm));
    } catch (err) {
      console.error('Error cargando historial BPM', err);
    }
  }

  private iniciarBpmTiempoReal(): void {
    if (!this.runPaciente) return;
    this.bpmSub = this.supabase.verBpm(this.runPaciente).subscribe({
      next: (fila: any) => {
        if (fila.paciente_run_p && fila.paciente_run_p !== this.runPaciente) return;
        if (fila.valor_bpm != null) this.agregarLectura(fila.valor_bpm);
        if (fila.spo2 != null) this.spo2Actual = fila.spo2;
      },
      error: (e) => console.error('Error en el canal BPM', e)
    });
  }

  private iniciarBateriaDispositivo(): void {
    if (!this.esNativo) return;

    this.bateriaSub = this.battery.suscribir((estado) => {
      if (!estado) {
        this.bateriaLeida = false;
        return;
      }
      this.bateriaActual = estado.nivel;
      this.cargandoDispositivo = estado.cargando;
      this.bateriaLeida = true;
    });
  }

  private async cargarHistorialPosicion() {
    try {
      const data: any = await this.api.getHistorialGeo(this.runPaciente, 200).toPromise();
      if (data && data.length > 0) {
        this.trailPoints = data.reverse().map((h: any) => [h.latitud, h.longitud]);
        if (this.map) {
          this.polyline = L.polyline(this.trailPoints, { color: '#3b82f6', weight: 3, opacity: 0.7 }).addTo(this.map);
        }
        const ultima = this.trailPoints[this.trailPoints.length - 1];
        this.latitud = ultima[0];
        this.longitud = ultima[1];
        this.actualizarMarcador();
      }
    } catch (err) {
      console.log('Sin historial de posición aún');
    }
  }

  private agregarPuntoTrayectoria(lat: number, lng: number) {
    const punto: [number, number] = [lat, lng];
    this.trailPoints.push(punto);
    if (this.map) {
      if (this.polyline) {
        this.polyline.addLatLng(punto);
      } else {
        this.polyline = L.polyline(this.trailPoints, { color: '#3b82f6', weight: 3, opacity: 0.7 }).addTo(this.map);
      }
    }
  }

  /**
   * SHA-256 del RUN del paciente. Es lo que guarda la columna
   * geolocalizacion.paciente_run_p.
   */
  private hashRunPaciente = '';

  private async iniciarRealtimeGeo() {
    this.realtime.conectar(['hello', 'geolocalizacion']);

    // Se calcula una sola vez, antes de suscribirse: el callback del SSE es
    // sincrono y no puede esperar al hash en cada evento.
    try {
      this.hashRunPaciente = await this.cripto.getHashRun(this.runPaciente);
    } catch (e) {
      console.warn('No se pudo hashear el RUN, se omiten eventos de geolocalizacion', e);
      this.hashRunPaciente = '';
    }

    this.realtimeSuscripciones.push(
      this.realtime.on('geolocalizacion').subscribe((payload: any) => {
        const fila = payload?.new;
        if (!fila) return;
        // El bridge convierte las columnas a camelCase; se aceptan ambos
        // formatos para no romper si en el futuro se cambia el contrato.
        const runEvento = fila.pacienteRunP ?? fila.paciente_run_p;
        // Sin hash no se filtra: es preferible no mostrar nada que mostrar la
        // ubicacion de otro paciente.
        if (!this.hashRunPaciente) return;
        if (!runEvento || runEvento !== this.hashRunPaciente) return;
        if (fila.latitud != null && fila.longitud != null) {
          this.latitud = fila.latitud;
          this.longitud = fila.longitud;
          this.agregarPuntoTrayectoria(fila.latitud, fila.longitud);
          this.actualizarMarcador();
        }
      })
    );
  }

  private agregarLectura(bpm: number, lat?: number, lng?: number) {
    this.bpmActual = bpm.toString();
    this.totalLecturas++;

    if (lat) this.latitud = lat;
    if (lng) this.longitud = lng;
    this.actualizarMarcador();

    if (bpm > this.maximo) this.maximo = bpm;
    if (bpm < this.minimo) this.minimo = bpm;
    this.promedio = Math.round(
      (this.promedio * (this.totalLecturas - 1) + bpm) / this.totalLecturas
    );

    this.bpmData.push(bpm);
    this.timestamps.push(new Date().toLocaleTimeString());

    if (this.bpmData.length > this.maxDataPoints) {
      this.bpmData.shift();
      this.timestamps.shift();
    }

    if (this.liveChart) {
      this.liveChart.data.labels = this.timestamps;
      this.liveChart.data.datasets[0].data = this.bpmData;
      this.liveChart.update();
    }
  }

  private iniciarGrafico() {
    const ctx = this.liveChartCanvas?.nativeElement.getContext('2d');
    if (!ctx) return;

    this.liveChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'BPM',
          data: [],
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        scales: {
          y: { min: 40, max: 180 }
        }
      }
    });
  }

  private iniciarMapa() {
    const el = this.mapContainer?.nativeElement;
    if (!el) return;

    const posicionInicial: [number, number] =
      (this.latitud && this.longitud) ? [this.latitud, this.longitud] : this.MAPA_INICIAL;

    this.map = L.map(el).setView(posicionInicial, 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    const icono = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });

    this.marker = L.marker(posicionInicial, { icon: icono }).addTo(this.map)
      .bindPopup(`<b>${this.pacienteNombre || 'Paciente'}</b>`);

    // Fuerza el recálculo del tamaño tras renderizar el contenido
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  private actualizarMarcador() {
    if (!this.map || !this.marker) return;
    if (!this.latitud || !this.longitud) return;

    const posicion: [number, number] = [this.latitud, this.longitud];
    this.marker.setLatLng(posicion);
    this.map.panTo(posicion);
  }

  cambiarPaciente() {
    this.router.navigate(['/seleccionar-paciente'], {
      state: {
        familiar: { run: this.familiarNombre },
        pacientes: []
      }
    });
  }

  abrirChat() {
    this.router.navigate(['/chat-familiar']);
  }

  cerrarSesion() {
    localStorage.removeItem('hydra_sesion');
    this.router.navigate(['/login']);
  }
}
