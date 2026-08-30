import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Crypto {

  private readonly API_URL = 'https://hydra-arm-security.onrender.com/api';

  constructor() {}

  private async get(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async getNombreEncriptado(nombre: string): Promise<string> {
    return this.get(`${this.API_URL}/user/cripto/encrypt?texto=${encodeURIComponent(nombre)}`);
  }

  async getNombreOriginal(codigo: string): Promise<string> {
    return this.get(`${this.API_URL}/user/cripto/decrypt?codigo=${encodeURIComponent(codigo)}`);
  }

  async encryptJson(texto: string): Promise<string> {
    const res = await fetch(`${this.API_URL}/user/cripto/encryptjson`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: texto
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async subirDocumento(runP: string, archivo: File): Promise<any> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    const res = await fetch(`${this.API_URL}/pacientes/${runP}/documentos`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }

  async listarDocumentos(runP: string): Promise<any> {
    const res = await fetch(`${this.API_URL}/pacientes/${runP}/documentos`);
    return res.json();
  }

  async subirFotoPerfil(runP: string, archivo: File): Promise<any> {
    const formData = new FormData();
    formData.append('imagen', archivo);
    const res = await fetch(`${this.API_URL}/pacientes/${runP}/perfil`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }

  async obtenerFotoPorRut(runP: string): Promise<string | null> {
    const res = await fetch(`${this.API_URL}/pacientes/${runP}/perfil`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  }

  async tieneFotoPerfil(runP: string): Promise<boolean> {
    const url = await this.obtenerFotoPorRut(runP);
    return url !== null;
  }

  async eliminarFotoPerfil(runP: string): Promise<any> {
    const res = await fetch(`${this.API_URL}/pacientes/${runP}/perfil`, {
      method: 'DELETE'
    });
    return res.json();
  }

  async subirFotoPerfilBase64(runP: string, nombreArchivo: string, contenido: string): Promise<any> {
    const res = await fetch(`${this.API_URL}/pacientes/${runP}/perfil/base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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