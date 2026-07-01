import { Injectable } from '@angular/core';
import { BluetoothLe } from '@capacitor-community/bluetooth-le';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Esp32Service {

  private macAddress: string = '';
  private ipAddress: string = '';
  private readonly PORT = 80;

  private readonly SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
  private readonly CHARACTERISTIC_UUID = 'abcdefab-1234-1234-1234-abcdefabcdef';

  bleConectado = false;
  wifiConectado = false;

  constructor(private http: HttpClient) {}

  setMac(mac: string) {
    this.macAddress = mac.trim().toLowerCase();
    localStorage.setItem('esp32_mac', this.macAddress);
  }

  setIp(ip: string) {
    this.ipAddress = ip.trim();
    localStorage.setItem('esp32_ip', this.ipAddress);
  }

  cargarCredenciales() {
    this.macAddress = localStorage.getItem('esp32_mac') || '';
    this.ipAddress  = localStorage.getItem('esp32_ip')  || '';
  }

  getMac() { return this.macAddress; }
  getIp()  { return this.ipAddress;  }

  async conectarBLEporMac(): Promise<boolean> {
    if (!this.macAddress) throw new Error('MAC no configurada');
    try {
      await BluetoothLe.initialize();
      await BluetoothLe.connect({ deviceId: this.macAddress });
      this.bleConectado = true;
      console.log('BLE conectado por MAC:', this.macAddress);
      return true;
    } catch (err) {
      console.error('Error BLE por MAC:', err);
      this.bleConectado = false;
      return false;
    }
  }

  async activarNotificaciones(
    callback: (bpm: number, sys: number, dia: number) => void
  ) {
    await BluetoothLe.startNotifications({
      deviceId: this.macAddress,
      service: this.SERVICE_UUID,
      characteristic: this.CHARACTERISTIC_UUID
    });

    await BluetoothLe.addListener('onNotification', (data: any) => {
      const value = new TextDecoder().decode(new Uint8Array(data.value));
      try {
        const json = JSON.parse(value);
        callback(json.bpm, json.sys ?? 120, json.dia ?? 80);
      } catch (e) {
        console.error('Parse BLE:', e);
      }
    });
  }

  async desconectarBLE() {
    try {
      await BluetoothLe.disconnect({ deviceId: this.macAddress });
      this.bleConectado = false;
    } catch (e) {
      console.error('Error desconectando BLE:', e);
    }
  }

  async verificarConexionWifi(): Promise<boolean> {
    if (!this.ipAddress) return false;
    try {
      const url = `http://${this.ipAddress}:${this.PORT}/ping`;
      const res = await firstValueFrom(
        this.http.get<any>(url, { headers: new HttpHeaders({ timeout: '3000' }) })
      );
      this.wifiConectado = !!res;
      return this.wifiConectado;
    } catch {
      this.wifiConectado = false;
      return false;
    }
  }

  async getDatosWifi(): Promise<{ bpm: number; sys: number; dia: number } | null> {
    try {
      const url = `http://${this.ipAddress}:${this.PORT}/datos`;
      return await firstValueFrom(this.http.get<any>(url));
    } catch {
      return null;
    }
  }

  async reconectar(): Promise<'ble' | 'wifi' | 'ninguna'> {
    console.log('Intentando reconexión...');
    const bleOk = await this.conectarBLEporMac();
    if (bleOk) return 'ble';
    const wifiOk = await this.verificarConexionWifi();
    if (wifiOk) return 'wifi';
    return 'ninguna';
  }
}
