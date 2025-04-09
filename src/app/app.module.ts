import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { environment } from '../environments/environment';

// Local modules
import { AppRoutingModule } from './app-routing.module';
import { HomeModule } from './components/home/home.module';
import { InvoiceCreatorModule } from './components/invoice-creator/invoice-creator.module';
import { InvoiceFormModule } from './components/invoice-form/invoice-form.module';
import { InvoiceTemplatesModule } from './components/invoice-templates/invoice-templates.module';
import { SharedModule } from './shared/shared.module';

// Services
import { InvoiceService } from './services/invoice.service';

// Components
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';

// Initialize Firebase
const app = initializeApp(environment.firebase);
const auth = getAuth(app);

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
    HomeModule
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
