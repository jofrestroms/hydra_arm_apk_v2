import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { PlataformService } from './plataform.service';

@Injectable({ providedIn: 'root' })
export class PlatformGuard implements CanActivate {
  constructor(private platformService: PlataformService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const allowed = route.data['allowed'] as Array<string>;
    const current = this.platformService.getPlataform();

    if (allowed.includes(current)) {
      return true;
    }
    this.router.navigate(['/login']);
    return false;
  }
}
