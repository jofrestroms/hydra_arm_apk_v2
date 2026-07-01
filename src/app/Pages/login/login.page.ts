import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UsuarioService } from '../../Services/usuario-service';
import { ApiService } from '../../Services/api';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage implements OnInit {

  rut = '';
  password = '';
  cargando = false;
  mensajeError = '';

  constructor(
    private usuarioService: UsuarioService,
    private router: Router,
    private api: ApiService,
    private user: UsuarioService
  ) {}

  ngOnInit() {}

  onRutInput(event: any) {
    let value = event.target.value.replace(/[.\s-]/g, '');
    if (!value) return;
    if (value.length > 1) {
      const cuerpo = value.slice(0, -1);
      const dv = value.slice(-1);
      this.rut = `${cuerpo}-${dv}`;
    } else {
      this.rut = value;
    }

    const rutLimpio = value.replace(/[.\s]/g, '').toLowerCase();
    if (rutLimpio.length > 1 && !rutLimpio.includes('-')) {
      const cuerpo = rutLimpio.slice(0, -1);
      const dv = rutLimpio.slice(-1);
      this.rut = `${cuerpo}-${dv}`;
    } else {
      this.rut = rutLimpio;
    }
  }

  async login() {
    if (!this.rut || !this.password) {
      this.mensajeError = 'Completa ambos campos';
      return;
    }

    this.cargando = true;
    this.mensajeError = '';

    try {
      const encontrado = await this.usuarioService.Iniciar_sesion(this.rut, this.password);

      if (encontrado) {
        const sesion = { tipo: 'paciente', dbId: encontrado.dbId, display: encontrado.display };
        localStorage.setItem('hydra_sesion', JSON.stringify(sesion));
        this.router.navigate(['/corazon']);
        return;
      }

      const familiar = await firstValueFrom(this.api.getFamiliar(this.rut));
      if (familiar && familiar.pasword === this.password) {
        const sesion = { tipo: 'familiar', runFamiliar: familiar.run, display: familiar };
        localStorage.setItem('hydra_sesion', JSON.stringify(sesion));

        const pacientes = await firstValueFrom(this.api.getPacientesDeFamiliar(this.rut));
        if (pacientes && pacientes.length > 0) {
          this.router.navigate(['/seleccionar-paciente'], {
            state: { familiar, pacientes }
          });
        } else {
          this.mensajeError = 'No tienes pacientes asignados';
        }
        return;
      }

      this.mensajeError = 'RUT o contraseña inválidos';
    } catch {
      this.mensajeError = 'Error de conexión. Intenta de nuevo.';
    } finally {
      this.cargando = false;
    }
  }
}
