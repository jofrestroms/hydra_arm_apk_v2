import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ChatFamiliarPageRoutingModule } from './chat-familiar-routing.module';
import { ChatFamiliarPage } from './chat-familiar.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatFamiliarPageRoutingModule
  ],
  declarations: [ChatFamiliarPage]
})
export class ChatFamiliarPageModule {}