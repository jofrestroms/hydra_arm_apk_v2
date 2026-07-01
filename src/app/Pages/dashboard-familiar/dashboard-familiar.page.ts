import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../Services/api';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard-familiar',
  templateUrl: './dashboard-familiar.page.html',
  styleUrls: ['./dashboard-familiar.page.scss'],
  standalone: false
})
export class DashboardFamiliarPage implements OnInit, OnDestroy {

  runPaciente = '';
  pacienteNombre = '';
  familiarNombre = '';

  bpmActual = '--';
  bateriaActual = 0;
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

  private pollingInterval: any;
  private ultimoId = 0;

  constructor(
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit() {
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

    this.cargarHistorialInicial();
    this.iniciarPolling();
  }

  ngAfterViewInit() {
    this.iniciarGrafico();
  }

  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.liveChart) this.liveChart.destroy();
  }

  private async cargarHistorialInicial() {
    const ahora = new Date();
    const hace5min = new Date(ahora.getTime() - 5 * 60000);

    try {
      const data: any = await this.api.getBpmPorRango(
        this.runPaciente,
        hace5min.toISOString(),
        ahora.toISOString()
      ).toPromise();

      if (data && data.length > 0) {
        data.forEach((bpm: any) => {
          this.agregarLectura(bpm.valorBpm, bpm.bateria, bpm.latitud, bpm.longitud);
        });
        this.ultimoId = Math.max(...data.map((b: any) => b.idBpm));
      }
    } catch (err) {
      console.error('Error cargando historial', err);
    }
  }

  private iniciarPolling() {
    this.pollingInterval = setInterval(async () => {
      try {
        const ahora = new Date();
        const hace30s = new Date(ahora.getTime() - 30000);

        const data: any = await this.api.getBpmPorRango(
          this.runPaciente,
          hace30s.toISOString(),
          ahora.toISOString()
        ).toPromise();

        if (data && data.length > 0) {
          const nuevos = data.filter((b: any) => b.idBpm > this.ultimoId);
          nuevos.forEach((bpm: any) => {
            if (bpm.valorBpm) {
              this.agregarLectura(bpm.valorBpm, bpm.bateria, bpm.latitud, bpm.longitud);
            }
          });
          if (nuevos.length > 0) {
            this.ultimoId = Math.max(...nuevos.map((b: any) => b.idBpm));
          }
        }
      } catch (err) {
        console.error('Error polling', err);
      }
    }, 3000);
  }

  private agregarLectura(bpm: number, bateria?: number, lat?: number, lng?: number) {
    this.bpmActual = bpm.toString();
    this.totalLecturas++;

    if (bateria !== null && bateria !== undefined) this.bateriaActual = bateria;
    if (lat) this.latitud = lat;
    if (lng) this.longitud = lng;

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

  cambiarPaciente() {
    this.router.navigate(['/seleccionar-paciente'], {
      state: {
        familiar: { run: this.familiarNombre },
        pacientes: []
      }
    });
  }

  cerrarSesion() {
    localStorage.removeItem('hydra_sesion');
    this.router.navigate(['/login']);
  }
}
