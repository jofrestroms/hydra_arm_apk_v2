import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { BluetoothLe } from '@capacitor-community/bluetooth-le';
import { Geolocation } from '@capacitor/geolocation';
import Chart from 'chart.js/auto';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { Esp32Service } from '../../Services/esp32';
import { UbicacionService } from '../../Services/ubicacion';
import { SupabaseService } from '../../Services/supabase';
import { UsuarioService } from '../../Services/usuario-service';
import { Crypto } from '../../Services/crypto';
import { BatteryService } from '../../Services/battery';

@Component({
  selector: 'app-corazon',
  templateUrl: './corazon.page.html',
  styleUrls: ['./corazon.page.scss'],
  standalone: false
})
export class CorazonPage implements OnInit, OnDestroy, AfterViewInit {

  
  
  connectionStatus = false;
  dispositivoConectado = 'Ninguno';
  datosRecibidos = 'Inicializando...';
  modoConexion: 'ble' | 'wifi' | 'simulacion' | 'realtime' | 'ninguna' = 'ninguna';
  
  bpmActual = '--';
  presionActual = '--/--';
  esNativo = Capacitor.isNativePlatform();
  bateriaActual = 0;
  bateriaLeida = false;
  cargandoDispositivo = false;
  latitudActual = -33.4489;
  longitudActual = -70.6693;
  
  macInput = '';
  ipInput = '';
  
  private readonly OFFLINE_SECRET_KEY = 'clave-local-ultra-segura-32bytes!';
  private cryptoKey: CryptoKey | null = null;
  
  dispositivosBLE: { deviceId: string; name: string; rssi?: number }[] = [];
  escaneando = false;
  
  private readonly SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
  private readonly CHARACTERISTIC_UUID = 'abcdefab-1234-1234-1234-abcdefabcdef';
  
  @ViewChild('heartChartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  heartChart!: Chart;
  bpmData: number[] = [];
  timestamps: string[] = [];
  
  private simulationInterval: any;
  private reconexionInterval: any;
  private gpsInterval: any;
  private listeners: PluginListenerHandle[] = [];
  private bpmSub?: Subscription;
  private bateriaSub?: () => void;
  runP = '';
  
  constructor(
    private router: Router,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private esp32: Esp32Service,
    private supabase: SupabaseService,
    private ubicacion: UbicacionService,
    private usuarioService: UsuarioService,
    private Crypto: Crypto,
    private battery: BatteryService
  ) { }
  
  previewUrl: string = '';

  async cargarFoto(run: string) {
    const url = await this.Crypto.obtenerFotoPorRut(run)
    if (url) {
      this.previewUrl = url;
    }
  }

  async ngOnInit() {
    console.log('CorazonPage iniciada');
    
    const sesion = localStorage.getItem('hydra_sesion');
    if (sesion) {
      const s = JSON.parse(sesion);
      this.runP = s.dbId || s.runP || '';
    } else {
      this.runP = localStorage.getItem('runP') || '';
    }

    await this.inicializarClave();
    this.esp32.cargarCredenciales();
    this.macInput = this.esp32.getMac();
    this.ipInput = this.esp32.getIp();
    await this.cargarBpmActual();
    this.iniciarBpmTiempoReal();
    this.iniciarBateriaDispositivo();
    void this.ubicacion.iniciar(this.runP);
    this.iniciarGPS();
  }

  ngAfterViewInit() {
    this.iniciarGrafico();
  }

  ngOnDestroy() {
    this.detenerSimulacionBLE();
    this.detenerReconexionAutomatica();
    this.limpiarListeners();
    this.bpmSub?.unsubscribe();
    this.bateriaSub?.();
    if (this.gpsInterval) clearInterval(this.gpsInterval);
  }

  private async iniciarGPS() {
    try {
      const pos = await Geolocation.getCurrentPosition();
      this.latitudActual = pos.coords.latitude;
      this.longitudActual = pos.coords.longitude;
    } catch {
      console.log('Usando GPS simulado (Santiago)');
    }
    this.gpsInterval = setInterval(async () => {
      try {
        const pos = await Geolocation.getCurrentPosition();
        this.latitudActual = pos.coords.latitude;
        this.longitudActual = pos.coords.longitude;
      } catch { }
    }, 30000);
  }

  async initializeBluetooth() {
    try {
      await BluetoothLe.initialize();
      console.log('Bluetooth inicializado');
    } catch (err) {
      console.error('Error inicializando Bluetooth', err);
    }
  }

  async escanearDispositivosBLE() {
    this.dispositivosBLE = [];
    this.escaneando = true;
    await BluetoothLe.initialize();
    await BluetoothLe.requestLEScan({ allowDuplicates: false });

    const listener = await BluetoothLe.addListener('onScanResult', (result: any) => {
      if (!result?.deviceId) return;
      const existe = this.dispositivosBLE.find(d => d.deviceId === result.deviceId);
      if (!existe) {
        this.dispositivosBLE.push({ deviceId: result.deviceId, name: result.name || result.localName || 'Dispositivo sin nombre', rssi: result.rssi });
      }
    });
    this.listeners.push(listener);

    setTimeout(async () => {
      await BluetoothLe.stopLEScan();
      this.escaneando = false;
      this.limpiarListeners();
      await this.mostrarModalDispositivos();
    }, 8000);
  }

  async mostrarModalDispositivos() {
    if (this.dispositivosBLE.length === 0) {
      await this.mostrarToast('No se encontraron dispositivos Bluetooth cercanos', 'warning');
      return;
    }
    const inputs = this.dispositivosBLE.map((d, index) => ({ type: 'radio' as const, label: `${d.name}\nID: ${d.deviceId}${d.rssi ? ' - RSSI: ' + d.rssi + ' dBm' : ''}`, value: d.deviceId, checked: index === 0 }));
    const alert = await this.alertCtrl.create({
      header: 'Dispositivos encontrados', subHeader: `${this.dispositivosBLE.length} dispositivo(s) cerca`, inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Conectar', handler: (deviceId: string) => { if (!deviceId) return false; const dispositivo = this.dispositivosBLE.find(d => d.deviceId === deviceId); if (dispositivo) this.conectarBLE(dispositivo.deviceId, dispositivo.name); return true; } }
      ], cssClass: 'ble-device-alert'
    });
    await alert.present();
  }

