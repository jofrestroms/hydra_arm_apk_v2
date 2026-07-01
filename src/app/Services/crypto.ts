import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class Crypto {

  private readonly API_URL = 'https://api.hydra.cl/api/user/cripto';

  constructor(private auth: AuthService) {}

  private async get(url: string): Promise<string> {
    const token = await this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async getNombreEncriptado(nombre: string): Promise<string> {
    return this.get(`${this.API_URL}/encrypt?texto=${encodeURIComponent(nombre)}`);
  }

  async getNombreOriginal(codigo: string): Promise<string> {
    return this.get(`${this.API_URL}/decrypt?codigo=${encodeURIComponent(codigo)}`);
  }

  async encryptJson(texto: string): Promise<string> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`${this.API_URL}/encryptjson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: texto
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async subirDocumento(runP: string, archivo: File): Promise<any> {
    const token = await this.auth.getAccessToken();
    const formData = new FormData();
    formData.append('archivo', archivo);
    const res = await fetch(`https://api.hydra.cl/api/pacientes/${runP}/documentos`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    return res.json();
  }

  async listarDocumentos(runP: string): Promise<any> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`https://api.hydra.cl/api/pacientes/${runP}/documentos`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    return res.json();
  }

  async eliminarDocumento(runP: string, nombreArchivo: string): Promise<any> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`https://api.hydra.cl/api/pacientes/${runP}/documentos/${encodeURIComponent(nombreArchivo)}`, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    return res.json();
  }

  async subirFotoPerfil(runP: string, archivo: File): Promise<any> {
    const token = await this.auth.getAccessToken();
    const formData = new FormData();
    formData.append('imagen', archivo);
    const res = await fetch(`https://api.hydra.cl/api/pacientes/${runP}/perfil`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    return res.json();
  }

  async obtenerFotoPorRut(runP: string): Promise<string | null> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`https://api.hydra.cl/api/pacientes/${runP}/perfil`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  }

  async tieneFotoPerfil(runP: string): Promise<boolean> {
    const url = await this.obtenerFotoPorRut(runP);
    return url !== null;
  }

  async eliminarFotoPerfil(runP: string): Promise<any> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`https://api.hydra.cl/api/pacientes/${runP}/perfil`, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    return res.json();
  }

  async subirFotoPerfilBase64(runP: string, nombreArchivo: string, contenido: string): Promise<any> {
    const token = await this.auth.getAccessToken();
    const res = await fetch(`https://api.hydra.cl/api/pacientes/${runP}/perfil/base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ nombreArchivo, contenido })
    });
    return res.json();
  }

  private base64ToFile(base64: string, filename: string): File {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new File([ab], filename, { type: 'image/png' });
  }
}
