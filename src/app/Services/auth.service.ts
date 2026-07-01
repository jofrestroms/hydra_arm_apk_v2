import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly AUTH_URL = 'https://api.hydra.cl/api/auth';

  constructor(private http: HttpClient) {}

  async login(email: string, password: string, rol: string = 'PACIENTE', runP: string = ''): Promise<any> {
    const res = await firstValueFrom(
      this.http.post<any>(`${this.AUTH_URL}/login`, { email, password, rol, runP })
    );
    await this.saveTokens(res.accessToken, res.refreshToken);
    return res;
  }

  async refresh(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${this.AUTH_URL}/refresh`, { refreshToken })
      );
      await this.saveTokens(res.accessToken, res.refreshToken);
      return true;
    } catch {
      await this.clearTokens();
      return false;
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'hydra_token' });
      return value;
    }
    return localStorage.getItem('hydra_token');
  }

  async getRefreshToken(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'hydra_refresh' });
      return value;
    }
    return localStorage.getItem('hydra_refresh');
  }

  private async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: 'hydra_token', value: accessToken });
      await Preferences.set({ key: 'hydra_refresh', value: refreshToken });
    } else {
      localStorage.setItem('hydra_token', accessToken);
      localStorage.setItem('hydra_refresh', refreshToken);
    }
  }

  async clearTokens(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: 'hydra_token' });
      await Preferences.remove({ key: 'hydra_refresh' });
    } else {
      localStorage.removeItem('hydra_token');
      localStorage.removeItem('hydra_refresh');
      localStorage.removeItem('hydra_sesion');
    }
  }

  async logout(): Promise<void> {
    await this.clearTokens();
  }
}
