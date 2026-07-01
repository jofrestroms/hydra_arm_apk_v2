import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NavController, AlertController } from '@ionic/angular';
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
    }
    this.cargando = false;
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
