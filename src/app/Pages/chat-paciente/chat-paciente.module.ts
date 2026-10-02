import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ChatPacientePageRoutingModule } from './chat-paciente-routing.module';
import { ChatPacientePage } from './chat-paciente.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatPacientePageRoutingModule
  ],
  declarations: [ChatPacientePage]
})
export class ChatPacientePageModule {}