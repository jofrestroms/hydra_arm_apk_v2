import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export function leerSesion(): any | null {
  try {
    const raw = localStorage.getItem('hydra_sesion');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function rutaInicial(sesion: any): string | null {
  if (!sesion) return null;
  if (sesion.tipo === 'paciente' && sesion.dbId) return '/corazon';
  if (sesion.tipo === 'familiar' && sesion.runFamiliar) {
    return sesion.runPaciente ? '/dashboard-familiar' : '/seleccionar-paciente';
  }
  return null;
}

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return leerSesion() ? true : router.parseUrl('/login');
};
