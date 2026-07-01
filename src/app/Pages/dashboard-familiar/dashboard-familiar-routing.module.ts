import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DashboardFamiliarPage } from './dashboard-familiar.page';

const routes: Routes = [
  { path: '', component: DashboardFamiliarPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardFamiliarPageRoutingModule {}
