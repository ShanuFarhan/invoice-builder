import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { InvoiceCreatorComponent } from './components/invoice-creator/invoice-creator.component';
import { InvoiceFormComponent } from './components/invoice-form/invoice-form.component';
import { InvoiceTemplatesComponent } from './components/invoice-templates/invoice-templates.component';
import { LoginComponent } from './components/login/login.component';
import { TemplateCreatorComponent } from './components/template-creator/template-creator.component';
import { AuthGuard } from './guards/auth.guard';
import { NonAuthGuard } from './guards/non-auth.guard';

const routes: Routes = [
  // Public routes
  {
    path: 'login',
    component: LoginComponent,
    // Don't allow authenticated users to access login page
    canActivate: [NonAuthGuard]
  },

  // Protected routes
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'invoice',
    component: InvoiceFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'templates',
    component: InvoiceTemplatesComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'create',
    component: InvoiceCreatorComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'template/create',
    component: TemplateCreatorComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'template/edit/:id',
    component: TemplateCreatorComponent,
    canActivate: [AuthGuard]
  },

  // Default routes
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
