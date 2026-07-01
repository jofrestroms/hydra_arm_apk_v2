import { Injectable } from '@angular/core';
import { ApiService } from './api';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Crypto } from './crypto';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  foto = true

  private usuarioAutenticado: any = null;
  file!: File;

  constructor(
    private api: ApiService,
    private http: HttpClient,
    private CriptoService: Crypto,
    private auth: AuthService
  ) { }

  private normalizarPaciente(data: any) {
    return data.paciente ? data.paciente : data;
  }

  validarTelefono(telefono: string): boolean {
    return /^9\d{8}$/.test(telefono);
  }

  async obtenerPacienteLegible(pacienteCifrado: any): Promise<any> {
    try {
      const legible = { ...pacienteCifrado };
      const [correo, pass, run, tel] = await Promise.all([
        firstValueFrom(this.CriptoService.getNombreOriginal(pacienteCifrado.correo)),
        firstValueFrom(this.CriptoService.getNombreOriginal(pacienteCifrado.password)),
        firstValueFrom(this.CriptoService.getNombreOriginal(pacienteCifrado.runP)),
        firstValueFrom(this.CriptoService.getNombreOriginal(pacienteCifrado.telefono))
      ]);
      legible.correo = correo;
      legible.password = pass;
      legible.runP = run;
      legible.telefono = tel;
      return legible;
    } catch (error) {
      console.error("Error al recuperar datos legibles:", error);
      return null;
    }
  }

  async desencriptarRun(runCifrado: string): Promise<string | null> {
    try {
      const run = await firstValueFrom(this.CriptoService.getNombreOriginal(runCifrado));
      return run;
    } catch (error) {
      console.error("Error al desencriptar RUN:", error);
      return null;
    }
  }

  async obtenerPacientesLegibles(): Promise<any[]> {
    try {
      const pacientesCifrados = await firstValueFrom(this.api.getPacientes());
      const listaLegible = await Promise.all(
        pacientesCifrados.map(async (p: any) => {
          return await this.obtenerPacienteLegible(p);
        })
      );
      return listaLegible;
    } catch (error) {
      console.error("Error al obtener la lista legible:", error);
      return [];
    }
  }

  async subirFoto(runP: string) {
    if (!this.file) {
      console.error('No hay archivo seleccionado');
      return;
    }
    try {
      const run = await this.desencriptarRun(runP);
      if (!run) {
        console.error('RUN inválido');
        return;
      }
      const res = await this.subirFotoUsuario(run, this.file);
      console.log('Foto subida:', res);
    } catch (error) {
      console.error('Error al subir foto:', error);
    }
  }

  users: any[] = []

  async crearUsuario(data: any): Promise<boolean> {
    try {
      const paciente = this.normalizarPaciente(data);
      if (!await this.validarTelefono(data.telefono)) {
        console.log(data.telefono);
        console.log("Teléfono inválido");
        return false;
      }
      try {
        const pacienteNuevo = await this.normalizarPaciente(data);
        const usuariosBD = await this.obtenerPacientesLegibles();
        const existe = usuariosBD.find((u: any) => u.runP === pacienteNuevo.runP);
        if (existe) {
          return false;
        }
        try {
          const nombreEncriptado = await firstValueFrom(this.CriptoService.getNombreEncriptado(paciente.correo));
          paciente.correo = nombreEncriptado;
          const passwordEncriptado = await firstValueFrom(this.CriptoService.getNombreEncriptado(paciente.password));
          paciente.password = passwordEncriptado;
          const RunEncriptado = await firstValueFrom(this.CriptoService.getNombreEncriptado(paciente.runP));
          paciente.runP = RunEncriptado;
          const cellEncriptado = await firstValueFrom(this.CriptoService.getNombreEncriptado(paciente.telefono));
          paciente.telefono = cellEncriptado;
        } catch (cryptoError) {
          console.error("Fallo crítico en el servicio de encriptación", cryptoError);
          return false;
        }
        await firstValueFrom(this.api.postPacientes(pacienteNuevo));
        const rundec = await this.desencriptarRun(paciente.runP);
        if (!rundec) {
          console.error("RUN inválido");
          return false;
        }
        const tiene = await this.CriptoService.tieneFotoPerfil(rundec)
        if (tiene) {
          this.foto = true
          this.subirFoto(rundec)
        } else {
          this.foto = false
        }
        return true;
      } catch (error) {
        console.error("Error en el proceso de creación:", error);
        return false;
      }
    } catch (error) {
      console.error("Error al crear usuario:", error);
      return false;
    }
  }

  async subirFotoUsuario(runP: string, foto: File): Promise<any> {
    try {
      const response = await firstValueFrom(this.CriptoService.subirFotoPerfil(runP, foto));
      return response;
    } catch (error) {
      console.error("Error al subir foto:", error);
      throw error;
    }
  }

  async subirDocumento(runp: string, documento: File) {
    try {
      const resp = await firstValueFrom(this.CriptoService.subirDocumento(runp, documento));
      return resp;
    } catch (error) {
      console.error("error al subir examen", error);
      throw error;
    }
  }

  async listarDocumentos(runp: string) {
    try {
      const resp = await firstValueFrom(this.CriptoService.listarDocumentos(runp));
      return resp;
    } catch (error) {
      console.error("error al subir examen", error);
      throw error;
    }
  }

  async Iniciar_sesion(run: string, password: string): Promise<any | null> {
    try {
      const pacientes = await firstValueFrom(this.api.getPacientes());
      const pacienteCifrado = pacientes.find((p: any) => {
        const runLimpio = (p.runP || '').replace(/[.\s-]/g, '').toLowerCase();
        const runInput = run.replace(/[.\s-]/g, '').toLowerCase();
        return runLimpio === runInput;
      });

      if (!pacienteCifrado) return null;

      const legible = await this.obtenerPacienteLegible(pacienteCifrado);
      if (legible.password !== password) return null;

      await this.auth.login(run, password, 'PACIENTE', pacienteCifrado.runP || '');
      return { dbId: pacienteCifrado.runP, display: legible };
    } catch (error) {
      console.error("Error en login:", error);
      return null;
    }
  }

  async desencriptarAJson(textoCifrado: string): Promise<any> {
    try {
      const textoLegible = await firstValueFrom(this.CriptoService.getNombreOriginal(textoCifrado));
      const objetoJson = JSON.parse(textoLegible);
      return objetoJson;
    } catch (error) {
      console.error("Error al procesar el JSON:", error);
      return null;
    }
  }

  async obtenerSesionProtegida(): Promise<any | null> {
    if (this.usuarioAutenticado) return this.usuarioAutenticado;
    const datosCifrados = localStorage.getItem("Usuario_Safe");
    if (datosCifrados) {
      try {
        const legibleString = await firstValueFrom(this.CriptoService.getNombreOriginal(datosCifrados));
        this.usuarioAutenticado = JSON.parse(legibleString);
        return this.usuarioAutenticado;
      } catch (e) {
        console.error("Error al recuperar sesión encriptada:", e);
        return null;
      }
    }
    return null;
  }

  async cargarUsuariosDesdeJSON(): Promise<boolean> {
    try {
      const data: any = await firstValueFrom(this.http.get('assets/usuarios.json'));
      await this.procesarUsuarios(data);
      console.log("Usuarios cargados correctamente");
      return true;
    } catch (error) {
      console.error("Error cargando JSON:", error);
      return false;
    }
  }

  private async procesarUsuarios(data: any) {
    if (Array.isArray(data)) {
      for (let item of data) {
        await this.crearUsuario(item);
      }
    } else if (data.pacientes) {
      for (let item of data.pacientes) {
        await this.crearUsuario(item);
      }
    } else if (data.pais) {
      for (let item of data.pacientes) {
      }
    } else {
      console.error("Formato de JSON no válido");
    }
  }

  getUsuario() {
    return this.usuarioAutenticado || JSON.parse(localStorage.getItem("Usuario") || "null");
  }

  logout() {
    this.usuarioAutenticado = null;
    localStorage.removeItem("Usuario");
  }

}
