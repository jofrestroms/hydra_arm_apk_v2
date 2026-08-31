import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../Services/api';
import { Crypto } from '../../Services/crypto';

@Component({
  selector: 'app-olvidar-contrasena',
  templateUrl: './olvidar-contrasena.page.html',
  styleUrls: ['./olvidar-contrasena.page.scss'],
  standalone: false
})
export class OlvidarContrasenaPage {

  paso = 1;
  cargando = false;

  rut = '';
  telefono = '';
  nuevaPassword = '';
  confirmarPassword = '';

  mensajeError = '';
  mensajeExito = '';

  private cuenta: { tipo: 'paciente' | 'familiar'; cifrado: any; legible: any } | null = null;

  constructor(
    private api: ApiService,
    private CriptoService: Crypto,
    private router: Router
  ) {}

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

  async buscarCuenta() {
    this.mensajeError = '';
    this.mensajeExito = '';

    if (!this.rut) {
      this.mensajeError = 'Ingresa tu RUT';
      return;
    }

    this.cargando = true;

    try {
      const rutInput = this.rut.replace(/[.\s-]/g, '').toLowerCase();
      let encontrado: { tipo: 'paciente' | 'familiar'; cifrado: any; legible: any } | null = null;

      const pacientes = await firstValueFrom(this.api.getPacientes());
      for (const paciente of pacientes) {
        try {
          const runPaciente = await this.CriptoService.getNombreOriginal(paciente.runP);
          if (!runPaciente) continue;
          const runLimpio = runPaciente.replace(/[.\s-]/g, '').toLowerCase();
          if (runLimpio !== rutInput) continue;

          encontrado = {
            tipo: 'paciente',
            cifrado: paciente,
            legible: await this.obtenerLegible(paciente, ['correo', 'password', 'runP', 'telefono'])
          };
          break;
        } catch (error) {
          console.error('Error desencriptando RUN del paciente:', error);
        }
      }

      if (!encontrado) {
        const familiares = await firstValueFrom(this.api.getFamiliares());
        for (const familiar of familiares) {
          try {
            const runFamiliar = await this.CriptoService.getNombreOriginal(familiar.run);
            if (!runFamiliar) continue;
            const runLimpio = runFamiliar.replace(/[.\s-]/g, '').toLowerCase();
            if (runLimpio !== rutInput) continue;

            encontrado = {
              tipo: 'familiar',
              cifrado: familiar,
              legible: await this.obtenerLegible(familiar, ['run', 'correo', 'password', 'telefono'])
            };
            break;
          } catch (error) {
            console.error('Error desencriptando RUN del familiar:', error);
          }
        }
      }

      if (!encontrado) {
        this.mensajeError = 'RUT no registrado';
        return;
      }

      this.cuenta = encontrado;
      this.paso = 2;
    } catch (error) {
      console.error('Error al buscar cuenta:', error);
      this.mensajeError = 'Error de conexión. Intenta de nuevo.';
    } finally {
      this.cargando = false;
    }
  }

  async verificarTelefono() {
    this.mensajeError = '';
    this.mensajeExito = '';

    if (!this.cuenta) {
      this.mensajeError = 'Vuelve a ingresar tu RUT';
      this.paso = 1;
      return;
    }

    if (!this.telefono) {
      this.mensajeError = 'Ingresa tu teléfono registrado';
      return;
    }

    const telefonoRegistrado = this.cuenta.legible.telefono as string;
    if (!this.normalizarTelefono(telefonoRegistrado) || this.normalizarTelefono(telefonoRegistrado) !== this.normalizarTelefono(this.telefono)) {
      this.mensajeError = 'El teléfono no coincide con el registrado';
      return;
    }

    this.paso = 3;
  }

  async cambiarPassword() {
    this.mensajeError = '';
    this.mensajeExito = '';

    if (!this.cuenta) {
      this.mensajeError = 'Vuelve a ingresar tu RUT';
      this.paso = 1;
      return;
    }

    if (!this.nuevaPassword || !this.confirmarPassword) {
      this.mensajeError = 'Completa ambos campos de contraseña';
      return;
    }

    if (this.nuevaPassword.length < 6) {
      this.mensajeError = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    if (this.nuevaPassword !== this.confirmarPassword) {
      this.mensajeError = 'Las contraseñas no coinciden';
      return;
    }

    this.cargando = true;

    try {
      const passwordEncriptada = await this.CriptoService.getNombreEncriptado(this.nuevaPassword);
      const actualizado = { ...this.cuenta.cifrado, password: passwordEncriptada };

      if (this.cuenta.tipo === 'paciente') {
        await firstValueFrom(this.api.updatePaciente(this.cuenta.cifrado.runP, actualizado));
      } else {
        await firstValueFrom(this.api.updateFamiliar(this.cuenta.cifrado.run, actualizado));
      }

      this.mensajeExito = 'Contraseña actualizada correctamente';
      this.cuenta = null;
      this.paso = 1;
      this.rut = '';
      this.telefono = '';
      this.nuevaPassword = '';
      this.confirmarPassword = '';

      setTimeout(() => this.router.navigate(['/login']), 2000);
    } catch (error) {
      console.error('Error al actualizar contraseña:', error);
      this.mensajeError = 'No se pudo actualizar la contraseña. Intenta de nuevo.';
    } finally {
      this.cargando = false;
    }
  }

  private async obtenerLegible(cifrado: any, campos: string[]): Promise<any> {
    const legible: any = {};
    for (const campo of campos) {
      const valor = cifrado[campo];
      legible[campo] = valor ? await this.CriptoService.getNombreOriginal(valor) : valor;
    }
    return legible;
  }

  private normalizarTelefono(telefono: string): string {
    if (!telefono) return '';
    let limpio = telefono.replace(/\D/g, '');
    if (limpio.startsWith('56')) limpio = limpio.slice(2);
    return limpio;
  }

  volver() {
    this.router.navigate(['/login']);
  }
}