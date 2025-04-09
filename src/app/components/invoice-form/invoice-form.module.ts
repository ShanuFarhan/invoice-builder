import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { InvoiceFormComponent } from './invoice-form.component';

@NgModule({
    declarations: [InvoiceFormComponent],
    imports: [
        SharedModule
    ],
    exports: [InvoiceFormComponent]
})
export class InvoiceFormModule { } 