import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./Pages/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'olvidar-contrasena',
    loadChildren: () => import('./Pages/olvidar-contrasena/olvidar-contrasena.module').then(m => m.OlvidarContrasenaPageModule)
  },
  {
    path: 'corazon',
    loadChildren: () => import('./Pages/corazon/corazon.module').then(m => m.CorazonPageModule)
  },
  {
    path: 'perfil',
    loadChildren: () => import('./Pages/perfil/perfil.module').then(m => m.PerfilPageModule)
  },
  {
    path: 'seleccionar-paciente',
    loadChildren: () => import('./Pages/seleccionar-paciente/seleccionar-paciente.module').then(m => m.SeleccionarPacientePageModule)
  },
  {
    path: 'dashboard-familiar',
    loadChildren: () => import('./Pages/dashboard-familiar/dashboard-familiar.module').then(m => m.DashboardFamiliarPageModule)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