  async conectarBLE(deviceId: string, name: string) {
    try {
      await BluetoothLe.connect({ deviceId });
      this.connectionStatus = true;
      this.dispositivoConectado = name;
      this.modoConexion = 'ble';
      this.datosRecibidos = 'Conectado al ESP32';
      this.macInput = deviceId;
      this.esp32.setMac(deviceId);
      await this.mostrarToast(`Conectado a ${name}`, 'success');
      await this.recibirDatosBLE(deviceId);
    } catch (error) {
      console.error('Error conectando BLE', error);
      await this.mostrarToast('Error al conectar dispositivo', 'danger');
    }
  }

  async recibirDatosBLE(deviceId: string) {
    await BluetoothLe.startNotifications({ deviceId, service: this.SERVICE_UUID, characteristic: this.CHARACTERISTIC_UUID });
    const listener = await BluetoothLe.addListener('onNotification', (data: any) => {
      const bytes = new Uint8Array(data.value);
      const value = new TextDecoder().decode(bytes);
      try {
        const json = JSON.parse(value);
        this.procesarDatosBLE(json.bpm, json.sys ?? 120, json.dia ?? 80);
      } catch (e) { console.error('Error parseando BLE', e); }
    });
    this.listeners.push(listener);
  }

  async conectarConMac() {
    if (!this.macInput) { await this.mostrarToast('Ingresa la MAC del ESP32', 'warning'); return; }
    this.esp32.setMac(this.macInput);
    this.datosRecibidos = 'Conectando por BLE...';
    const ok = await this.esp32.conectarBLEporMac();
    if (ok) {
      this.connectionStatus = true;
      this.dispositivoConectado = `ESP32 (${this.macInput})`;
      this.modoConexion = 'ble';
      this.datosRecibidos = 'Conectado por BLE';
      await this.mostrarToast('Conectado por BLE', 'success');
      await this.esp32.activarNotificaciones((bpm, sys, dia) => { this.procesarDatosBLE(bpm, sys, dia); });
    } else {
      await this.mostrarToast('BLE fallo, intentando WiFi...', 'warning');
      await this.conectarConIp();
    }
  }

  async conectarConIp() {
    if (!this.ipInput) { await this.mostrarToast('Ingresa la IP del ESP32', 'warning'); return; }
    this.esp32.setIp(this.ipInput);
    this.datosRecibidos = 'Verificando conexion WiFi...';
    const ok = await this.esp32.verificarConexionWifi();
    if (ok) {
      this.connectionStatus = true;
      this.dispositivoConectado = `ESP32 WiFi (${this.ipInput})`;
      this.modoConexion = 'wifi';
      this.datosRecibidos = 'Conectado por WiFi';
      await this.mostrarToast('Conectado por WiFi', 'success');
      this.iniciarPollingWifi();
    } else {
      this.connectionStatus = false;
      this.modoConexion = 'ninguna';
      this.datosRecibidos = 'Sin conexion';
      await this.mostrarToast('No se pudo conectar al ESP32', 'danger');
      this.iniciarReconexionAutomatica();
    }
  }

