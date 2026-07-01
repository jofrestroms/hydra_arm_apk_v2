import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DashboardFamiliarPageRoutingModule } from './dashboard-familiar-routing.module';
import { DashboardFamiliarPage } from './dashboard-familiar.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DashboardFamiliarPageRoutingModule
  ],
  declarations: [DashboardFamiliarPage]
})
export class DashboardFamiliarPageModule {}
