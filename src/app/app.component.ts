import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { leerSesion, rutaInicial } from './auth.guard';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private router: Router) {
    this.restaurarSesion();
  }

  private restaurarSesion() {
    const destino = rutaInicial(leerSesion());
    if (!destino) return;
    setTimeout(() => this.router.navigateByUrl(destino), 0);
  }
}
