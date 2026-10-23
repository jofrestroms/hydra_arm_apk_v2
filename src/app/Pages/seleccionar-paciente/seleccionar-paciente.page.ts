import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NavController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../Services/api';
import { UsuarioService } from '../../Services/usuario-service';

@Component({
  selector: 'app-seleccionar-paciente',
  templateUrl: './seleccionar-paciente.page.html',
  styleUrls: ['./seleccionar-paciente.page.scss'],
  standalone: false
})
export class SeleccionarPacientePage implements OnInit {

  familiar: any = null;
  pacientes: any[] = [];
  cargando = true;

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private api: ApiService,
    private usuarioService: UsuarioService
  ) {}

  async ngOnInit() {
    const state = this.router.getCurrentNavigation()?.extras?.state as any;
    if (state?.familiar) {
      this.familiar = state.familiar;
    }

    if (state?.pacientes) {
      const pacientesDescifrados = await Promise.all(
        state.pacientes.map(async (p: any) => {
          const legible = await this.usuarioService.obtenerPacienteLegible(p);
          return {
            display: legible,
            dbId: p.runP
          };
        })
      );
      this.pacientes = pacientesDescifrados;
      this.cargando = false;
      return;
    }

    await this.cargarDesdeSesion();
    this.cargando = false;
  }

  private async cargarDesdeSesion() {
    const sesion = localStorage.getItem('hydra_sesion');
    if (!sesion) {
      this.router.navigate(['/login']);
      return;
    }

    let s: any = null;
    try {
      s = JSON.parse(sesion);
    } catch {
      s = null;
    }

    if (!s || s.tipo !== 'familiar' || !s.runFamiliar) {
      this.router.navigate(['/login']);
      return;
    }

    this.familiar = s.display || { run: s.runFamiliar };

    try {
      const pacientes = await firstValueFrom(this.api.getPacientesDeFamiliar(s.runFamiliar));
      this.pacientes = await Promise.all(
        (pacientes || []).map(async (p: any) => ({
          display: await this.usuarioService.obtenerPacienteLegible(p),
          dbId: p.runP
        }))
      );
    } catch (error) {
      console.error('Error cargando pacientes del familiar:', error);
    }
  }

  seleccionarPaciente(paciente: any) {
    const sesion = {
      tipo: 'familiar',
      runFamiliar: this.familiar.run,
      runPaciente: paciente.dbId,
      pacienteNombre: paciente.display?.nombre + ' ' + (paciente.display?.apellidoPaterno || ''),
      display: this.familiar
    };
    localStorage.setItem('hydra_sesion', JSON.stringify(sesion));
    this.router.navigate(['/dashboard-familiar']);
  }

  volver() {
    this.navCtrl.back();
  }
}
