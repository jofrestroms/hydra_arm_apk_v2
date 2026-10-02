import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from '../../Services/api';
import { Crypto } from '../../Services/crypto';
import { RealtimeService } from '../../Services/realtime';

@Component({
  selector: 'app-chat-paciente',
  templateUrl: './chat-paciente.page.html',
  styleUrls: ['./chat-paciente.page.scss'],
  standalone: false
})
export class ChatPacientePage implements OnInit, OnDestroy {

  runPaciente = '';

  contactos: any[] = [];
  cargandoContactos = true;
  sinContactos = false;

  contactoActual: any = null;
  mensajes: any[] = [];
  mensajeTexto = '';
  enviando = false;
  private pollingTimer: any = null;

  /** Foto elegida por el usuario, pendiente de enviar con el próximo mensaje. */
  fotoAdjunta: File | null = null;
  fotoAdjuntaPreview = '';
  adjuntando = false;

  constructor(
    private api: ApiService,
    private cripto: Crypto,
    private realtime: RealtimeService,
    private router: Router,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    const sesion = localStorage.getItem('hydra_sesion');
    if (!sesion) { this.router.navigate(['/login']); return; }

    const s = JSON.parse(sesion);
    const runCifrado = s.dbId || '';

    if (!runCifrado) { this.sinContactos = true; this.cargandoContactos = false; return; }

    try {
      this.runPaciente = (await this.cripto.getNombreOriginal(runCifrado)) || '';
    } catch (e) {
      this.runPaciente = runCifrado;
    }

    this.realtime.conectar(['hello', 'mensajes']);
    this.suscribirEventos();
    await this.cargarContactos();
  }

  ngOnDestroy() {
    this.detenerPolling();
    this.realtime.desconectar();
    this.limpiarFotoAdjunta();
  }

  private hashRunCache: { [run: string]: string } = {};

  private async hashRun(run: string): Promise<string> {
    if (!run) return '';
    if (this.hashRunCache[run]) return this.hashRunCache[run];
    try {
      const h = await this.cripto.getHashRun(run);
      this.hashRunCache[run] = h;
      return h;
    } catch (e) {
      return '';
    }
  }

  private async suscribirEventos() {
    this.realtime.on('mensajes').subscribe(async (payload: any) => {
      const fila = payload?.new;
      if (!fila) return;
      if (!this.contactoActual) return;
      // El SSE reenvia la fila cruda de Postgres, asi que llega en snake_case.
      // remitente_run guarda el SHA-256 del RUN: nunca el valor en texto plano.
      const hashContacto = await this.hashRun(this.contactoActual.run);
      const hashPropio = await this.hashRun(this.runPaciente);
      if (fila.remitente_run !== hashContacto) return;
      if (fila.destinatario_run !== hashPropio) return;
      this.cargarConversacion();
    });
  }

  private async cargarContactos() {
    this.cargandoContactos = true;
    try {
      const empleados: any[] = await firstValueFrom(this.api.getEmpleados());
      const lista: any[] = [];

      for (const emp of empleados || []) {
        if (emp.rolIdRol !== 2 && emp.rolIdRol !== 4) continue;

        let run = '';
        try { run = (await this.cripto.getNombreOriginal(emp.run)) || ''; } catch (e) { continue; }
        if (!run) continue;

        lista.push({
          run,
          nombre: `${emp.nombre || ''} ${emp.apellidoPaterno || ''}`.trim(),
          rolIdRol: emp.rolIdRol,
          rolDestino: emp.rolIdRol === 2 ? 'medico' : 'cuidador',
          rolLabel: emp.rolIdRol === 2 ? 'Médico' : 'Cuidador'
        });
      }

      this.contactos = lista;
      this.sinContactos = lista.length === 0;
    } catch (e) {
      console.error('Error cargando contactos', e);
      this.sinContactos = true;
    } finally {
      this.cargandoContactos = false;
    }
  }

  abrirChat(contacto: any) {
    this.contactoActual = contacto;
    this.mensajes = [];
    this.limpiarFotoAdjunta();
    this.cargarConversacion();
    this.iniciarPolling();
  }

  async cargarConversacion() {
    if (!this.contactoActual || !this.runPaciente) return;
    try {
      const historial: any[] = await firstValueFrom(
        this.api.getConversacion(this.runPaciente, this.contactoActual.run)
      );
      this.mensajes = historial || [];
      await this.marcarLeidos();
    } catch (e) {
      console.error('Error cargando conversación', e);
    }
  }

