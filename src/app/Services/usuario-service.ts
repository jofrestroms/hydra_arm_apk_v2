import { Injectable } from '@angular/core';
import { ApiService } from './api';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Crypto } from './crypto';

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
    private CriptoService: Crypto
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
        this.CriptoService.getNombreOriginal(pacienteCifrado.correo),
        this.CriptoService.getNombreOriginal(pacienteCifrado.password),
        this.CriptoService.getNombreOriginal(pacienteCifrado.runP),
        this.CriptoService.getNombreOriginal(pacienteCifrado.telefono)
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
      const run = await this.CriptoService.getNombreOriginal(runCifrado);
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
          const nombreEncriptado = await this.CriptoService.getNombreEncriptado(paciente.correo);
          paciente.correo = nombreEncriptado;
          const passwordEncriptado = await this.CriptoService.getNombreEncriptado(paciente.password);
          paciente.password = passwordEncriptado;
          const RunEncriptado = await this.CriptoService.getNombreEncriptado(paciente.runP);
          paciente.runP = RunEncriptado;
          const cellEncriptado = await this.CriptoService.getNombreEncriptado(paciente.telefono);
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
      const response = await this.CriptoService.subirFotoPerfil(runP, foto);
      return response;
    } catch (error) {
      console.error("Error al subir foto:", error);
      throw error;
    }
  }

  async subirDocumento(runp: string, documento: File) {
    try {
      const resp = await this.CriptoService.subirDocumento(runp, documento);
      return resp;
    } catch (error) {
      console.error("error al subir examen", error);
      throw error;
    }
  }

  async listarDocumentos(runp: string) {
    try {
      const resp = await this.CriptoService.listarDocumentos(runp);
      return resp;
    } catch (error) {
      console.error("error al subir examen", error);
      throw error;
    }
  }

  async Iniciar_sesion(run: string, password: string): Promise<any | null> {
    try {
      const pacientes = await firstValueFrom(this.api.getPacientes());

      const runInput = run
        .replace(/[.\s-]/g, '')
        .toLowerCase();

      let pacienteCifrado: any = null;
      let legible: any = null;

      for (const paciente of pacientes) {
        try {
          const runPaciente = await this.desencriptarRun(paciente.runP);

          if (!runPaciente) {
            continue;
          }

          const runPacienteLimpio = runPaciente
            .replace(/[.\s-]/g, '')
            .toLowerCase();

          if (runPacienteLimpio === runInput) {
            pacienteCifrado = paciente;

            legible = await this.obtenerPacienteLegible(paciente);

            break;
          }
        } catch (error) {
          console.error('Error desencriptando RUN del paciente:', error);
        }
      }

      // No existe paciente
      if (!pacienteCifrado || !legible) {
        console.log('Paciente no encontrado');
        return null;
      }

      // Verificar contraseña
      if (legible.password !== password) {
        console.log('Contraseña incorrecta');
        return null;
      }

      return {
        dbId: pacienteCifrado.runP,
        display: legible
      };

    } catch (error) {
      console.error('Error en login:', error);
      return null;
    }
  }

  async Iniciar_sesion_familiar(run: string, password: string): Promise<any | null> {
    try {
      const familiares = await firstValueFrom(this.api.getFamiliares());

      const runInput = run
        .replace(/[.\s-]/g, '')
        .toLowerCase();

      for (const familiar of familiares) {
        try {
          const runFamiliar = await this.desencriptarRun(familiar.run);
          if (!runFamiliar) continue;

          const runFamiliarLimpio = runFamiliar
            .replace(/[.\s-]/g, '')
            .toLowerCase();

          if (runFamiliarLimpio !== runInput) continue;

          const passwordLegible = await this.CriptoService.getNombreOriginal(familiar.password);
          if (passwordLegible !== password) {
            console.log('Contraseña incorrecta para familiar');
            return null;
          }

          const pacientes = await firstValueFrom(this.api.getPacientesDeFamiliar(familiar.run));
          if (!pacientes || pacientes.length === 0) {
            console.log('Familiar sin pacientes asignados');
            return null;
          }

          return {
            familiar,
            pacientes
          };
        } catch (error) {
          console.error('Error desencriptando familiar:', error);
        }
      }

      console.log('Familiar no encontrado');
      return null;
    } catch (error) {
      console.error('Error en login de familiar:', error);
      return null;
    }
  }

  async desencriptarAJson(textoCifrado: string): Promise<any> {
    try {
      const textoLegible = await this.CriptoService.getNombreOriginal(textoCifrado);
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
        const legibleString = await this.CriptoService.getNombreOriginal(datosCifrados);
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
    localStorage.removeItem("hydra_sesion");
  }

  async obtenerUsuarioPorDbId(dbId: string): Promise<any | null> {
  try {
    const pacientes = await firstValueFrom(this.api.getPacientes());

    const pacienteCifrado = pacientes.find(
      (p: any) => p.runP === dbId
    );

    if (!pacienteCifrado) {
      console.error('No se encontró el paciente');
      return null;
    }

    // Desencriptar todo el objeto
    const pacienteLegible =
      await this.obtenerPacienteLegible(pacienteCifrado);

    return pacienteLegible;

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return null;
  }
}

}
