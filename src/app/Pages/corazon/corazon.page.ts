import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { BluetoothLe } from '@capacitor-community/bluetooth-le';
import { Geolocation } from '@capacitor/geolocation';
import Chart from 'chart.js/auto';
import { PluginListenerHandle } from '@capacitor/core';
import { Router } from '@angular/router';
import { ApiService } from '../../Services/api';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { Esp32Service } from '../../Services/esp32';
import { UsuarioService } from '../../Services/usuario-service';

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
  modoConexion: 'ble' | 'wifi' | 'simulacion' | 'ninguna' = 'ninguna';

  bpmActual = '--';
  presionActual = '--/--';
  bateriaActual = 100;
  latitudActual = -33.4489;
  longitudActual = -70.6693;

  macInput = '';
  ipInput = '';

  private jwtToken = '';
  private readonly OFFLINE_SECRET_KEY = 'clave-local-ultra-segura-32bytes!';
  private offlineQueue: string[] = [];
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
  runP = '';

  constructor(
    private api: ApiService,
    private router: Router,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private esp32: Esp32Service,
    private usuarioService: UsuarioService
  ) {}

  async ngOnInit() {
    console.log('CorazonPage iniciada');

    const sesion = localStorage.getItem('hydra_sesion');
    if (sesion) {
      const s = JSON.parse(sesion);
      this.runP = s.dbId || s.runP || '';
    } else {
      this.runP = localStorage.getItem('runP') || '';
    }

    this.jwtToken = 'JWT_SIMULADO_SPRING_BOOT';
    await this.inicializarClave();
    this.esp32.cargarCredenciales();
    this.macInput = this.esp32.getMac();
    this.ipInput = this.esp32.getIp();
    await this.initializeBluetooth();
    if (this.macInput) {
      await this.conectarConMac();
    }
    this.iniciarGPS();
  }

  ngAfterViewInit() {
    this.iniciarGrafico();
  }

  ngOnDestroy() {
    this.detenerSimulacionBLE();
    this.detenerReconexionAutomatica();
    this.limpiarListeners();
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
      } catch {}
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
    const inputs = this.dispositivosBLE.map((d, index) => ({ type: 'radio', label: `${d.name}\nID: ${d.deviceId}${d.rssi ? ' - RSSI: ' + d.rssi + ' dBm' : ''}`, value: d.deviceId, checked: index === 0 }));
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
        this.procesarDatosBLE(json.bpm, json.sys ?? 120, json.dia ?? 80, json.battery);
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
      await this.esp32.activarNotificaciones((bpm, sys, dia) => { this.procesarDatosBLE(bpm, sys, dia, this.bateriaActual); });
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
        this.procesarDatosBLE(datos.bpm, datos.sys, datos.dia, this.bateriaActual);
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
        await this.esp32.activarNotificaciones((bpm, sys, dia) => { this.procesarDatosBLE(bpm, sys, dia, this.bateriaActual); });
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

  private async guardarOffline(payload: any) {
    try { const cifrado = await this.encrypt(payload); this.offlineQueue.push(cifrado); } catch (e) { console.error('Error guardando offline:', e); }
  }

  private async reenviarOffline() {
    if (this.offlineQueue.length === 0) return;
    for (const item of this.offlineQueue) {
      try { const payload = await this.decrypt(item); await this.enviarSpringBoot(payload); } catch (e) { console.error('Error reenviando offline:', e); }
    }
    this.offlineQueue = [];
  }

  private async enviarSpringBoot(payload: any): Promise<boolean> {
    if (!this.runP) return false;
    try {
      const body = { runP: this.runP, valorBpm: payload.bpm, bateria: payload.bateria, latitud: payload.latitud, longitud: payload.longitud, fecha: new Date().toISOString() };
      await this.api.postBpm(body).toPromise();
      return true;
    } catch (err) { console.error('Error enviando BPM a API:', err); return false; }
  }

  private async procesarDatosBLE(bpm: number, sys: number, dia: number, battery?: number) {
    if (battery !== undefined) this.bateriaActual = battery;
    const payload = { bpm, systolic: sys, diastolic: dia, bateria: this.bateriaActual, latitud: this.latitudActual, longitud: this.longitudActual, device: this.dispositivoConectado, timestamp: new Date().toISOString() };
    this.bpmActual = bpm.toString();
    this.presionActual = `${sys}/${dia}`;
    this.datosRecibidos = `BPM: ${bpm} | ${sys}/${dia} | Bat: ${this.bateriaActual}%`;
    this.actualizarGrafico(bpm);
    try { const enviado = await this.enviarSpringBoot(payload); if (!enviado) await this.guardarOffline(payload); else await this.reenviarOffline(); } catch { await this.guardarOffline(payload); }
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
    this.bateriaActual = 100;
    this.simulationInterval = setInterval(() => {
      const bpm = Math.round(65 + Math.random() * 25);
      const sys = Math.round(110 + Math.random() * 15);
      const dia = Math.round(70 + Math.random() * 10);
      if (this.bateriaActual > 0) this.bateriaActual = Math.max(0, this.bateriaActual - 0.5);
      this.procesarDatosBLE(bpm, sys, dia, Math.round(this.bateriaActual));
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

  private limpiarListeners() { this.listeners.forEach(l => { try { l.remove(); } catch {} }); this.listeners = []; }

  async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastCtrl.create({ message: mensaje, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }

  async irPerfil() {
    const u = localStorage.getItem("Usuario_Safe");
    if (u) {
      const uD = await this.usuarioService.desencriptarAJson(u);
      if (uD && uD.runP) { this.router.navigate(['/perfil'], { state: { rut: uD.runP } }); return; }
    }
    this.router.navigate(['/login']);
  }

  volver() { this.navCtrl.back(); }
}