  private async marcarLeidos() {
    for (const m of this.mensajes) {
      if (!m.leido && m.rolOrigen !== 'paciente') {
        try { await firstValueFrom(this.api.marcarLeido(m.id)); } catch (e) { }
      }
    }
  }

  // ── Foto adjunta ────────────────────────────────────────────

  async elegirFoto() {
    if (!this.contactoActual || this.adjuntando) return;
    const sheet = await this.actionSheetCtrl.create({
      header: 'Adjuntar foto',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera-outline',
          handler: () => { this.capturarFoto(CameraSource.Camera); }
        },
        {
          text: 'Elegir de la galería',
          icon: 'images-outline',
          handler: () => { this.capturarFoto(CameraSource.Photos); }
        },
        { text: 'Cancelar', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  private async capturarFoto(source: CameraSource) {
    this.adjuntando = true;
    try {
      const permisos = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      const camera = permisos.camera;
      const fotos = permisos.photos;
      if (source === CameraSource.Camera && camera !== 'granted') {
        this.mostrarToast('Debes permitir el acceso a la cámara', 'warning');
        return;
      }
      if (source === CameraSource.Photos && fotos !== 'granted') {
        this.mostrarToast('Debes permitir el acceso a la galería', 'warning');
        return;
      }

      const foto = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source
      });

      const nombreArchivo = `foto_${Date.now()}.jpg`;
      this.fotoAdjunta = this.cripto.base64ToFile(foto.dataUrl || '', nombreArchivo);
      this.fotoAdjuntaPreview = foto.dataUrl || '';
    } catch (e) {
      console.error('Error capturando foto', e);
      this.mostrarToast('No se pudo obtener la foto', 'warning');
    } finally {
      this.adjuntando = false;
    }
  }

  async quitarFoto() {
    const alert = await this.alertCtrl.create({
      header: 'Quitar foto',
      message: '¿Quieres descartar la foto adjunta?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Quitar', role: 'destructive', handler: () => this.limpiarFotoAdjunta() }
      ]
    });
    await alert.present();
  }

  private limpiarFotoAdjunta() {
    this.fotoAdjunta = null;
    this.fotoAdjuntaPreview = '';
  }

  private async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastCtrl.create({ message: mensaje, duration: 2200, color });
    await toast.present();
  }

  // ── Envío ───────────────────────────────────────────────────

  async enviarMensaje() {
    const texto = (this.mensajeTexto || '').trim();
    const foto = this.fotoAdjunta;
    if (!texto && !foto) return;
    if (!this.contactoActual || this.enviando) return;

    this.enviando = true;
    let adjuntoUrl: string | null = null;
    try {
      // Paso 1: subir la foto. La carpeta se deriva del hash de ambos RUN.
      if (foto) {
        const info = await this.cripto.subirAdjuntoMensaje(
          this.runPaciente, this.contactoActual.run, foto
        );
        adjuntoUrl = info.url;
      }

      // Paso 2: crear el mensaje. Si falla, borramos el adjunto huérfano.
      await firstValueFrom(this.api.enviarMensaje({
        remitenteRun: this.runPaciente,
        rolOrigen: 'paciente',
        destinatarioRun: this.contactoActual.run,
        rolDestino: this.contactoActual.rolDestino,
        contenido: texto || null,
        adjuntoUrl: adjuntoUrl,
        adjuntoNombre: foto ? foto.name : null
      }));

      this.mensajeTexto = '';
      this.limpiarFotoAdjunta();
      await this.cargarConversacion();
    } catch (e: any) {
      console.error('Error enviando mensaje', e);
      if (adjuntoUrl) {
        try { await this.cripto.eliminarAdjunto(adjuntoUrl); } catch (e2) { }
      }
      this.mostrarToast('No se pudo enviar el mensaje', 'danger');
    } finally {
      this.enviando = false;
    }
  }

  volver() {
    this.router.navigate(['/corazon']);
  }

  irPerfil() {
    this.router.navigate(['/perfil']);
  }

  cerrarSesion() {
    localStorage.removeItem('hydra_sesion');
    this.router.navigate(['/login']);
  }

  private iniciarPolling() {
    this.detenerPolling();
    this.pollingTimer = setInterval(() => {
      if (this.contactoActual) {
        this.cargarConversacion();
      }
    }, 5000);
  }

  private detenerPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}