  private iniciarPollingWifi() {
    this.detenerReconexionAutomatica();
    this.reconexionInterval = setInterval(async () => {
      const datos = await this.esp32.getDatosWifi();
      if (datos) {
        this.procesarDatosBLE(datos.bpm, datos.sys, datos.dia);
      } else {
        await this.mostrarToast('WiFi perdido, reconectando...', 'warning');
        this.connectionStatus = false;
        this.modoConexion = 'ninguna';
        this.datosRecibidos = 'Reconectando...';
        this.iniciarReconexionAutomatica();
      }
    }, 2000);
  }

  async iniciarReconexionAutomatica() {
    this.detenerReconexionAutomatica();
    this.datosRecibidos = 'Reconectando...';
    this.reconexionInterval = setInterval(async () => {
      const resultado = await this.esp32.reconectar();
      if (resultado === 'ble') {
        this.clearReconexionInterval();
        this.connectionStatus = true;
        this.modoConexion = 'ble';
        this.dispositivoConectado = `ESP32 BLE (${this.esp32.getMac()})`;
        this.datosRecibidos = 'Reconectado por BLE';
        await this.mostrarToast('Reconectado por BLE', 'success');
        await this.esp32.activarNotificaciones((bpm, sys, dia) => { this.procesarDatosBLE(bpm, sys, dia); });
      } else if (resultado === 'wifi') {
        this.clearReconexionInterval();
        this.connectionStatus = true;
        this.modoConexion = 'wifi';
        this.dispositivoConectado = `ESP32 WiFi (${this.esp32.getIp()})`;
        this.datosRecibidos = 'Reconectado por WiFi';
        await this.mostrarToast('Reconectado por WiFi', 'success');
        this.iniciarPollingWifi();
      } else {
        this.datosRecibidos = 'Sin senal, reintentando...';
      }
    }, 5000);
  }

  detenerReconexionAutomatica() {
    this.clearReconexionInterval();
    this.connectionStatus = false;
    this.modoConexion = 'ninguna';
    this.dispositivoConectado = 'Ninguno';
    this.datosRecibidos = 'Desconectado';
    this.bpmActual = '--';
    this.presionActual = '--/--';
  }

  private clearReconexionInterval() {
    if (this.reconexionInterval) { clearInterval(this.reconexionInterval); this.reconexionInterval = null; }
  }

  private async inicializarClave(): Promise<void> {
    try {
      const keyBytes = new TextEncoder().encode(this.OFFLINE_SECRET_KEY.padEnd(32, '0').slice(0, 32));
      this.cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    } catch (e) { console.error('Error inicializando clave:', e); }
  }

