import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ChatPacientePage } from './chat-paciente.page';

const routes: Routes = [
  { path: '', component: ChatPacientePage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChatPacientePageRoutingModule {}