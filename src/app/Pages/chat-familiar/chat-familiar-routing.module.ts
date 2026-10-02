import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ChatFamiliarPage } from './chat-familiar.page';

const routes: Routes = [
  { path: '', component: ChatFamiliarPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChatFamiliarPageRoutingModule {}