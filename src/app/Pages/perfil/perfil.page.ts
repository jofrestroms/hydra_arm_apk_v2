import { Component, OnInit } from '@angular/core';
import { ActionSheetController, NavController, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { UsuarioService } from '../../Services/usuario-service';
import { Crypto } from '../../Services/crypto';

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
  subiendoFoto = false;

  constructor(
    private navCtrl: NavController,
    private usuarioService: UsuarioService,
    private Crypto: Crypto,
    private actionSheetCtrl: ActionSheetController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    try {
      const usuario = history.state.usuario;

      if (!usuario) {
        console.error('No se recibió información del usuario');
        this.navCtrl.back();
        return;
      }
      this.Usuario = [usuario];
      this.rut = usuario.runP;
      // Cargar documentos
      await this.cargarExamenes(usuario.runP);
      // Cargar foto
      await this.cargarFoto(usuario.runP);

    } catch (error) {
      console.error('Error cargando perfil:', error);
    }
  }

  async cargarExamenes(run: string) {
    try {
      const resp: any =
        await this.usuarioService.listarDocumentos(run);

      console.log('Respuesta del servidor:', resp);

      let dataTemporal: any[] = [];

      if (
        Array.isArray(resp) &&
        resp.length > 0 &&
        resp[0].documentos
      ) {
        dataTemporal = resp[0].documentos;

      } else if (resp && resp.documentos) {
        dataTemporal = resp.documentos;
      }

      this.listaExamenesOriginal = dataTemporal;
      this.listaExamenes = [...dataTemporal];

    } catch (error) {
      console.error('Error al obtener exámenes', error);
      this.listaExamenes = [];
      this.listaExamenesOriginal = [];
    }
  }

  filtrarPorFecha(event: any) {
    const fechaSeleccionada =
      event.detail.value.split('T')[0];

    this.fechaFiltro = fechaSeleccionada;

    if (fechaSeleccionada) {
      this.listaExamenes =
        this.listaExamenesOriginal.filter(doc =>
          doc.fechaCreacion &&
          doc.fechaCreacion.includes(fechaSeleccionada)
        );
    }
  }

  limpiarFiltro() {
    this.fechaFiltro = '';
    this.listaExamenes =
      [...this.listaExamenesOriginal];
  }

  async cargarFoto(run: string) {
    const url =
      await this.Crypto.obtenerFotoPorRut(run);

    if (url) {
      this.previewUrl = url;
    }
  }

  async cambiarFoto() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Foto de perfil',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera-outline',
          handler: () => this.capturarFoto(CameraSource.Camera)
        },
        {
          text: 'Elegir de la galería',
          icon: 'images-outline',
          handler: () => this.capturarFoto(CameraSource.Photos)
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async capturarFoto(source: CameraSource) {
    try {
      const permisos = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      if (permisos.camera === 'denied' || permisos.photos === 'denied') {
        await this.mostrarToast('Debes permitir el acceso a la cámara/galería', 'warning');
        return;
      }

      const foto = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source
      });

      if (!foto.dataUrl) {
        await this.mostrarToast('No se pudo obtener la imagen', 'danger');
        return;
      }

      this.previewUrl = foto.dataUrl;
      const nombreArchivo = `perfil_${Date.now()}.jpg`;
      await this.subirNuevaFoto(foto.dataUrl, nombreArchivo);

    } catch (error) {
      console.error('Error capturando foto:', error);
      if ((error as any)?.message !== 'User cancelled photos app') {
        await this.mostrarToast('Error al seleccionar la foto', 'danger');
      }
    }
  }

  async subirNuevaFoto(dataUrl: string, nombreArchivo: string) {
    this.subiendoFoto = true;
    try {
      const resp: any =
        await this.Crypto.subirFotoPerfilBase64(this.rut, nombreArchivo, dataUrl);

      if (resp && resp.url) {
        this.previewUrl = resp.url;
        await this.mostrarToast('Foto de perfil actualizada', 'success');
      } else {
        await this.mostrarToast('No se pudo guardar la foto', 'danger');
      }
    } catch (error) {
      console.error('Error subiendo foto:', error);
      await this.mostrarToast('Error al subir la foto', 'danger');
    } finally {
      this.subiendoFoto = false;
    }
  }

  async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastCtrl.create({ message: mensaje, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }

  volver() {
    this.navCtrl.back();
  }
}