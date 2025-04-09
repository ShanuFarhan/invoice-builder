import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { InvoiceTemplatesComponent } from './invoice-templates.component';

@NgModule({
    declarations: [InvoiceTemplatesComponent],
    imports: [
        SharedModule
    ],
    exports: [InvoiceTemplatesComponent]
})
export class InvoiceTemplatesModule { } 