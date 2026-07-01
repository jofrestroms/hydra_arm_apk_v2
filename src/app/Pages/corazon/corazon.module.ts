import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CorazonPageRoutingModule } from './corazon-routing.module';
import { CorazonPage } from './corazon.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CorazonPageRoutingModule
  ],
  declarations: [CorazonPage]
})
export class CorazonPageModule {}
