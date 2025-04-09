import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { InvoiceCreatorComponent } from './invoice-creator.component';

@NgModule({
    declarations: [InvoiceCreatorComponent],
    imports: [
        SharedModule
    ],
    exports: [InvoiceCreatorComponent]
})
export class InvoiceCreatorModule { } 