  private async encrypt(data: any): Promise<string> {
    if (!this.cryptoKey) await this.inicializarClave();
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.cryptoKey!, encoded);
    const combined = new Uint8Array(iv.byteLength + cifrado.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cifrado), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  }

  private async decrypt(cipher: string): Promise<any> {
    if (!this.cryptoKey) await this.inicializarClave();
    const combined = Uint8Array.from(atob(cipher), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const datos = combined.slice(12);
    const descifrado = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.cryptoKey!, datos);
    return JSON.parse(new TextDecoder().decode(descifrado));
  }

  private iniciarBpmTiempoReal(): void {
    if (!this.runP) return;
    this.datosRecibidos = 'Conectando al monitor...';
    this.bpmSub = this.supabase.verBpm(this.runP).subscribe({
      next: (fila: any) => {
        if (fila.paciente_run_p && fila.paciente_run_p !== this.runP) return;
        this.procesarDatosRealtime(fila, true);
      },
      error: (e) => {
        console.error('Error en el canal BPM', e);
        this.connectionStatus = false;
        this.datosRecibidos = 'Sin conexion en tiempo real';
      }
    });
  }

  private iniciarBateriaDispositivo(): void {
    if (!this.esNativo) return;

    this.bateriaSub = this.battery.suscribir((estado) => {
      if (!estado) {
        this.bateriaLeida = false;
        return;
      }
      this.bateriaActual = estado.nivel;
      this.cargandoDispositivo = estado.cargando;
      this.bateriaLeida = true;
    });
  }

  private async cargarBpmActual(): Promise<void> {
    try {
      const fila = await this.supabase.getBpmActual(this.runP);
      if (fila) this.procesarDatosRealtime(fila, false);
    } catch (e) {
      console.warn('No se pudo cargar el BPM actual', e);
    }
  }

  private procesarDatosRealtime(fila: any, enVivo = true): void {
    const bpm = fila.valor_bpm;
    if (bpm == null) return;

    const fechaMs = fila.fecha ? new Date(fila.fecha).getTime() : 0;
    const reciente = fechaMs > 0 && (Date.now() - fechaMs) < 15000;
    this.connectionStatus = enVivo || reciente;
    this.modoConexion = 'realtime';
    this.dispositivoConectado = 'Monitor Hydra (ESP32)';
    this.bpmActual = String(bpm);
    // Por pedido del usuario, el valor de SpO2 se muestra en la tarjeta de presión arterial.
    if (fila.spo2 != null) this.presionActual = String(fila.spo2);
    if (fila.latitud != null) this.latitudActual = fila.latitud;
    if (fila.longitud != null) this.longitudActual = fila.longitud;

    if (enVivo) {
      const bateriaTxt = this.esNativo && this.bateriaLeida ? ` | Bat: ${this.bateriaActual}%` : '';
      this.datosRecibidos = `BPM: ${bpm} | SpO2: ${fila.spo2 ?? '--'}${bateriaTxt}`;
    } else {
      const hora = fila.fecha ? new Date(fila.fecha).toLocaleTimeString() : 'sin fecha';
      this.datosRecibidos = `Ultimo dato: BPM ${bpm} | SpO2: ${fila.spo2 ?? '--'} (${hora})`;
    }

    this.actualizarGrafico(bpm);
  }

  private async procesarDatosBLE(bpm: number, sys: number, dia: number) {
    this.bpmActual = bpm.toString();
    this.presionActual = `${sys}/${dia}`;
    const bateriaTxt = this.esNativo && this.bateriaLeida ? ` | Bat: ${this.bateriaActual}%` : '';
    this.datosRecibidos = `BPM: ${bpm} | ${sys}/${dia}${bateriaTxt}`;
    this.actualizarGrafico(bpm);
  }

  private iniciarGrafico() {
    const ctx = this.chartCanvas?.nativeElement.getContext('2d');
    if (!ctx) return;
    this.heartChart = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'BPM', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', borderWidth: 2, tension: 0.4, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, scales: { y: { min: 40, max: 180 } } }
    });
  }

  private actualizarGrafico(bpm: number) {
    if (!this.heartChart) return;
    this.bpmData.push(bpm);
    this.timestamps.push(new Date().toLocaleTimeString());
    if (this.bpmData.length > 30) { this.bpmData.shift(); this.timestamps.shift(); }
    this.heartChart.data.labels = this.timestamps;
    this.heartChart.data.datasets[0].data = this.bpmData;
    this.heartChart.update();
  }

  iniciarSimulacionBLE() {
    this.connectionStatus = true;
    this.modoConexion = 'simulacion';
    this.dispositivoConectado = 'Sensor BLE Simulado';
    this.datosRecibidos = 'Simulacion BLE activa';
    this.simulationInterval = setInterval(() => {
      const bpm = Math.round(65 + Math.random() * 25);
      const sys = Math.round(110 + Math.random() * 15);
      const dia = Math.round(70 + Math.random() * 10);
      this.procesarDatosBLE(bpm, sys, dia);
    }, 1500);
  }

  detenerSimulacionBLE() {
    if (this.simulationInterval) { clearInterval(this.simulationInterval); this.simulationInterval = null; }
    this.connectionStatus = false;
    this.modoConexion = 'ninguna';
    this.dispositivoConectado = 'Ninguno';
    this.datosRecibidos = 'Simulacion detenida';
    this.bpmActual = '--';
    this.presionActual = '--/--';
  }

  private limpiarListeners() { this.listeners.forEach(l => { try { l.remove(); } catch { } }); this.listeners = []; }

  async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastCtrl.create({ message: mensaje, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }

  irChat() {
    this.router.navigate(['/chat-paciente']);
  }

  async irPerfil() {
  const sesion = localStorage.getItem('hydra_sesion');

  if (!sesion) {
    this.router.navigate(['/login']);
    return;
  }

  try {
    const datosSesion = JSON.parse(sesion);

    if (!datosSesion?.dbId) {
      this.router.navigate(['/login']);
      return;
    }

    const usuario = await this.usuarioService.obtenerUsuarioPorDbId(
      datosSesion.dbId
    );

    if (!usuario) {
      this.router.navigate(['/login']);
      return;
    }

    console.log('Usuario encontrado:', usuario);

    this.router.navigate(['/perfil'], {
      state: {
        usuario: usuario
      }
    });

  } catch (error) {
    console.error('Error cargando usuario:', error);
    this.router.navigate(['/login']);
  }
}

  volver() { this.navCtrl.back(); }
}
