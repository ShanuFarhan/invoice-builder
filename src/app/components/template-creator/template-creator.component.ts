import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomTemplate, InvoiceService } from '../../services/invoice.service';

@Component({
  selector: 'app-template-creator',
  templateUrl: './template-creator.component.html',
  styleUrls: ['./template-creator.component.scss']
})
export class TemplateCreatorComponent implements OnInit, AfterViewInit {
  templateForm: FormGroup;
  templateId: string | null = null;
  isEditMode = false;
  currentTemplate: CustomTemplate | null = null;
  previewMode: 'desktop' | 'mobile' = 'desktop';
  @ViewChild('templatePreview') templatePreview: ElementRef;

  // Element settings that can be dragged/positioned
  elementSettings = {
    header: { visible: true, position: 'top' },
    logo: { visible: true, size: 'medium' },
    companyInfo: { visible: true, alignment: 'left' },
    clientInfo: { visible: true, alignment: 'right' },
    invoiceDetails: { visible: true, style: 'standard' },
    itemsTable: { visible: true, style: 'standard' },
    totalSection: { visible: true, alignment: 'right' },
    notes: { visible: true, position: 'bottom' },
    footer: { visible: true, content: 'Thank you for your business!' }
  };

  // Available layouts
  availableLayouts = [
    { value: 'classic', label: 'Classic' },
    { value: 'modern', label: 'Modern' },
    { value: 'creative', label: 'Creative' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'custom', label: 'Fully Custom' }
  ];

