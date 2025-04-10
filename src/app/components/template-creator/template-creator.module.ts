import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SharedModule } from '../../shared/shared.module';
import { TemplateCreatorComponent } from './template-creator.component';

@NgModule({
  declarations: [
    TemplateCreatorComponent
  ],
  imports: [
    SharedModule,
    MatExpansionModule,
    MatSlideToggleModule
  ],
  exports: [
    TemplateCreatorComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class TemplateCreatorModule { }
