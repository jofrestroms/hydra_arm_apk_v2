import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UsuarioService } from '../../Services/usuario-service';

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
    private router: Router
  ) { }

  ngOnInit() { }

  irARecuperar() {
    this.router.navigate(['/olvidar-contrasena']);
  }

  onRutInput(event: any) {
    let value = event.target.value
      .replace(/[^0-9kK]/g, '')
      .toUpperCase();

    if (!value) {
      this.rut = '';
      return;
    }

    if (value.length > 1) {
      const cuerpo = value.slice(0, -1);
      const dv = value.slice(-1);

      const rutLimpio = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

      this.rut = `${rutLimpio}-${dv}`;
    } else {
      this.rut = value;
    }

    event.target.value = this.rut;
  }

  async login() {
    if (!this.rut || !this.password) {
      this.mensajeError = 'Completa ambos campos';
      return;
    }

    this.cargando = true;
    this.mensajeError = '';

    try {
      try {
        const encontrado = await this.usuarioService.Iniciar_sesion(this.rut, this.password);

        if (encontrado) {
          const sesion = { tipo: 'paciente', dbId: encontrado.dbId };
          localStorage.setItem('hydra_sesion', JSON.stringify(sesion));
          this.router.navigate(['/corazon']);
          return;
        }
      } catch (error) {
        console.error('Error al iniciar sesión como paciente:', error);

      }

      try {
        const resultado = await this.usuarioService.Iniciar_sesion_familiar(this.rut, this.password);

        if (resultado) {
          const familiar = resultado.familiar;
          const pacientes = resultado.pacientes;
          const sesion = { tipo: 'familiar', runFamiliar: familiar.run, display: familiar };
          localStorage.setItem('hydra_sesion', JSON.stringify(sesion));

          this.router.navigate(['/seleccionar-paciente'], {
            state: { familiar, pacientes }
          });
          return;
        }

      } catch (error) {
        console.error('Error al buscar familiar:', error);
      }


      this.mensajeError = 'RUT o contraseña inválidos';
    } catch {
      this.mensajeError = 'Error de conexión. Intenta de nuevo.';
    } finally {
      this.cargando = false;
    }
  }
}
