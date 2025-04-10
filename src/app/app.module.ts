import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Firebase imports
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { environment } from '../environments/environment';

// Local modules
import { AppRoutingModule } from './app-routing.module';
import { HomeModule } from './components/home/home.module';
import { InvoiceCreatorModule } from './components/invoice-creator/invoice-creator.module';
import { InvoiceFormModule } from './components/invoice-form/invoice-form.module';
import { InvoiceTemplatesModule } from './components/invoice-templates/invoice-templates.module';
import { TemplateCreatorModule } from './components/template-creator/template-creator.module';
import { SharedModule } from './shared/shared.module';

// Services
import { InvoiceService } from './services/invoice.service';

// Components
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';

// Initialize Firebase
const app: FirebaseApp = initializeApp(environment.firebase);
const auth: Auth = getAuth(app);

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    SharedModule,
    InvoiceFormModule,
    InvoiceCreatorModule,
    InvoiceTemplatesModule,
    HomeModule,
    TemplateCreatorModule,
    MatMenuModule
  ],
  providers: [
    { provide: 'FIREBASE_APP', useValue: app },
    { provide: 'FIREBASE_AUTH', useValue: auth },
    InvoiceService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
