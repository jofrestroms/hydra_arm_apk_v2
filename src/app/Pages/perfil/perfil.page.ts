import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { ApiService } from '../../Services/api';
import { Crypto } from '../../Services/crypto';
import { UsuarioService } from '../../Services/usuario-service';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: false,
})
export class PerfilPage implements OnInit {

  rut!: string;
  Usuario: any[] = [];
  listaExamenes: any[] = [];
  listaExamenesOriginal: any[] = [];
  fechaFiltro: string = '';
  previewUrl: string = '';

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private api: ApiService,
    private usuarioService: UsuarioService,
    private router: Router,
    private Crypto: Crypto
  ) {}

  ngOnInit() {
    this.rut = history.state.rut;
    console.log("RUT Encriptado recibido:", this.rut);

    if (this.rut) {
      this.api.getPaciente(this.rut).subscribe(async (resp: any) => {
        console.log(resp);
        const data = typeof resp === 'string' ? JSON.parse(resp) : resp;
        const usuarioLegible = await this.usuarioService.obtenerPacienteLegible(data);
        this.Usuario = [usuarioLegible];
        this.cargarExamenes(usuarioLegible.runP);
        console.log("Datos del usuario listos y legibles:", this.Usuario);
        const runReal = await this.usuarioService.desencriptarRun(this.rut);
        await this.cargarFoto(runReal!);
      });
    }
  }

  async cargarExamenes(run: string) {
    try {
      const resp: any = await this.usuarioService.listarDocumentos(run);
      console.log("Respuesta del servidor:", resp);
      let dataTemporal = [];
      if (Array.isArray(resp) && resp.length > 0 && resp[0].documentos) {
        dataTemporal = resp[0].documentos;
      } else if (resp && resp.documentos) {
        dataTemporal = resp.documentos;
      } else {
        dataTemporal = [];
      }
      this.listaExamenesOriginal = dataTemporal;
      this.listaExamenes = [...dataTemporal];
      console.log("Lista lista para filtrar:", this.listaExamenes);
    } catch (error) {
      console.error("Error al obtener exámenes", error);
      this.listaExamenes = [];
      this.listaExamenesOriginal = [];
    }
  }

  filtrarPorFecha(event: any) {
    const fechaSeleccionada = event.detail.value.split('T')[0];
    this.fechaFiltro = fechaSeleccionada;
    if (fechaSeleccionada) {
      this.listaExamenes = this.listaExamenesOriginal.filter(doc =>
        doc.fechaCreacion && doc.fechaCreacion.includes(fechaSeleccionada)
      );
    }
  }

  limpiarFiltro() {
    this.fechaFiltro = '';
    this.listaExamenes = [...this.listaExamenesOriginal];
  }

  async cargarFoto(run: string) {
    const url = await this.Crypto.obtenerFotoPorRut(run);
    if (url) {
      this.previewUrl = url;
    }
  }

  volver() {
    this.navCtrl.back();
  }
}
