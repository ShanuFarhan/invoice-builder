import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { InvoiceCreatorComponent } from './components/invoice-creator/invoice-creator.component';
import { InvoiceFormComponent } from './components/invoice-form/invoice-form.component';
import { InvoiceTemplatesComponent } from './components/invoice-templates/invoice-templates.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'templates', component: InvoiceTemplatesComponent },
  { path: 'create', component: InvoiceCreatorComponent },
  { path: 'form', component: InvoiceFormComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
