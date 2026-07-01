import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class PlataformService {

  constructor(private platform: Platform) { }

  isElectron(): boolean {
    return !!(window as any).electronAPI;
  }

  isMobileApp(): boolean {
    return this.platform.is('capacitor');
  }

  getPlataform(): 'electron' | 'mobile' | 'web' | 'tablet' {
    if (this.isElectron()) {
      return 'electron';
    }
    if (this.platform.is('tablet')) {
      return 'tablet';
    }
    if (this.isMobileApp()) {
      return 'mobile';
    }
    if (this.platform.is('tablet')){
      return 'tablet'
    }
    return 'web'
  }

}