  // Available fonts
  availableFonts = [
    { value: 'Roboto, sans-serif', label: 'Roboto (Default)' },
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Helvetica, sans-serif', label: 'Helvetica' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Courier New, monospace', label: 'Courier New' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'Tahoma, sans-serif', label: 'Tahoma' }
  ];

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.templateForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      layout: ['classic', Validators.required],
      headerColor: ['#3f51b5'],
      backgroundColor: ['#ffffff'],
      textColor: ['#000000'],
      accentColor: ['#f44336'],
      fontFamily: ['Roboto, sans-serif']
    });
  }

  ngOnInit(): void {
    // Check if we're editing an existing template
    this.route.paramMap.subscribe(params => {
      this.templateId = params.get('id');
      if (this.templateId) {
        this.isEditMode = true;
        this.loadExistingTemplate(this.templateId);
      } else {
        // Creating a new template
        this.initializeNewTemplate();
      }
    });

    // Add form value changes subscription to update preview automatically
    this.templateForm.valueChanges.subscribe(() => {
      this.updatePreview();
    });
  }

  ngAfterViewInit(): void {
    // Initial update of preview after view is initialized
    setTimeout(() => {
      this.updatePreview();
    }, 500);
  }

  loadExistingTemplate(id: string): void {
    const template = this.invoiceService.getCustomTemplateById(id);
    if (template) {
      this.currentTemplate = template;
      this.templateForm.patchValue({
        name: template.name,
        description: template.description,
        layout: template.layout,
        headerColor: template.headerColor,
        backgroundColor: template.backgroundColor,
        textColor: template.textColor,
        accentColor: template.accentColor || '#f44336',
        fontFamily: template.fontFamily || 'Roboto, sans-serif'
      });

      // Load saved element settings if available
      if (template.elementSettings) {
        console.log('Loading saved element settings:', template.elementSettings);
        this.elementSettings = JSON.parse(JSON.stringify(template.elementSettings));
      }

      // Load custom element positions and settings if available
      if (template.elementPositions) {
        // Apply element positions to the preview
        console.log('Loading element positions:', template.elementPositions);
      }

      // Apply the changes to the preview after a brief delay to allow the DOM to update
      setTimeout(() => {
        this.updatePreview();
      }, 500);
    } else {
      this.snackBar.open('Template not found!', 'Close', { duration: 3000 });
      this.router.navigate(['/templates']);
    }
  }

  initializeNewTemplate(): void {
    // Set default values for a new template
    this.templateForm.reset({
      name: 'New Custom Template',
      description: 'My custom invoice template',
      layout: 'classic',
      headerColor: '#3f51b5',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      accentColor: '#f44336',
      fontFamily: 'Roboto, sans-serif'
    });
  }

  onLayoutChange(layout: string): void {
    console.log('Layout changed to:', layout);

    // Update the layout in the form
    this.templateForm.get('layout')?.setValue(layout, { emitEvent: false });

    // Force update the preview immediately
    setTimeout(() => {
      this.updatePreview();

      // Manually apply the layout class directly
      if (this.templatePreview) {
        const previewElement = this.templatePreview.nativeElement;

        // Reset and apply new layout class
        const layoutClasses = ['preview-classic', 'preview-modern', 'preview-creative', 'preview-minimal', 'preview-custom'];
        layoutClasses.forEach(cls => {
          previewElement.classList.remove(cls);
        });
        previewElement.classList.add(`preview-${layout}`);

        // Set header color based on layout
        const headerElements = previewElement.querySelectorAll('.preview-header');
        headerElements.forEach((element: HTMLElement) => {
          // Set different default colors based on layout
          let headerColor = this.templateForm.get('headerColor')?.value;
          switch (layout) {
            case 'classic':
              headerColor = headerColor || '#3f51b5';
              break;
            case 'modern':
              headerColor = headerColor || '#673ab7';
              break;
            case 'creative':
              headerColor = headerColor || '#8e44ad';
              break;
            case 'minimal':
              headerColor = headerColor || '#455a64';
              break;
            case 'custom':
              headerColor = headerColor || 'linear-gradient(to right, #ff9800, #f44336)';
              break;
          }
          element.style.backgroundColor = headerColor;
        });
      }
    }, 100);
  }

  onColorChange(colorType: string, color: string): void {
    // Update preview based on color changes
    this.updatePreview();
  }

  updatePreview(): void {
    // Update the template preview based on current settings
    if (!this.templatePreview) return;

    const formValues = this.templateForm.value;
    const previewElement = this.templatePreview.nativeElement;

    // Allow Angular to process changes before modifying DOM
    setTimeout(() => {
      console.log('Updating preview with layout:', formValues.layout);

      // Apply layout class first - handle both by direct application and by ngClass
      const layoutClasses = ['preview-classic', 'preview-modern', 'preview-creative', 'preview-minimal', 'preview-custom'];
      layoutClasses.forEach(cls => {
        previewElement.classList.remove(cls);
      });

      // Make sure we don't remove the base template-preview class
      if (!previewElement.classList.contains('template-preview')) {
        previewElement.classList.add('template-preview');
      }

      // Add the specific layout class
      previewElement.classList.add(`preview-${formValues.layout}`);

      // Set background color
      previewElement.style.backgroundColor = formValues.backgroundColor;

      // Set text color
      const textElements = previewElement.querySelectorAll('.preview-text');
      textElements.forEach((element: HTMLElement) => {
        element.style.color = formValues.textColor;
      });

      // Set header color
      const headerElements = previewElement.querySelectorAll('.preview-header');
      headerElements.forEach((element: HTMLElement) => {
        element.style.backgroundColor = formValues.headerColor;
      });

      // Apply font family
      previewElement.style.fontFamily = formValues.fontFamily;
    }, 0);
  }

  saveTemplate(): void {
    if (this.templateForm.invalid) {
      this.snackBar.open('Please fix the form errors before saving', 'Close', { duration: 3000 });
      return;
    }

    const formValues = this.templateForm.value;
    console.log('Saving template with values:', formValues);
    console.log('Saving element settings:', this.elementSettings);

    // Create or update template object
    const template: CustomTemplate = {
      id: this.currentTemplate?.id || `template_${Date.now()}`,
      name: formValues.name,
      description: formValues.description,
      createdDate: this.currentTemplate?.createdDate || new Date(),
      lastModified: new Date(),
      isCustom: true,
      layout: formValues.layout,
      headerColor: formValues.headerColor,
      backgroundColor: formValues.backgroundColor,
      textColor: formValues.textColor,
      accentColor: formValues.accentColor,
      fontFamily: formValues.fontFamily,
      templateContent: this.currentTemplate?.templateContent || {},
      elementPositions: this.currentTemplate?.elementPositions || {},
      customSections: this.currentTemplate?.customSections || [],
      elementSettings: this.elementSettings // Save element settings (visibility, alignment, etc.)
    };

    // Ensure all required properties are explicitly set even if they're undefined in the current template
    if (!template.accentColor) template.accentColor = formValues.accentColor;
    if (!template.fontFamily) template.fontFamily = formValues.fontFamily;

    // Make sure templateContent, elementPositions, and customSections are initialized properly
    if (!template.templateContent) template.templateContent = {};
    if (!template.elementPositions) template.elementPositions = {};
    if (!template.customSections) template.customSections = [];

    // Add default content if it's a new template
    if (Object.keys(template.templateContent).length === 0) {
      template.templateContent = this.generateDefaultContent(template.layout);
    }

    try {
      // Save the template
      this.invoiceService.saveCustomTemplate(template);
      console.log('Template saved successfully:', template.id);

      // Reset template data to avoid persistence
      this.resetTemplateData();

      // Show success message
      this.snackBar.open('Template saved successfully!', 'Close', { duration: 3000 });

      // Navigate back to templates page
      this.router.navigate(['/templates']);
    } catch (error) {
      console.error('Error saving template:', error);
      this.snackBar.open('Error saving template. Please try again.', 'Close', { duration: 3000 });
    }
  }

  // Helper method to generate default content based on selected layout
  generateDefaultContent(layout: string): { [key: string]: string } {
    const content: { [key: string]: string } = {};

    // Common template elements
    content['header-title'] = 'INVOICE';
    content['company-name'] = 'Your Company Name';
    content['company-email'] = 'company@example.com';
    content['company-phone'] = '(123) 456-7890';
    content['company-address'] = '123 Business St, City, State';
    content['property-title'] = 'TO:';

    // Add layout-specific content
    switch (layout) {
      case 'modern':
        content['col-desc'] = 'SERVICE';
        content['col-qty'] = 'HOURS/QTY';
        content['col-rate'] = 'RATE';
        content['col-amount'] = 'AMOUNT';
        content['total-label'] = 'TOTAL DUE';
        content['footer-text'] = 'Thank you for your business! Payment due within 30 days.';
        break;

      case 'creative':
        content['header-title'] = '⚡ CREATIVE INVOICE ⚡';
        content['col-desc'] = 'CREATIVE SERVICE';
        content['col-qty'] = 'MAGIC DELIVERED';
        content['col-rate'] = 'VALUE PER UNIT';
        content['col-amount'] = 'TOTAL MAGIC';
        content['total-label'] = 'THE GRAND TOTAL';
        content['footer-text'] = 'THANK YOU FOR CHOOSING OUR SERVICES!';
        break;

      case 'minimal':
        content['footer-text'] = 'Thank you';
        break;

      default: // classic
        content['col-desc'] = 'DESCRIPTION';
        content['col-qty'] = 'QUANTITY';
        content['col-rate'] = 'RATE';
        content['col-amount'] = 'AMOUNT';
        content['total-label'] = 'TOTAL';
        content['footer-text'] = 'Thank you for your business!';
    }

    return content;
  }

  cancelEdit(): void {
    this.router.navigate(['/templates']);
  }

  togglePreviewMode(): void {
    this.previewMode = this.previewMode === 'desktop' ? 'mobile' : 'desktop';
    // Update preview size
    setTimeout(() => this.updatePreview(), 0);
  }

  // Additional methods for element manipulation would go here
  toggleElementVisibility(element: string, visible: boolean): void {
    if (this.elementSettings[element]) {
      this.elementSettings[element].visible = visible;
      this.updatePreview();
    }
  }

  setElementAlignment(element: string, alignment: string): void {
    if (this.elementSettings[element] && this.elementSettings[element].alignment) {
      this.elementSettings[element].alignment = alignment;
      this.updatePreview();
    }
  }

  setElementStyle(element: string, style: string): void {
    if (this.elementSettings[element] && this.elementSettings[element].style) {
      this.elementSettings[element].style = style;
      this.updatePreview();
    }
  }

  // Method to set logo size
  setLogoSize(size: string): void {
    if (this.elementSettings.logo) {
      this.elementSettings.logo.size = size;
      this.updatePreview();
    }
  }

  // Add reset method
  resetTemplateData(): void {
    console.log('Resetting template data');

    // Reset to initial values
    this.initializeNewTemplate();

    // Reset current template
    this.currentTemplate = null;

    // Reset element settings
    this.elementSettings = {
      header: { visible: true, position: 'top' },
      logo: { visible: true, size: 'medium' },
      companyInfo: { visible: true, alignment: 'left' },
      clientInfo: { visible: true, alignment: 'right' },
      invoiceDetails: { visible: true, style: 'standard' },
      itemsTable: { visible: true, style: 'standard' },
      totalSection: { visible: true, alignment: 'right' },
      notes: { visible: true, position: 'bottom' },
      footer: { visible: true, content: 'Thank you for your business!' }
    };

    // Reset to edit mode being off
    this.isEditMode = false;

    console.log('Template data has been reset');
  }
}
