import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import * as html2canvas from 'html2canvas';
import * as jsPDF from 'jspdf';
import { CustomTemplate, Invoice, InvoiceService } from '../../services/invoice.service';

interface TemplateContent {
    [key: string]: string;
}

interface CustomSection {
    id: string;
    title: string;
    content: string;
    color: string;
    type: 'normal' | 'table' | 'text';  // Include 'text' type
    columns?: string[];        // For table type
    rows?: any[];             // For table type
}

interface SavedTemplate {
    id: number;
    name: string;
    content: TemplateContent;
    positions: { [key: string]: { x: number, y: number } };
    headerColor: string;
    backgroundColor?: string;
    textColor?: string;
    items: any[];
    customSections: CustomSection[];
}

@Component({
    selector: 'app-invoice-creator',
    templateUrl: './invoice-creator.component.html',
    styleUrls: ['./invoice-creator.component.scss']
})
export class InvoiceCreatorComponent implements OnInit, AfterViewInit, OnDestroy {
    invoiceForm: FormGroup;
    templateId: number = 1;
    headerColor: string = '#3f51b5'; // Default color
    backgroundColor: string = '#ffffff'; // Default background color
    textColor: string = '#000000'; // Default text color
    today: Date = new Date();
    Math: any = Math; // Add Math as a class property
    invoiceNumber: string; // Store invoice number as a property
    currentInvoice: Invoice | null = null;

    // Subscription properties
    isSubscribed: boolean = false;
    showSubscriptionPrompt: boolean = false;

    // Custom template properties
    customTemplateId: string | null = null;
    isCustomTemplate: boolean = false;
    customTemplate: CustomTemplate | null = null;

    // Template customization properties
    isEditMode: boolean = false;
    templateContent: TemplateContent = {};
    elementPositions: { [key: string]: { x: number, y: number } } = {};
    currentEditingElement: string | null = null;
    itemContent: { [key: string]: any } = {};
    customSections: CustomSection[] = [];
    defaultColumns: string[] = ['Column 1', 'Column 2', 'Column 3'];
    layout: string = 'classic'; // Add this property to the class

    // Element settings for template
    elementSettings: {
        [key: string]: {
            visible?: boolean;
            alignment?: string;
            size?: string;
            position?: string;
            style?: string;
            content?: string;
        }
    } = {
            header: { visible: true, alignment: 'center' },
            logo: { visible: true, alignment: 'left', size: 'medium' },
            companyInfo: { visible: true, alignment: 'left' },
            clientInfo: { visible: true, alignment: 'right' },
            invoiceDetails: { visible: true, alignment: 'right' },
            itemsTable: { visible: true },
            totalSection: { visible: true, alignment: 'right' },
            notes: { visible: true, alignment: 'left' },
            footer: { visible: true, alignment: 'center' }
        };

    // Add speech recognition property
    private recognition: any;
    isListening = false;
    showVoiceHelp = false;

    // Add missing properties
    headerText: string = '';
    footerText: string = '';

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private fb: FormBuilder,
        private sanitizer: DomSanitizer,
        private elementRef: ElementRef,
        private invoiceService: InvoiceService,
        private snackBar: MatSnackBar
    ) {
        this.invoiceForm = this.fb.group({
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            address: ['', Validators.required],
            phone: ['', Validators.required],
            business: ['', Validators.required],
            propertyName: ['', Validators.required],
            layout: [this.layout || 'classic'],
            items: this.fb.array([
                this.fb.group({
                    description: ['', Validators.required],
                    quantity: [1, [Validators.required, Validators.min(1)]],
                    rate: [0, [Validators.required, Validators.min(0)]],
                    amount: [{ value: 0, disabled: true }]
                })
            ])
        });

        // Get the current invoice from the service or generate a number
        this.currentInvoice = this.invoiceService.getCurrentInvoice();
        this.invoiceNumber = this.currentInvoice?.invoiceNumber || this.generateInvoiceNumber();

        // Initialize speech recognition if browser supports it
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new (window as any).webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event: any) => {
                const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
                this.processVoiceCommand(transcript);
                // Don't set isListening to false as we want to continue listening
            };

            this.recognition.onend = () => {
                // Only set listening to false if we're not in continuous mode
                if (this.isListening) {
                    // Restart recognition if it ended but we're still in listening mode
                    this.recognition.start();
                }
            };

            this.recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                this.isListening = false;
                this.snackBar.open(`Speech recognition error: ${event.error}`, 'Close', {
                    duration: 3000,
                    panelClass: ['error-snackbar']
                });
            };
        }
    }

    ngOnInit(): void {
        this.initForm();

        // Subscribe to form value changes to update totals
        this.invoiceForm.valueChanges.subscribe(() => {
            this.calculateInvoiceTotals();
        });

        this.route.queryParams.subscribe(params => {
            console.log('Query params:', params);
            if (params?.templateId) {
                this.templateId = +params.templateId;
                console.log('Setting template ID:', this.templateId);
            }
            if (params?.layout) {
                this.layout = params.layout;
                console.log('Setting layout from params:', this.layout);
            }

            // Apply template after getting query parameters
            if (params?.templateId === '4' || params?.layout === 'real-estate') {
                console.log('Real Estate template detected, applying layout');
                this.layout = 'real-estate';
                // Force loading the real estate layout
                this.loadRealEstateLayout();
                setTimeout(() => {
                    this.applyLayoutClass();
                }, 100);
            }
        });

        // First load invoice data if available
        this.loadInvoiceData();

        // Then apply template settings if needed
        if (this.templateId) {
            this.loadTemplateLayout();
        }

        // Then apply URL parameters if provided (they will override the invoice data)
        this.route.queryParams.subscribe(params => {
            let shouldApplyLayouts = false;

            if (params['templateId']) {
                this.templateId = +params['templateId'];
                shouldApplyLayouts = true;
            }

            if (params['color']) {
                this.headerColor = params['color'];
            }

            if (params['layout']) {
                this.layout = params['layout'];
                console.log('Layout set from URL param:', this.layout);
                shouldApplyLayouts = true;

                // Update the form with the layout value if the form has been initialized
                if (this.invoiceForm) {
                    this.invoiceForm.patchValue({
                        layout: this.layout
                    }, { emitEvent: false });
                }
            }

            // Check for custom template
            if (params['customTemplateId']) {
                this.customTemplateId = params['customTemplateId'];
                this.isCustomTemplate = true;
                shouldApplyLayouts = true;
            }

            if (params['isCustomTemplate'] === 'true') {
                this.isCustomTemplate = true;
            }

            // Load template layout based on template type
            if (!this.currentInvoice || shouldApplyLayouts) {
                if (this.isCustomTemplate && this.customTemplateId) {
                    this.loadCustomTemplate(this.customTemplateId);
                } else {
                    this.loadTemplateLayout();
                    this.loadSavedTemplate();
                }

                // Force apply layout class after everything is loaded
                setTimeout(() => {
                    console.log('Force applying layout class after template load');
                    this.applyLayoutClass();
                }, 500);
            }
        });
    }

    ngAfterViewInit() {
        // Initialize any DOM-dependent operations here
        console.log('View initialized, applying layout class:', this.layout);

        // Apply layout class first to ensure proper structure
        this.applyLayoutClass();

        // Then apply element settings
        this.applyElementSettings();

        // Force layout to be applied after a short delay to ensure DOM is ready
        setTimeout(() => {
            console.log('Re-applying layout class after view init');
            this.applyLayoutClass();
        }, 500);
    }

    ngOnDestroy(): void {
        // Stop recognition if active when component is destroyed
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    // Initialize the invoice form
    initForm(): void {
        this.invoiceForm = this.fb.group({
            invoiceNumber: [this.currentInvoice?.invoiceNumber || this.generateInvoiceNumber()],
            date: [this.currentInvoice?.date || new Date()],
            name: [this.currentInvoice?.name || ''],
            email: [this.currentInvoice?.email || ''],
            address: [this.currentInvoice?.address || ''],
            phone: [this.currentInvoice?.phone || ''],
            business: [this.currentInvoice?.business || ''],
            propertyName: [this.currentInvoice?.propertyName || ''],
            layout: [this.currentInvoice?.layout || this.layout || 'classic'],
            items: this.fb.array(
                this.currentInvoice?.items?.map(item => this.fb.group({
                    description: [item.description, Validators.required],
                    quantity: [item.quantity, [Validators.required, Validators.min(1)]],
                    rate: [item.rate, [Validators.required, Validators.min(0)]],
                    amount: [{ value: item.amount, disabled: true }]
                })) || [
                    this.fb.group({
                        description: ['', Validators.required],
                        quantity: [1, [Validators.required, Validators.min(1)]],
                        rate: [0, [Validators.required, Validators.min(0)]],
                        amount: [{ value: 0, disabled: true }]
                    })
                ]
            ),
            total: [this.currentInvoice?.total || 0]
        });
    }

    // Update invoice data when form values change
    updateInvoice(): void {
        if (this.invoiceForm && this.invoiceForm.valid) {
            const formData = this.invoiceForm.value;

            if (!this.currentInvoice) {
                this.currentInvoice = {
                    id: '', // Will be set when saving
                    name: '',
                    email: '',
                    address: '',
                    phone: '',
                    business: '',
                    propertyName: '',
                    items: [],
                    total: 0,
                    date: new Date(),
                    invoiceNumber: this.generateInvoiceNumber(),
                    notes: ''
                };
            }

            // Update the invoice with the form values
            this.currentInvoice.invoiceNumber = formData.invoiceNumber;
            this.currentInvoice.date = formData.date;
            this.currentInvoice.name = formData.name;
            this.currentInvoice.email = formData.email;
            this.currentInvoice.address = formData.address;
            this.currentInvoice.phone = formData.phone;
            this.currentInvoice.business = formData.business;
            this.currentInvoice.propertyName = formData.propertyName;

            if (formData.items) {
                this.currentInvoice.items = formData.items;
            }

            this.currentInvoice.total = this.calculateTotal();
            this.currentInvoice.templateId = this.templateId;
            this.currentInvoice.headerColor = this.headerColor;
            this.currentInvoice.backgroundColor = this.backgroundColor;
            this.currentInvoice.textColor = this.textColor;
            this.currentInvoice.layout = this.layout;
            this.currentInvoice.templateContent = { ...this.templateContent };
            this.currentInvoice.elementPositions = { ...this.elementPositions };
            this.currentInvoice.customSections = JSON.parse(JSON.stringify(this.customSections));
            this.currentInvoice.customTemplateId = this.customTemplateId;
            this.currentInvoice.fontFamily = this.customTemplate?.fontFamily;
            this.currentInvoice.accentColor = this.customTemplate?.accentColor;
            this.currentInvoice.elementSettings = { ...this.elementSettings };

            // Calculate the amount for each item
            this.currentInvoice.items.forEach(item => {
                item.amount = item.quantity * item.rate;
            });

            // Save the invoice
            this.invoiceService.saveInvoice(this.currentInvoice);

            // Show a success message with snackbar
            this.snackBar.open('Invoice saved successfully!', 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
            });
        } else {
            // Show an error message if the form is invalid
            this.snackBar.open('Please correct the errors in the form before saving.', 'Close', {
                duration: 5000,
                panelClass: ['error-snackbar']
            });

            // Mark all fields as touched to show validation errors
            Object.keys(this.invoiceForm.controls).forEach(field => {
                const control = this.invoiceForm.get(field);
                control?.markAsTouched({ onlySelf: true });
            });
        }
    }

    // Calculate invoice totals
    calculateInvoiceTotals(): void {
        if (this.currentInvoice && this.currentInvoice.items && this.currentInvoice.items.length > 0) {
            const total = this.currentInvoice.items.reduce((sum, item) => {
                return sum + (item.quantity * item.rate);
            }, 0);

            this.invoiceForm.patchValue({ total }, { emitEvent: false });
        }
    }

    // Add new method to handle item value changes
    onItemValueChange(): void {
        this.calculateInvoiceTotals();
        this.updateInvoice();
    }

    // Apply element settings (visibility, position, etc.)
    applyElementSettings(): void {
        console.log("Applying element settings:", this.elementSettings);

        // Define alternative class selectors for each element type
        const elementSelectors = {
            'header': ['.invoice-header'],
            'logo': ['.logo', '.logo-section'],
            'companyInfo': ['.invoice-companyInfo', '.company-info', '.invoice-company'],
            'clientInfo': ['.invoice-clientInfo', '.client-info', '.invoice-client'],
            'invoiceDetails': ['.invoice-details', '.invoice-invoiceDetails'],
            'itemsTable': ['.invoice-items'],
            'totalSection': ['.total-label'],
            'footer': ['.invoice-footer']
        };

        // Hide/show elements based on settings
        Object.keys(this.elementSettings).forEach(key => {
            console.log(`Processing element: ${key}, visible: ${this.elementSettings[key]?.visible}`);

            // Try all possible selectors for this element type
            const selectors = elementSelectors[key as keyof typeof elementSelectors] || [`.invoice-${key}`];
            let appliedTo = false;

            // Try each selector
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                console.log(`Selector ${selector} matched ${elements.length} elements`);

                elements.forEach(element => {
                    // Apply visibility
                    if (this.elementSettings[key]?.visible === false) {
                        console.log(`Hiding element with selector: ${selector}`);
                        (element as HTMLElement).style.display = 'none';
                        element.classList.add('force-hide');
                        element.setAttribute('data-force-visible', 'false');
                    } else {
                        console.log(`Showing element with selector: ${selector}`);
                        (element as HTMLElement).style.display = '';
                        element.classList.remove('force-hide');
                        element.setAttribute('data-force-visible', 'true');

                        // Apply logo size if this is a logo element
                        if (key === 'logo' && this.elementSettings[key]?.size) {
                            // Remove any existing size classes
                            element.classList.remove('logo-size-small', 'logo-size-medium', 'logo-size-large');
                            // Add the appropriate size class
                            element.classList.add(`logo-size-${this.elementSettings[key].size}`);
                            console.log(`Applied logo size: ${this.elementSettings[key].size}`);
                        }
                    }

                    // Apply other settings like alignment
                    if (this.elementSettings[key]?.alignment) {
                        (element as HTMLElement).setAttribute('data-alignment', this.elementSettings[key].alignment!);
                    }

                    appliedTo = true;
                });
            });

            // Also try data-element attribute selector
            const dataElements = document.querySelectorAll(`[data-element="${key}"]`);
            console.log(`Attribute selector [data-element="${key}"] matched ${dataElements.length} elements`);

            dataElements.forEach(element => {
                // Apply visibility
                if (this.elementSettings[key]?.visible === false) {
                    console.log(`Hiding element with data-element: ${key}`);
                    (element as HTMLElement).style.display = 'none';
                    element.classList.add('force-hide');
                    element.setAttribute('data-force-visible', 'false');
                } else {
                    console.log(`Showing element with data-element: ${key}`);
                    (element as HTMLElement).style.display = '';
                    element.classList.remove('force-hide');
                    element.setAttribute('data-force-visible', 'true');

                    // Apply logo size if this is a logo element
                    if (key === 'logo' && this.elementSettings[key]?.size) {
                        // Remove any existing size classes
                        element.classList.remove('logo-size-small', 'logo-size-medium', 'logo-size-large');
                        // Add the appropriate size class
                        element.classList.add(`logo-size-${this.elementSettings[key].size}`);
                        console.log(`Applied logo size: ${this.elementSettings[key].size}`);
                    }
                }

                // Apply other settings
                if (this.elementSettings[key]?.alignment) {
                    (element as HTMLElement).setAttribute('data-alignment', this.elementSettings[key].alignment!);
                }

                appliedTo = true;
            });

            if (!appliedTo) {
                console.warn(`Could not find any elements for ${key}`);
            }
        });

        // Add CSS rules to ensure visibility settings are enforced
        this.applyVisibilityStylesheet();

        // Final step to ensure business name has correct text color (not red)
        setTimeout(() => {
            const businessElements = document.querySelectorAll(
                '#business-name, #company-name, .company-name, .invoice-companyInfo h2, .preview-company-info h3, .seller-info h2'
            );
            businessElements.forEach((element) => {
                (element as HTMLElement).style.color = this.textColor;
                console.log(`Applied text color ${this.textColor} to business element:`, element);
            });
        }, 100);
    }

    // Create and apply a stylesheet for visibility settings
    applyVisibilityStylesheet(): void {
        // Remove existing stylesheet if present
        const existingStyle = document.getElementById('visibility-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new style element
        const styleEl = document.createElement('style');
        styleEl.id = 'visibility-styles';

        // Build CSS rules
        let css = '';

        // Add rule for force-hide class
        css += '.force-hide { display: none !important; visibility: hidden !important; }\n';

        // Add rules for each element
        Object.keys(this.elementSettings).forEach(key => {
            const selectors = [
                `.invoice-${key}`,
                `[data-element="${key}"]`
            ];

            // Add additional known selectors
            if (key === 'companyInfo') {
                selectors.push('.invoice-companyInfo', '.company-info', '.invoice-company');
            } else if (key === 'clientInfo') {
                selectors.push('.invoice-clientInfo', '.client-info', '.invoice-client');
            } else if (key === 'invoiceDetails') {
                selectors.push('.invoice-details', '.invoice-invoiceDetails');
            }

            const selectorString = selectors.join(', ');

            if (this.elementSettings[key]?.visible === false) {
                // Hide elements
                css += `${selectorString} { display: none !important; visibility: hidden !important; }\n`;
            } else {
                // Show elements (and override any cascaded hiding)
                css += `${selectorString} { display: block !important; visibility: visible !important; }\n`;
            }
        });

        // Apply the stylesheet
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    loadInvoiceData(): void {
        const currentInvoice = this.invoiceService.getCurrentInvoice();
        if (currentInvoice) {
            // Update form with invoice data
            this.invoiceForm.patchValue({
                name: currentInvoice.name,
                email: currentInvoice.email,
                address: currentInvoice.address,
                phone: currentInvoice.phone,
                business: currentInvoice.business,
                propertyName: currentInvoice.propertyName
            });

            // Update invoice number
            this.invoiceNumber = currentInvoice.invoiceNumber;

            // Clear existing items
            const items = this.getItems();
            while (items.length > 0) {
                items.removeAt(0);
            }

            // Add items from the invoice
            currentInvoice.items.forEach(item => {
                items.push(this.fb.group({
                    description: [item.description, Validators.required],
                    quantity: [item.quantity, [Validators.required, Validators.min(1)]],
                    rate: [item.rate, [Validators.required, Validators.min(0)]],
                    amount: [{ value: item.amount, disabled: true }]
                }));
            });

            // Load template customization properties if available
            if (currentInvoice.templateId) {
                this.templateId = currentInvoice.templateId;
            }
            if (currentInvoice.headerColor) {
                this.headerColor = currentInvoice.headerColor;
            }
            if (currentInvoice.backgroundColor) {
                this.backgroundColor = currentInvoice.backgroundColor;
            }
            if (currentInvoice.textColor) {
                this.textColor = currentInvoice.textColor;
                // Apply text color
                setTimeout(() => this.updateTextColor(), 100);
            }
            if (currentInvoice.layout) {
                this.layout = currentInvoice.layout;
                console.log('Setting layout from loaded invoice:', this.layout);

                // Update the form with the layout value
                this.invoiceForm.patchValue({
                    layout: this.layout
                }, { emitEvent: false });
            }
            if (currentInvoice.templateContent) {
                this.templateContent = { ...currentInvoice.templateContent };
                // Apply template content
                this.applyTemplateContent();
            }
            if (currentInvoice.elementPositions) {
                this.elementPositions = { ...currentInvoice.elementPositions };
            }
            if (currentInvoice.customSections) {
                this.customSections = [...currentInvoice.customSections];
            }

            // Force the correct layout class to be applied after loading
            setTimeout(() => this.applyLayoutClass(), 100);
        }
    }

    // Toggle edit mode for template customization
    toggleEditMode(): void {
        this.isEditMode = !this.isEditMode;

        if (this.isEditMode) {
            // When entering edit mode, ensure proper initialization
            this.snackBar.open('Edit mode enabled. Click on any text to edit it.', 'Got it', {
                duration: 3000,
                panelClass: ['info-snackbar']
            });

            // Force a refresh of the template content
            setTimeout(() => {
                // Apply contentEditable to all editable elements programmatically
                this.applyContentEditableToElements();
                // Make sure drag handles are visible
                this.applyDragHandlesToElements();
            }, 100);
        } else {
            // Clean up when exiting edit mode
            this.currentEditingElement = null;

            // Notify the user
            this.snackBar.open('Edit mode disabled. Changes have been saved to the current session.', 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
            });
        }
    }

    // Apply contentEditable attribute to all editable elements programmatically
    private applyContentEditableToElements(): void {
        // Delay execution slightly to ensure template is rendered
        setTimeout(() => {
            const editableElements = document.querySelectorAll('.invoice-template [id]');
            editableElements.forEach(element => {
                if (element.id) {
                    // Skip elements that shouldn't be editable (like containers)
                    if (element.id.includes('container') ||
                        element.id.includes('section') ||
                        element.id === 'invoice-template') {
                        return;
                    }

                    // Make element editable
                    element.setAttribute('contenteditable', 'true');

                    // Add click handler to properly trigger edit mode for the element
                    element.addEventListener('click', (e) => {
                        if (this.isEditMode) {
                            e.preventDefault();
                            this.editElement(element.id);
                        }
                    });

                    // Add blur handler to save changes
                    element.addEventListener('blur', () => {
                        if (this.isEditMode) {
                            this.updateContent(element.id);
                        }
                    });
                }
            });
        }, 200);
    }

    // Make sure drag handles are visible and functional for all templates
    private applyDragHandlesToElements(): void {
        setTimeout(() => {
            const dragElements = document.querySelectorAll('.invoice-template [cdkDrag]');
            dragElements.forEach(element => {
                // Enable drag on all elements with cdkDrag attribute
                element.removeAttribute('cdkDragDisabled');

                // Make sure drag handles are visible
                const overlay = element.querySelector('.edit-overlay');
                if (overlay) {
                    (overlay as HTMLElement).style.display = 'flex';
                }
            });
        }, 200);
    }

    // Subscription methods
    subscribe(): void {
        // In a real application, this would redirect to a payment gateway
        // For this demo, we'll just set isSubscribed to true
        this.isSubscribed = true;
        this.showSubscriptionPrompt = false;

        // Show success message
        this.snackBar.open('Successfully subscribed to Pro plan!', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
        });
    }

    manageSubscription(): void {
        // In a real application, this would redirect to subscription management page
        this.snackBar.open('Subscription management page would open here', 'Close', {
            duration: 3000
        });
    }

    unsubscribe(): void {
        // In a real application, this would handle cancellation logic
        // For this demo, we'll just set isSubscribed to false
        this.isSubscribed = false;

        // If user is in edit mode, exit it
        if (this.isEditMode) {
            this.isEditMode = false;
            this.currentEditingElement = null;
        }

        // Show message
        this.snackBar.open('Subscription cancelled', 'Close', {
            duration: 3000,
            panelClass: ['warning-snackbar']
        });
    }

    // Check if user has permission to edit
    hasEditPermission(): boolean {
        return true;  // Always allow editing since subscription is removed
    }

    // Edit element content - can be triggered by click anywhere in the element
    editElement(elementId: string): void {
        this.currentEditingElement = elementId;

        // Find the element to edit
        const element = document.getElementById(elementId);
        if (element) {
            // Make sure the element is editable
            element.setAttribute('contenteditable', 'true');

            // Set a visual indicator that this element is being edited
            element.classList.add('currently-editing');

            // Focus the element
            element.focus();

            // Try to place cursor at end of text
            try {
                // Create a range and set cursor at the end
                const range = document.createRange();
                range.selectNodeContents(element);
                range.collapse(false); // Collapse to end

                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            } catch (e) {
                console.warn('Error focusing element:', e);
            }
        }
    }

    // Handle click on any editable element
    handleElementClick(event: MouseEvent, elementId: string): void {
        if (this.isEditMode) {
            event.preventDefault();
            this.editElement(elementId);
        }
    }

    // Update content after editing
    updateContent(elementId: string): void {
        const element = document.getElementById(elementId);
        if (element) {
            // Store the content in the templateContent object by ID
            this.templateContent[elementId] = element.innerText;

            // Remove the editing indicator class
            element.classList.remove('currently-editing');

            // Update form fields if this is a form-connected field
            if (elementId.includes('business-name') || elementId.includes('company-name')) {
                this.invoiceForm.patchValue({
                    business: element.innerText
                });
            } else if (elementId.includes('client-name')) {
                this.invoiceForm.patchValue({
                    name: element.innerText
                });
            } else if (elementId.includes('client-address') || elementId.includes('address')) {
                this.invoiceForm.patchValue({
                    address: element.innerText
                });
            } else if (elementId.includes('client-phone') || elementId.includes('phone')) {
                this.invoiceForm.patchValue({
                    phone: element.innerText
                });
            } else if (elementId.includes('client-email') || elementId.includes('email')) {
                this.invoiceForm.patchValue({
                    email: element.innerText
                });
            } else if (elementId.includes('property-name')) {
                this.invoiceForm.patchValue({
                    propertyName: element.innerText
                });
            }

            // If this was a total-related field, recalculate totals
            if (elementId.includes('total') || elementId.includes('amount') ||
                elementId.includes('rate') || elementId.includes('qty')) {
                this.calculateInvoiceTotals();
            }
        }
    }

    // Update item content after editing
    updateItemContent(event: FocusEvent, index: number, field: string): void {
        const element = event.target as HTMLElement;
        const value = element.innerText;

        // Store the content
        const itemKey = `item-${field}-${index}`;
        this.itemContent[itemKey] = value;

        // Update the form control
        const items = this.getItems();
        if (items.at(index)) {
            const item = items.at(index);

            // Handle different field types
            if (field === 'quantity' || field === 'rate') {
                // Convert to number for numeric fields
                const numValue = parseFloat(value.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(numValue)) {
                    item.get(field)?.setValue(numValue);
                }
            } else {
                // For text fields
                item.get(field)?.setValue(value);
            }
        }
    }

    // Add a new item to the invoice
    addNewItem(): void {
        const items = this.getItems();
        items.push(this.fb.group({
            description: ['New Item', Validators.required],
            quantity: [1, [Validators.required, Validators.min(1)]],
            rate: [0, [Validators.required, Validators.min(0)]],
            amount: [{ value: 0, disabled: true }]
        }));
        this.calculateInvoiceTotals(); // Recalculate totals after adding an item
    }

    // Remove an item from the invoice
    removeItem(index: number): void {
        const items = this.getItems();
        if (items.length > 1) {
            items.removeAt(index);
            this.calculateInvoiceTotals(); // Recalculate totals after removing an item
        } else {
            this.snackBar.open('You must have at least one item in the invoice.', 'Close', {
                duration: 3000,
                panelClass: ['warning-snackbar']
            });
        }
    }

    // Add a new custom section
    addCustomSection(): void {
        const newSection: CustomSection = {
            id: 'section-' + Date.now(),
            title: 'Custom Section',
            content: 'Enter your custom details here...',
            color: '#f5f5f5',
            type: 'normal'
        };
        this.customSections.push(newSection);
    }

    // Remove a custom section
    removeCustomSection(section: CustomSection): void {
        const index = this.customSections.findIndex(s => s.id === section.id);
        if (index !== -1) {
            this.customSections.splice(index, 1);
        }
    }

    // Update custom section content
    updateSectionContent(index: number, field: 'title' | 'content'): void {
        const elementId = field === 'title' ?
            `section-title-${index}` :
            `section-content-${index}`;

        const element = document.getElementById(elementId);
        if (element && this.customSections[index]) {
            this.customSections[index][field] = element.innerText;
        }
    }

    // Update section color
    updateSectionColor(index: number): void {
        // The color is already bound with ngModel, no need to do anything else
    }

    // Update header color
    updateHeaderColor(): void {
        // The color is already bound with ngModel, no need to do anything else
    }

    // Update background color
    updateBackgroundColor(): void {
        console.log('Updating background color to:', this.backgroundColor);

        const invoiceTemplate = document.getElementById('invoice-template');
        if (invoiceTemplate) {
            invoiceTemplate.style.backgroundColor = this.backgroundColor;
        }

        // Update the form value to match
        if (this.invoiceForm) {
            this.invoiceForm.patchValue({
                backgroundColor: this.backgroundColor
            }, { emitEvent: false });
        }
    }

    // Update text color
    updateTextColor(): void {
        console.log('Updating text color to:', this.textColor);

        const invoiceTemplate = document.getElementById('invoice-template');
        if (invoiceTemplate) {
            // Set the CSS variable for text color
            invoiceTemplate.style.setProperty('--text-color', this.textColor);

            // Make sure text-colored class is applied for typography
            invoiceTemplate.classList.add('text-colored');
        }

        // Update the font color for all text elements 
        const textElements = document.querySelectorAll('.invoice-template h1, .invoice-template h2, .invoice-template h3, .invoice-template p, .invoice-template td, .invoice-template th, .invoice-template span, .invoice-template div');
        textElements.forEach((element) => {
            (element as HTMLElement).style.color = this.textColor;
        });

        // Specifically find and update business name elements
        const businessElements = document.querySelectorAll('#business-name, #company-name, .company-name, .invoice-companyInfo h2, .preview-company-info h3');
        businessElements.forEach((element) => {
            (element as HTMLElement).style.color = this.textColor;
            console.log(`Applied text color ${this.textColor} to business element:`, element);
        });

        // Update the form value to match
        if (this.invoiceForm) {
            this.invoiceForm.patchValue({
                textColor: this.textColor
            }, { emitEvent: false });
        }
    }

    // Save template customizations
    saveTemplate(): void {
        // Make sure all custom sections are properly formatted before saving
        this.customSections.forEach(section => {
            if (section.type === 'table' && !section.rows) {
                section.rows = [];
            }
        });

        const savedTemplate: SavedTemplate = {
            id: this.templateId,
            name: `Custom Template ${this.templateId}`,
            content: this.templateContent,
            positions: this.elementPositions,
            headerColor: this.headerColor,
            backgroundColor: this.backgroundColor,
            textColor: this.textColor,
            items: this.getItems().value,
            customSections: [...this.customSections] // Create a copy to ensure proper serialization
        };

        // Save to localStorage
        const templates = this.getSavedTemplates();
        const existingIndex = templates.findIndex(t => t.id === this.templateId);

        if (existingIndex >= 0) {
            templates[existingIndex] = savedTemplate;
        } else {
            templates.push(savedTemplate);
        }

        localStorage.setItem('savedTemplates', JSON.stringify(templates));

        // Show success message with snackbar
        this.snackBar.open('Template saved successfully!', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
        });
    }

    // Load saved template customizations
    loadSavedTemplate(): void {
        const templates = this.getSavedTemplates();
        const savedTemplate = templates.find(t => t.id === this.templateId);

        if (savedTemplate) {
            this.templateContent = savedTemplate.content;
            this.elementPositions = savedTemplate.positions;
            this.headerColor = savedTemplate.headerColor;

            // Apply template content
            this.applyTemplateContent();

            // Load additional color settings if available
            if (savedTemplate.backgroundColor) {
                this.backgroundColor = savedTemplate.backgroundColor;
            }
            if (savedTemplate.textColor) {
                this.textColor = savedTemplate.textColor;
                this.updateTextColor(); // Apply text color
            }

            // Load items
            if (savedTemplate.items && savedTemplate.items.length > 0) {
                const items = this.getItems();
                items.clear();
                savedTemplate.items.forEach(item => {
                    items.push(this.fb.group({
                        description: [item.description, Validators.required],
                        quantity: [item.quantity, [Validators.required, Validators.min(1)]],
                        rate: [item.rate, [Validators.required, Validators.min(0)]],
                        amount: [{ value: 0, disabled: true }]
                    }));
                });
            }

            // Load custom sections
            if (savedTemplate.customSections && savedTemplate.customSections.length > 0) {
                this.customSections = savedTemplate.customSections.map(section => {
                    // Ensure all required properties exist
                    return {
                        id: section.id || 'section-' + Date.now(),
                        title: section.title || 'Custom Section',
                        content: section.content || '',
                        color: section.color || '#f5f5f5',
                        type: section.type || 'normal',
                        columns: section.columns || [...this.defaultColumns],
                        rows: section.rows || []
                    };
                });
            }
        }
    }

    // Get saved templates from localStorage
    getSavedTemplates(): SavedTemplate[] {
        const templates = localStorage.getItem('savedTemplates');
        return templates ? JSON.parse(templates) : [];
    }

    // Track drag end to save positions
    onDragEnded(event: any, elementId: string): void {
        if (!this.isEditMode) {
            return; // Only allow dragging in edit mode
        }

        console.log('Drag ended for element:', elementId);

        if (!this.elementPositions[elementId]) {
            this.elementPositions[elementId] = { x: 0, y: 0 };
        }

        // Get transform values
        const transform = event.source.element.nativeElement.style.transform;
        console.log('Transform value:', transform);

        // Support multiple transform patterns (translate3d, translate, matrix)
        let x = 0, y = 0;
        const translate3dRegex = /translate3d\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px,\s*0px\)/;
        const translateRegex = /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/;
        const matrixRegex = /matrix\(.*,\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/;

        let match = transform.match(translate3dRegex);
        if (match) {
            x = parseFloat(match[1]);
            y = parseFloat(match[2]);
        } else {
            match = transform.match(translateRegex);
            if (match) {
                x = parseFloat(match[1]);
                y = parseFloat(match[2]);
            } else {
                match = transform.match(matrixRegex);
                if (match) {
                    x = parseFloat(match[1]);
                    y = parseFloat(match[2]);
                }
            }
        }

        this.elementPositions[elementId] = { x, y };
        console.log('Saved position for', elementId, this.elementPositions[elementId]);

        // Apply the transform directly to ensure it's immediately visible
        const element = event.source.element.nativeElement;
        element.style.transform = `translate3d(${x}px, ${y}px, 0px)`;

        // Reapply template to ensure positioning is maintained
        this.reapplyTemplateAfterDrag();
    }

    navigateToForm(): void {
        this.router.navigate(['/form']);
    }

    // Method to generate a random invoice number
    generateInvoiceNumber(): string {
        return '000' + Math.floor(Math.random() * 1000);
    }

    // Method to get the stored invoice number
    getRandomInvoiceNumber(): string {
        return this.invoiceNumber;
    }

    downloadPdf(): void {
        // Store current edit mode state
        const wasEditMode = this.isEditMode;
        const element = document.getElementById('invoice-template');

        if (element) {
            // Temporarily hide all edit-related elements and styles
            const editElements = element.querySelectorAll('.edit-overlay, .section-controls, .table-controls, .action-column, .edit-mode-instructions, .color-picker-container, .controls, .add-section-buttons, .remove-section, .table-controls button, .table-controls input, .add-column, .add-row, .remove-column, .remove-row, .section-type-select, .section-color-picker, .remove');

            // Store original styles to restore later
            const originalStyles = new Map();

            // Hide edit elements
            editElements.forEach(el => {
                (el as HTMLElement).style.display = 'none';
            });

            // Remove edit-related styles from the template
            const contentElements = element.querySelectorAll('[contenteditable]');
            contentElements.forEach(el => {
                const htmlEl = el as HTMLElement;
                originalStyles.set(el, {
                    border: htmlEl.style.border,
                    outline: htmlEl.style.outline,
                    contentEditable: htmlEl.contentEditable
                });
                htmlEl.style.border = 'none';
                htmlEl.style.outline = 'none';
                htmlEl.contentEditable = 'false';
            });

            // Convert input fields to plain text in table cells
            const tableInputs = element.querySelectorAll('.table-cell input');
            const inputOriginalParents = new Map();
            tableInputs.forEach(input => {
                const cell = input.parentElement;
                if (cell) {
                    inputOriginalParents.set(cell, cell.innerHTML);
                    cell.textContent = (input as HTMLInputElement).value;
                }
            });

            setTimeout(() => {
                html2canvas.default(element, {
                    scale: 2, // Increase quality
                    useCORS: true,
                    removeContainer: true,
                    backgroundColor: '#ffffff'
                }).then((canvas: any) => {
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF.default('p', 'mm', 'a4');
                    const imgProps = pdf.getImageProperties(imgData);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save('invoice.pdf');

                    // Restore original styles
                    contentElements.forEach(el => {
                        const originalStyle = originalStyles.get(el);
                        if (originalStyle) {
                            const htmlEl = el as HTMLElement;
                            htmlEl.style.border = originalStyle.border;
                            htmlEl.style.outline = originalStyle.outline;
                            htmlEl.contentEditable = originalStyle.contentEditable;
                        }
                    });

                    // Restore edit elements visibility
                    editElements.forEach(el => {
                        (el as HTMLElement).style.display = '';
                    });

                    // Restore table inputs
                    inputOriginalParents.forEach((innerHTML, cell) => {
                        cell.innerHTML = innerHTML;
                    });
                });
            }, 100);
        }
    }

    getItems(): FormArray {
        return this.invoiceForm.get('items') as FormArray;
    }

    calculateTotal(): number {
        let total = 0;
        const items = this.getItems();

        for (let i = 0; i < items.length; i++) {
            const item = items.at(i);
            const quantity = item.get('quantity')?.value || 0;
            const rate = item.get('rate')?.value || 0;
            total += quantity * rate;
        }

        return total;
    }

    getBackgroundStyle(): SafeStyle {
        if (this.layout === 'creative') {
            // For creative layout, use the custom background color
            return this.sanitizer.bypassSecurityTrustStyle(`linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), url('/assets/images/template${this.templateId}.jpg'); background-color: ${this.backgroundColor};`);
        }
        return this.sanitizer.bypassSecurityTrustStyle(`linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), url('/assets/images/template${this.templateId}.jpg')`);
    }

    getHeaderStyle() {
        console.log('Applying header color:', this.headerColor);
        return {
            'background-color': this.headerColor || '#3f51b5',
            'color': this.getContrastColor(this.headerColor || '#3f51b5')
        };
    }

    // Helper method to get contrast color (white or black) based on background
    getContrastColor(hexColor: string): string {
        // Remove hash if it exists
        hexColor = hexColor.replace('#', '');

        // Convert to RGB
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);

        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return white for dark colors, black for light colors
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    addTableSection(): void {
        const newSection: CustomSection = {
            id: 'section-' + Date.now(),
            title: 'Table Section',
            content: '',
            color: '#f5f5f5',
            type: 'table',
            columns: [...this.defaultColumns],
            rows: []
        };
        this.customSections.push(newSection);
    }

    updateTableColumn(section: CustomSection, columnIndex: number, newValue: string): void {
        if (section.columns && section.columns[columnIndex] !== undefined) {
            section.columns[columnIndex] = newValue;
        }
    }

    removeTableColumn(section: CustomSection, columnIndex: number): void {
        if (section.columns && section.columns.length > 1) {
            section.columns.splice(columnIndex, 1);
            // Also remove the corresponding data from all rows
            if (section.rows) {
                section.rows.forEach(row => {
                    const keys = Object.keys(row);
                    if (keys[columnIndex]) {
                        delete row[keys[columnIndex]];
                    }
                });
            }
        }
    }

    addTableColumn(section: CustomSection): void {
        if (section.columns) {
            section.columns.push(`Column ${section.columns.length + 1}`);
        }
    }

    addTableRow(section: CustomSection): void {
        if (section.columns) {
            const newRow: { [key: string]: string } = {};
            section.columns.forEach(col => {
                newRow[col] = '';
            });
            if (!section.rows) {
                section.rows = [];
            }
            section.rows.push(newRow);
        }
    }

    removeTableRow(section: CustomSection, rowIndex: number): void {
        if (section.rows && section.rows.length > 0) {
            section.rows.splice(rowIndex, 1);
        }
    }

    updateSectionType(section: CustomSection, newType: 'normal' | 'table'): void {
        section.type = newType;
        if (newType === 'table' && !section.columns) {
            section.columns = [...this.defaultColumns];
            section.rows = [];
        }
    }

    selectTemplate(template: any): void {
        // Route to the invoice creator with the selected template
        this.router.navigate(['/create'], {
            queryParams: {
                templateId: template.id,
                color: template.color,
                layout: template.layout
            }
        });
    }

    // New method to ensure layout classes are applied correctly
    applyLayoutClass(): void {
        console.log('Applying layout class for:', this.layout);

        const invoiceTemplate = document.querySelector('.invoice-template') as HTMLElement;
        if (!invoiceTemplate) return;

        // Remove all existing layout classes
        const layoutClasses = [
            'classic-template',
            'modern-template',
            'creative-template',
            'minimal-template',
            'real-estate-template',
            'blue-professional-template',
            'business-pro-template'
        ];

        layoutClasses.forEach(cls => {
            invoiceTemplate.classList.remove(cls);
        });

        // Add the proper layout class
        let classToAdd = 'classic-template'; // Default

        switch (this.layout) {
            case 'classic':
                classToAdd = 'classic-template';
                break;
            case 'modern':
                classToAdd = 'modern-template';
                break;
            case 'creative':
                classToAdd = 'creative-template';
                break;
            case 'minimal':
                classToAdd = 'minimal-template';
                break;
            case 'real-estate':
                classToAdd = 'real-estate-template';
                break;
            case 'blue-professional':
                classToAdd = 'blue-professional-template';
                break;
            case 'business-pro':
                classToAdd = 'business-pro-template';
                break;
            default:
                console.log('Unknown layout:', this.layout, 'defaulting to classic');
                classToAdd = 'classic-template';
        }

        console.log('Adding class:', classToAdd);
        invoiceTemplate.classList.add(classToAdd);

        // Additional layout-specific setup
        if (this.layout === 'blue-professional') {
            // Apply header color to match the screenshot design
            this.headerColor = '#1a237e';
            this.updateHeaderColor();

            // Update totals area
            const totalSection = invoiceTemplate.querySelector('.invoice-totals') as HTMLElement;
            if (totalSection) {
                totalSection.style.textAlign = 'right';
            }
        }

        // Apply text color immediately
        this.updateTextColor();
    }

    loadTemplateLayout(): void {
        console.log('Loading template layout for ID:', this.templateId);

        // Store current edit mode state
        const wasInEditMode = this.isEditMode;

        // If in edit mode, temporarily exit it
        if (wasInEditMode) {
            // We don't want to show notifications when just switching templates
            const tempIsEditMode = this.isEditMode;
            this.isEditMode = false;
            this.currentEditingElement = null;
        }

        // Reset template content before loading new template
        this.resetTemplateContent();

        // Reset the customSections array
        this.customSections = [];

        // Load the selected template by template ID
        switch (this.templateId) {
            case 1:
                this.loadClassicLayout();
                this.layout = 'classic';
                break;
            case 2:
                this.loadModernLayout();
                this.layout = 'modern';
                break;
            case 3:
                this.loadCreativeLayout();
                this.layout = 'creative';
                break;
            case 4:
                this.loadRealEstateLayout();
                this.layout = 'real-estate';
                break;
            case 5:
                this.loadBusinessProLayout();
                this.layout = 'business-pro';
                break;
            case 6:
                this.loadBlueProfessionalLayout();
                this.layout = 'blue-professional';
                break;
            case 7:
                this.loadThankYouLayout();
                this.layout = 'thank-you';
                break;
            case 8:
                this.loadBlackWhiteLayout();
                this.layout = 'black-white';
                break;
            default:
                // Default to classic layout if no match
                this.loadClassicLayout();
                this.layout = 'classic';
                break;
        }

        // Update the form with the layout value
        this.invoiceForm.patchValue({
            layout: this.layout
        });

        // Apply template content to DOM
        this.applyTemplateContent();
        this.applyLayoutClass();

        // If was previously in edit mode, re-enter it after template loads
        if (wasInEditMode) {
            // Wait for template to render
            setTimeout(() => {
                this.isEditMode = true;
                // Apply editable attributes and drag handles
                this.applyContentEditableToElements();
                this.applyDragHandlesToElements();
            }, 200);
        }
    }

    loadClassicLayout(): void {
        // Traditional layout with formal header and conventional invoice sections
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['company-name'] = 'Your Company Name';
        this.templateContent['company-person'] = 'Your Name';
        this.templateContent['company-email'] = 'your.email@example.com';
        this.templateContent['company-phone'] = '(123) 456-7890';
        this.templateContent['company-address'] = '123 Street Address, City, State ZIP';
        this.templateContent['property-title'] = 'Bill To';
        this.templateContent['invoice-number'] = 'Invoice #: INV-' + this.getRandomInvoiceNumber();
        this.templateContent['invoice-date'] = 'Date: ' + new Date().toLocaleDateString();
        this.templateContent['due-date'] = 'Due Date: ' + new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString();
        this.templateContent['col-desc'] = 'ITEM DESCRIPTION';
        this.templateContent['col-qty'] = 'QUANTITY';
        this.templateContent['col-rate'] = 'UNIT PRICE';
        this.templateContent['col-amount'] = 'AMOUNT';
        this.templateContent['total-label'] = 'TOTAL';
        this.templateContent['payment-terms'] = 'Payment Terms: Net 30';
        this.templateContent['payment-methods'] = 'Payment Methods: Check, Credit Card, Bank Transfer';
        this.templateContent['footer-text'] = 'Thank you for your business!';
        this.templateContent['notes'] = 'Notes: Any additional information, terms, or conditions.';
    }

    loadModernLayout(): void {
        // Contemporary layout with bold styling
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['company-name'] = 'Your Company Name';
        this.templateContent['company-person'] = 'FROM';
        this.templateContent['company-email'] = 'your.email@example.com';
        this.templateContent['company-phone'] = '(123) 456-7890';
        this.templateContent['company-address'] = '123 Street Address, City, State ZIP';
        this.templateContent['property-title'] = 'TO';
        this.templateContent['invoice-number'] = '#INV-' + this.getRandomInvoiceNumber();
        this.templateContent['invoice-date'] = 'Issued: ' + new Date().toLocaleDateString();
        this.templateContent['due-date'] = 'Due: ' + new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString();
        this.templateContent['project-title'] = 'PROJECT: Client Project';
        this.templateContent['col-desc'] = 'SERVICE';
        this.templateContent['col-qty'] = 'HOURS/QTY';
        this.templateContent['col-rate'] = 'RATE';
        this.templateContent['col-amount'] = 'AMOUNT';
        this.templateContent['total-label'] = 'TOTAL DUE';
        this.templateContent['footer-text'] = 'Terms: Payment due within 30 days of receipt\nThank you for your business!';

        // Add a payment details custom section - this is better than using templateContent for more structured content
        this.customSections.push({
            id: 'section-' + Date.now(),
            title: 'PAYMENT DETAILS',
            content: 'Bank Name: [Bank Name]\nAccount Name: [Account Name]\nAccount Number: [Account Number]\nRouting Number: [Routing Number]\n\nOr pay online: [Payment Link]',
            color: '#f8f9fa',
            type: 'normal'
        });
    }

    loadCreativeLayout(): void {
        // Artistic layout with unique sections and focus on drag-drop and color customization
        this.headerColor = '#8e44ad'; // Purple color for creative template
        this.backgroundColor = '#f9f9ff'; // Light purple tint
        this.textColor = '#333333';

        this.templateContent['header-title'] = '⚡ CREATIVE INVOICE ⚡';
        this.templateContent['company-name'] = 'Your Awesome Creative Business';
        this.templateContent['company-person'] = 'HELLO,';
        this.templateContent['company-email'] = 'creative@example.com';
        this.templateContent['company-phone'] = '(123) 456-7890';
        this.templateContent['company-address'] = '123 Imagination Lane, Creativity City';
        this.templateContent['property-title'] = 'PROJECT FOR';
        this.templateContent['invoice-number'] = 'INVOICE #: ' + this.getRandomInvoiceNumber();
        this.templateContent['invoice-date'] = 'DATE: ' + new Date().toLocaleDateString();
        this.templateContent['section-title'] = 'THE AWESOME WORK WE DID FOR YOU';
        this.templateContent['col-desc'] = 'CREATIVE SERVICE';
        this.templateContent['col-qty'] = 'MAGIC DELIVERED';
        this.templateContent['col-rate'] = 'VALUE PER UNIT';
        this.templateContent['col-amount'] = 'TOTAL MAGIC';
        this.templateContent['total-label'] = 'THE GRAND TOTAL';
        this.templateContent['footer-text'] = 'THANK YOU FOR CHOOSING OUR CREATIVE SERVICES!\nPayment due within 14 days • Questions? creative@example.com';

        // Add creative sections
        this.customSections.push({
            id: 'section-' + Date.now(),
            title: 'SEND YOUR MAGIC PAYMENT TO',
            content: '✧ Digital Payment: [Payment Link/QR Code]\n✧ By Carrier Pigeon: [Your Address]\n✧ Telepathically: Just kidding! But we accept credit cards, PayPal, and bank transfers.',
            color: '#e8e4f3',
            type: 'normal'
        });
    }

    loadMinimalLayout(): void {
        // Clean, simplified layout
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['footer-text'] = 'Thank you';
        // Minimal layout has no additional sections
    }

    getLayoutStyle(): SafeStyle {
        let styles = '';

        switch (this.layout) {
            case 'modern':
                styles = `
                    .invoice-header { padding: 30px; }
                    .invoice-header h1 { font-size: 3rem; font-weight: 700; }
                    .company-info { background-color: #f9f9f9; padding: 20px; }
                `;
                break;
            case 'creative':
                styles = `
                    .invoice-header { 
                        border-radius: 15px; 
                        transition: all 0.3s ease; 
                    }
                    .invoice-header:hover { 
                        box-shadow: 0 0 15px rgba(0,0,0,0.1); 
                    }
                    .invoice-template { 
                        background-color: #fafafa; 
                        padding: 20px;
                    }
                    .custom-section { 
                        border-radius: 10px; 
                        box-shadow: 0 4px 8px rgba(0,0,0,0.05);
                        transition: transform 0.3s ease, box-shadow 0.3s ease;
                        margin: 15px 0;
                        padding: 15px;
                    }
                    .custom-section:hover { 
                        box-shadow: 0 8px 16px rgba(0,0,0,0.1);
                    }
                    [contentEditable="true"]:hover {
                        cursor: text;
                        background-color: rgba(255,255,255,0.8);
                    }
                    .edit-overlay {
                        opacity: 0.6;
                    }
                    .edit-overlay:hover {
                        opacity: 1;
                    }
                    .company-info, .client-info {
                        transition: all 0.3s ease;
                        border-radius: 8px;
                        padding: 15px;
                    }
                    .company-info:hover, .client-info:hover {
                        background-color: rgba(255,255,255,0.8);
                        box-shadow: 0 4px 8px rgba(0,0,0,0.05);
                    }
                    .invoice-footer {
                        border-radius: 8px;
                        transition: all 0.3s ease;
                    }
                    .invoice-footer:hover {
                        background-color: rgba(255,255,255,0.8);
                    }
                    .items-table {
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    .custom-sections-container {
                        min-height: 100px;
                        position: relative;
                    }

                    .custom-section {
                        cursor: move;
                        transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
                    }

                    .custom-section:hover {
                        box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2),
                                   0 8px 10px 1px rgba(0, 0, 0, 0.14),
                `;
                break;
            case 'minimal':
                styles = `
                    .invoice-header { padding: 15px; }
                    .invoice-header h1 { font-weight: 400; letter-spacing: 2px; }
                    .items-table th, .items-table td { padding: 8px; }
                `;
                break;
        }

        return this.sanitizer.bypassSecurityTrustStyle(styles);
    }

    getTransform(elementId: string): string {
        if (this.elementPositions[elementId]) {
            const pos = this.elementPositions[elementId];
            return `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        }
        return '';
    }

    // Save current invoice
    saveInvoice(): void {
        if (this.invoiceForm.valid) {
            // Get form values
            const formValues = this.invoiceForm.getRawValue();

            // Create or update the current invoice object
            if (!this.currentInvoice) {
                this.currentInvoice = {
                    id: 'invoice_' + Date.now(),
                    name: formValues.name,
                    email: formValues.email,
                    address: formValues.address,
                    phone: formValues.phone,
                    business: formValues.business,
                    propertyName: formValues.propertyName,
                    items: formValues.items,
                    total: this.calculateTotal(),
                    date: new Date(),
                    invoiceNumber: this.invoiceNumber || this.generateInvoiceNumber(),
                    templateId: this.templateId,
                    headerColor: this.headerColor,
                    backgroundColor: this.backgroundColor,
                    textColor: this.textColor,
                    layout: this.layout,
                    templateContent: { ...this.templateContent },
                    elementPositions: { ...this.elementPositions },
                    customSections: JSON.parse(JSON.stringify(this.customSections)),
                    customTemplateId: this.customTemplateId,
                    fontFamily: this.customTemplate?.fontFamily,
                    accentColor: this.customTemplate?.accentColor,
                    notes: '',
                    elementSettings: { ...this.elementSettings }
                };
            } else {
                // Update existing invoice
                this.currentInvoice.name = formValues.name;
                this.currentInvoice.email = formValues.email;
                this.currentInvoice.address = formValues.address;
                this.currentInvoice.phone = formValues.phone;
                this.currentInvoice.business = formValues.business;
                this.currentInvoice.propertyName = formValues.propertyName;
                this.currentInvoice.items = formValues.items;
                this.currentInvoice.total = this.calculateTotal();
                this.currentInvoice.templateId = this.templateId;
                this.currentInvoice.headerColor = this.headerColor;
                this.currentInvoice.backgroundColor = this.backgroundColor;
                this.currentInvoice.textColor = this.textColor;
                this.currentInvoice.layout = this.layout;
                this.currentInvoice.templateContent = { ...this.templateContent };
                this.currentInvoice.elementPositions = { ...this.elementPositions };
                this.currentInvoice.customSections = JSON.parse(JSON.stringify(this.customSections));
                this.currentInvoice.customTemplateId = this.customTemplateId;
                this.currentInvoice.fontFamily = this.customTemplate?.fontFamily;
                this.currentInvoice.accentColor = this.customTemplate?.accentColor;
                this.currentInvoice.elementSettings = { ...this.elementSettings };
            }

            // Calculate the amount for each item
            this.currentInvoice.items.forEach(item => {
                item.amount = item.quantity * item.rate;
            });

            // Save the invoice
            this.invoiceService.saveInvoice(this.currentInvoice);

            // Show a success message with snackbar
            this.snackBar.open('Invoice saved successfully!', 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
            });
        } else {
            // Show an error message if the form is invalid
            this.snackBar.open('Please correct the errors in the form before saving.', 'Close', {
                duration: 5000,
                panelClass: ['error-snackbar']
            });

            // Mark all fields as touched to show validation errors
            Object.keys(this.invoiceForm.controls).forEach(field => {
                const control = this.invoiceForm.get(field);
                control?.markAsTouched({ onlySelf: true });
            });
        }
    }

    // Call this method after downloading PDF
    downloadPdfAndSave(): void {
        this.saveInvoice();
        this.downloadPdf();
        // Reset data after downloading to prevent persistence
        this.resetAllData();
    }

    // Add these new color picker methods
    openHeaderColorPicker(): void {
        // Find the hidden color input and click it
        const colorInput = document.querySelector('input[type="color"]#headerColorInput') as HTMLInputElement;
        if (colorInput) {
            colorInput.click();
        }
    }

    openBgColorPicker(): void {
        // Find the hidden color input and click it
        const colorInput = document.querySelector('input[type="color"]#bgColorInput') as HTMLInputElement;
        if (colorInput) {
            colorInput.click();
        }
    }

    openTextColorPicker(): void {
        // Find the hidden color input and click it
        const colorInput = document.querySelector('input[type="color"]#textColorInput') as HTMLInputElement;
        if (colorInput) {
            colorInput.click();
        }
    }

    onHeaderColorChange(color: string): void {
        this.headerColor = color;
        this.updateHeaderColor();
    }

    onBgColorChange(color: string): void {
        this.backgroundColor = color;
        this.updateBackgroundColor();
    }

    onTextColorChange(color: string): void {
        this.textColor = color;
        this.updateTextColor();
    }

    // Save invoice and navigate to home
    saveInvoiceAndNavigate(): void {
        if (this.invoiceForm.valid) {
            this.saveInvoice();
            // Reset data after saving to prevent persistence
            this.resetAllData();
            this.router.navigate(['/home']);
        } else {
            this.snackBar.open('Please fill in all required fields before saving.', 'Close', {
                duration: 3000,
                panelClass: ['error-snackbar']
            });
        }
    }

    // Apply template content to DOM elements
    applyTemplateContent(): void {
        // Apply saved content to editable elements
        setTimeout(() => {
            Object.keys(this.templateContent).forEach(elementId => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.innerText = this.templateContent[elementId];
                }
            });

            // After applying content, also apply element positions for creative layout
            if (this.layout === 'creative') {
                this.applyElementPositions();
            }
        }, 100); // Small delay to ensure DOM elements are available
    }

    // New method to apply element positions
    applyElementPositions(): void {
        console.log('Applying element positions for layout:', this.layout);

        // Apply positions with a delay to ensure DOM elements are rendered
        setTimeout(() => {
            Object.keys(this.elementPositions).forEach(elementId => {
                // Try direct ID lookup first
                let element = document.getElementById(elementId);

                // If not found, try alternative lookups for dynamic elements
                if (!element) {
                    // For custom sections, try finding by data attribute
                    const customSectionMatch = elementId.match(/^section-(\d+)/);
                    if (customSectionMatch) {
                        const sections = document.querySelectorAll('.custom-section');
                        const index = parseInt(customSectionMatch[1], 10);
                        if (sections && sections.length > index) {
                            element = sections[index] as HTMLElement;
                        }
                    }
                }

                if (element && this.elementPositions[elementId]) {
                    const pos = this.elementPositions[elementId];
                    // Apply transform directly to element style
                    element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0px)`;
                    console.log(`Applied position to ${elementId}:`, pos);

                    // Also tag element with data attribute for debugging
                    element.setAttribute('data-positioned', `x:${pos.x},y:${pos.y}`);
                } else {
                    console.warn(`Could not find element for ID: ${elementId}`);
                }
            });
        }, 100);
    }

    // Helper method to reapply template after drag operations
    reapplyTemplateAfterDrag(): void {
        // Apply immediate transform changes to maintain visual stability
        Object.keys(this.elementPositions).forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element && this.elementPositions[elementId]) {
                const pos = this.elementPositions[elementId];
                element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0px)`;
                console.log(`Directly applied position to ${elementId}:`, pos);
            }
        });

        // Longer delay to ensure DOM is fully updated
        setTimeout(() => {
            this.applyLayoutClass();
            this.applyTemplateContent();

            // Apply element positions again after template content is reapplied
            setTimeout(() => {
                this.applyElementPositions();

                // One final direct application of transforms for stability
                Object.keys(this.elementPositions).forEach(elementId => {
                    const element = document.getElementById(elementId);
                    if (element && this.elementPositions[elementId]) {
                        const pos = this.elementPositions[elementId];
                        element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0px)`;
                    }
                });
            }, 100);
        }, 300);
    }

    loadCustomTemplate(customTemplateId: string): void {
        const template = this.invoiceService.getCustomTemplateById(customTemplateId);
        if (template) {
            console.log('Loading custom template with full details:', template);

            this.customTemplate = template;

            // Apply template properties - make sure layout is properly set
            this.headerColor = template.headerColor || '#3f51b5';
            this.backgroundColor = template.backgroundColor || '#ffffff';
            this.textColor = template.textColor || '#000000';

            // Apply typography settings
            if (template.fontFamily) {
                document.documentElement.style.setProperty('--invoice-font-family', template.fontFamily);
                console.log('Applied custom font family:', template.fontFamily);
            }

            // Apply accent color if available
            if (template.accentColor) {
                document.documentElement.style.setProperty('--accent-color', template.accentColor);
                console.log('Applied accent color:', template.accentColor);
            }

            // Ensure layout is properly set from template
            if (template.layout) {
                this.layout = template.layout;
                console.log('Layout explicitly set to:', this.layout);
            } else {
                // Default to classic if no layout is specified
                this.layout = 'classic';
                console.log('No layout in template, defaulting to:', this.layout);
            }

            // Apply layout before proceeding to ensure proper structure
            this.applyLayoutClass();

            // Update the form with the new layout value and colors
            if (this.invoiceForm) {
                this.invoiceForm.patchValue({
                    layout: this.layout,
                    headerColor: this.headerColor,
                    backgroundColor: this.backgroundColor,
                    textColor: this.textColor
                }, { emitEvent: false });
            }

            // Apply template content
            this.templateContent = { ...template.templateContent };
            this.elementPositions = { ...template.elementPositions };
            this.customSections = [...template.customSections || []];

            // Apply element settings (visibility, position, etc.)
            if (template.elementSettings) {
                console.log('Applying element settings from template:', template.elementSettings);
                this.elementSettings = JSON.parse(JSON.stringify(template.elementSettings));
            }

            // Apply the content to the DOM
            this.applyTemplateContent();

            // Update colors and layout immediately
            this.updateHeaderColor();
            this.updateBackgroundColor();
            this.updateTextColor();
            this.applyTypographySettings();

            // Apply settings after a delay to ensure DOM is properly updated
            setTimeout(() => {
                console.log('Re-applying layout class and settings');
                this.applyLayoutClass();
                this.applyElementSettings();
                this.applyTypographySettings();

                // Force DOM update for any elements with positioning
                Object.keys(this.elementPositions).forEach(elementId => {
                    const element = document.getElementById(elementId);
                    if (element && this.elementPositions[elementId]) {
                        const pos = this.elementPositions[elementId];
                        element.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
                    }
                });

                // One final color update to ensure they're properly applied
                this.updateHeaderColor();
                this.updateBackgroundColor();
                this.updateTextColor();
            }, 500);
        } else {
            console.error('Failed to load custom template with ID:', customTemplateId);
            // If template not found, default to classic layout
            this.layout = 'classic';
            this.applyLayoutClass();
        }
    }

    // Updated method to apply typography settings
    applyTypographySettings(): void {
        console.log('Applying typography settings from template');

        const invoiceTemplate = document.getElementById('invoice-template');
        if (!invoiceTemplate) return;

        // Apply font family if specified
        if (this.customTemplate?.fontFamily) {
            invoiceTemplate.style.fontFamily = this.customTemplate.fontFamily;
            document.documentElement.style.setProperty('--invoice-font-family', this.customTemplate.fontFamily);
            console.log('Applied font family:', this.customTemplate.fontFamily);
        }

        // Apply accent color if specified
        if (this.customTemplate?.accentColor) {
            invoiceTemplate.style.setProperty('--accent-color', this.customTemplate.accentColor);
            console.log('Applied accent color:', this.customTemplate.accentColor);

            // Apply accent color to specific elements, excluding business name
            const accentElements = invoiceTemplate.querySelectorAll(
                '.invoice-header, .section-title h3, .total-label, .total-amount'
            );

            accentElements.forEach(el => {
                if (el.classList.contains('invoice-header')) return; // Skip header, already colored

                // Skip business name elements that should use text color
                if (el.id === 'business-name' ||
                    el.id === 'company-name' ||
                    el.classList.contains('company-name')) {
                    return;
                }

                (el as HTMLElement).style.color = this.customTemplate.accentColor || '#f44336';
            });

            // Make sure business name elements keep the default text color
            setTimeout(() => {
                const businessElements = document.querySelectorAll(
                    '#business-name, #company-name, .company-name, .invoice-companyInfo h2, .preview-company-info h3'
                );
                businessElements.forEach((element) => {
                    (element as HTMLElement).style.color = this.textColor;
                });
            }, 50);
        }
    }

    // Add method to handle drop events for reordering sections
    onDrop(event: CdkDragDrop<any[]>): void {
        console.log('Drop event triggered', event);

        if (!this.isEditMode) {
            console.log('Not in edit mode, ignoring drop');
            return;
        }

        console.log('Processing drop event', {
            previousIndex: event.previousIndex,
            currentIndex: event.currentIndex
        });

        // Move the item in the array
        moveItemInArray(
            this.customSections,
            event.previousIndex,
            event.currentIndex
        );

        console.log('Sections reordered:', this.customSections.map(s => s.title));

        // Update positions for all sections
        this.customSections.forEach((section, index) => {
            if (!this.elementPositions[section.id]) {
                this.elementPositions[section.id] = { x: 0, y: 0 };
            }
            // Keep x position but update y position based on index
            const previousY = this.elementPositions[section.id].y;
            this.elementPositions[section.id] = {
                x: this.elementPositions[section.id].x,
                y: index * 60 // Add more vertical spacing between sections for better visibility
            };
            console.log(`Updated section ${section.title} position from y=${previousY} to y=${this.elementPositions[section.id].y}`);
        });

        // Reapply template to ensure positioning is maintained
        this.reapplyTemplateAfterDrag();
    }

    loadLayoutTemplate(layoutTemplateValue: string): void {
        console.log('Loading layout template:', layoutTemplateValue);

        // Reset template content
        this.resetTemplateContent();

        // Update form layout value
        this.invoiceForm.patchValue({
            layout: layoutTemplateValue
        });

        // Load appropriate layout
        switch (layoutTemplateValue) {
            case 'classic':
                this.loadClassicLayout();
                break;
            case 'modern':
                this.loadModernLayout();
                break;
            case 'creative':
                this.loadCreativeLayout();
                break;
            case 'real-estate':
                this.loadRealEstateLayout();
                break;
            case 'black-white':
                this.loadBlackWhiteLayout();
                break;
            default:
                this.loadClassicLayout();
                break;
        }

        // Apply layout class
        this.applyLayoutClass();

        // Apply template content
        this.applyTemplateContent();
    }

    // Add this new method to reset all data
    resetAllData(): void {
        console.log('Resetting all template and form data');

        // Reset form to initial values
        this.initForm();

        // Reset template-related properties
        this.templateContent = {};
        this.elementPositions = {};
        this.customSections = [];
        this.currentEditingElement = null;
        this.itemContent = {};

        // Reset colors to defaults
        this.headerColor = '#3f51b5';
        this.backgroundColor = '#ffffff';
        this.textColor = '#000000';

        // Reset layout
        this.layout = 'classic';

        // Reset template IDs
        this.templateId = 1;
        this.customTemplateId = null;
        this.isCustomTemplate = false;
        this.customTemplate = null;

        // Reset other properties
        this.invoiceNumber = this.generateInvoiceNumber();

        // Clear current invoice
        this.currentInvoice = null;
        this.invoiceService.clearCurrentInvoice();

        // Reset element settings (with only allowed properties)
        this.elementSettings = {
            header: { visible: true, alignment: 'center' },
            logo: { visible: true, alignment: 'left', size: 'medium' },
            companyInfo: { visible: true, alignment: 'left' },
            clientInfo: { visible: true, alignment: 'right' },
            invoiceDetails: { visible: true, alignment: 'right' },
            itemsTable: { visible: true },
            totalSection: { visible: true, alignment: 'right' },
            notes: { visible: true, alignment: 'left' },
            footer: { visible: true, alignment: 'center' }
        };

        // Turn off edit mode
        this.isEditMode = false;

        console.log('All data has been reset');
    }

    startListening(): void {
        if (this.recognition) {
            try {
                if (this.isListening) {
                    // If already listening, stop the recognition
                    this.stopListening();
                    return;
                }

                this.recognition.start();
                this.isListening = true;
                this.snackBar.open('Listening for voice commands (continuous mode)...', 'Stop', {
                    duration: 10000,
                    panelClass: ['info-snackbar']
                });

                // Show voice commands help if it hasn't been shown before
                if (!localStorage.getItem('voiceHelpShown')) {
                    this.showVoiceHelp = true;
                    localStorage.setItem('voiceHelpShown', 'true');
                }
            } catch (error) {
                console.error('Speech recognition error:', error);
                this.snackBar.open('Could not start voice recognition. Try again.', 'Close', {
                    duration: 3000
                });
            }
        } else {
            this.snackBar.open('Voice recognition not supported in this browser', 'Close', {
                duration: 3000,
                panelClass: ['error-snackbar']
            });
        }
    }

    stopListening(): void {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            this.snackBar.open('Voice recognition stopped', 'Close', {
                duration: 3000,
                panelClass: ['info-snackbar']
            });
        }
    }

    processVoiceCommand(command: string): void {
        // Show the recognized command to the user
        this.snackBar.open(`Command recognized: "${command}"`, 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
        });

        // Process basic commands
        if (command.includes('add item') || command.includes('new item')) {
            this.addNewItem();
        } else if (command.includes('save invoice') || command.includes('save')) {
            this.saveInvoice();
        } else if (command.includes('download') || command.includes('pdf')) {
            this.downloadPdf();
        } else if (command.includes('customize') || command.includes('edit mode')) {
            this.toggleEditMode();
        } else if (command.includes('delete item') || command.includes('remove item')) {
            // Remove the last item if there are multiple
            const items = this.getItems();
            if (items.length > 1) {
                this.removeItem(items.length - 1);
            } else {
                this.snackBar.open('Cannot remove the last item', 'Close', {
                    duration: 3000
                });
            }
        } else if (command.includes('go to home') || command.includes('go home')) {
            this.router.navigate(['/home']);
        } else if (command.includes('preview') || command.includes('show preview')) {
            // Scroll to preview section
            const previewElement = document.getElementById('invoice-template');
            if (previewElement) {
                previewElement.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (command.includes('stop listening') || command.includes('stop recognition')) {
            this.stopListening();
        }
        // Advanced commands for filling in invoice details
        else if (command.includes('set company name')) {
            // Extract the company name after "set company name"
            const companyName = command.replace('set company name', '').trim();
            if (companyName) {
                // Find and update the company name field
                this.setTextContent('business-name', companyName);
                this.snackBar.open(`Company name set to: ${companyName}`, 'Close', { duration: 3000 });
            }
        }
        else if (command.includes('set client name')) {
            // Extract the client name after "set client name"
            const clientName = command.replace('set client name', '').trim();
            if (clientName) {
                // Find and update the client name field
                this.setTextContent('client-name', clientName);
                this.snackBar.open(`Client name set to: ${clientName}`, 'Close', { duration: 3000 });
            }
        }
        else if (command.includes('set item description')) {
            // Get the last item
            const items = this.getItems();
            if (items.length > 0) {
                const lastIndex = items.length - 1;
                const description = command.replace('set item description', '').trim();
                if (description) {
                    // Update the last item's description
                    this.setItemContent(lastIndex, 'description', description);
                    this.snackBar.open(`Item description set to: ${description}`, 'Close', { duration: 3000 });
                }
            }
        }
        else if (command.match(/set (quantity|rate) \d+/)) {
            // Handle commands like "set quantity 5" or "set rate 100"
            const match = command.match(/set (quantity|rate) (\d+)/);
            if (match && match.length === 3) {
                const field = match[1];
                const value = parseInt(match[2], 10);

                const items = this.getItems();
                if (items.length > 0) {
                    const lastIndex = items.length - 1;
                    this.setItemContent(lastIndex, field, value.toString());
                    this.onItemValueChange();
                    this.snackBar.open(`Item ${field} set to: ${value}`, 'Close', { duration: 3000 });
                }
            }
        }
        else if (command.includes('show help')) {
            this.showVoiceHelp = true;
        }
        else {
            this.snackBar.open(`Command not recognized: "${command}"`, 'Close', {
                duration: 3000,
                panelClass: ['warning-snackbar']
            });
        }
    }

    // Helper method to set text content of an element
    setTextContent(elementId: string, content: string): void {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerText = content;
            // Also update the stored content
            this.templateContent[elementId] = content;
        }
    }

    // Helper method to set item content
    setItemContent(index: number, field: string, value: string): void {
        const elementId = `item-${field}-${index}`;
        const element = document.getElementById(elementId);
        if (element) {
            element.innerText = value;
            // Also update the form
            const items = this.getItems();
            const item = items.at(index);
            if (item) {
                // Convert to number if it's a numeric field
                if (field === 'quantity' || field === 'rate') {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        item.get(field)?.setValue(numValue);
                    }
                } else {
                    item.get(field)?.setValue(value);
                }
            }
        }
    }

    loadRealEstateLayout(): void {
        // Real Estate specialized invoice layout
        this.headerColor = '#34495e';
        this.backgroundColor = '#ffffff';
        this.textColor = '#333333';

        console.log('Loading Real Estate Layout');

        // Set template content for real estate invoice
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['company-name'] = 'Prime Estate';
        this.templateContent['company-person'] = 'Your Name';
        this.templateContent['company-email'] = 'info@primeestate.com';
        this.templateContent['company-phone'] = '(123) 456-7890';
        this.templateContent['company-address'] = '123 Real Estate Blvd, City, State ZIP';
        this.templateContent['property-title'] = 'Bill to:';
        this.templateContent['invoice-number'] = 'Invoice Number: 846';
        this.templateContent['invoice-date'] = 'Date: 02/02/2022';

        // Real Estate specific invoice summary fields
        this.templateContent['summary-title'] = 'Invoice Summary';
        this.templateContent['agreement-value-label'] = 'Agreement Value';
        this.templateContent['agreement-value-amount'] = '₹ 1,111,000';
        this.templateContent['parking-charges-label'] = 'Car Parking Charges';
        this.templateContent['parking-charges-amount'] = '₹ 50,000';
        this.templateContent['addon-charges-label'] = 'Add-on Charges';
        this.templateContent['addon-charges-amount'] = '₹ 20,000';
        this.templateContent['subtotal-label'] = 'Subtotal';
        this.templateContent['subtotal-amount'] = '₹ 1,181,000';
        this.templateContent['discount-label'] = 'Discount (Cashback)';
        this.templateContent['discount-amount'] = '-₹ 11,000';
        this.templateContent['net-payable-label'] = 'Net Payable';
        this.templateContent['net-payable-amount'] = '₹ 1,170,000';
        this.templateContent['token-paid-label'] = 'Token Amount Paid';
        this.templateContent['token-paid-amount'] = '₹ 200,000';
        this.templateContent['balance-amount-label'] = 'Balance Amount';
        this.templateContent['balance-amount-amount'] = '₹ 970,000';

        // Table columns
        this.templateContent['col-desc'] = 'Item';
        this.templateContent['col-qty'] = 'Quantity';
        this.templateContent['col-rate'] = 'Rate';
        this.templateContent['col-tax'] = 'Tax';
        this.templateContent['col-amount'] = 'Amount';

        this.templateContent['terms-title'] = 'Terms & Conditions:';
        this.templateContent['footer-text'] = 'Thank you for your business!';

        // Set default items for real estate invoice
        const items = this.invoiceForm.get('items') as FormArray;
        while (items.length) {
            items.removeAt(0);
        }

        // Add real estate specific items
        this.addItem('Vacation Homes', 1, 137.00);
        this.addItem('Home Staging', 1, 752.00);
        this.addItem('Real Estate Photography', 1, 110.00);

        // Update element settings
        this.updateElementSettings({
            header: { visible: true, position: 'top' },
            logo: { visible: true, position: 'left' },
            companyInfo: { visible: true, position: 'left' },
            clientInfo: { visible: true, position: 'right' },
            invoiceDetails: { visible: true, position: 'left' },
            propertyInfo: { visible: true, position: 'right' },
            itemsTable: { visible: true, position: 'full-width' },
            totalSection: { visible: true, position: 'right' },
            notes: { visible: true, position: 'left' },
            footer: { visible: true, position: 'full-width' }
        });

        // Apply layout class
        this.layout = 'real-estate';
        this.applyLayoutClass();

        // Apply template content after a short delay
        setTimeout(() => {
            this.applyTemplateContent();
        }, 100);
    }

    // Helper method to add items
    addItem(description: string, quantity: number, rate: number): void;
    addItem(description: string, detailedDescription: string | number, quantity?: number, rate?: number): void {
        const items = this.invoiceForm.get('items') as FormArray;

        // Handle both 3 and 4 parameter cases
        if (typeof detailedDescription === 'number') {
            // Original 3-parameter version (description, quantity, rate)
            const qty = detailedDescription;
            const r = quantity as number;
            items.push(this.fb.group({
                description: [description, Validators.required],
                detailedDescription: [''],
                quantity: [qty, [Validators.required, Validators.min(1)]],
                rate: [r, [Validators.required, Validators.min(0)]],
                amount: [qty * r]
            }));
        } else {
            // New 4-parameter version (description, detailedDescription, quantity, rate)
            items.push(this.fb.group({
                description: [description, Validators.required],
                detailedDescription: [detailedDescription || ''],
                quantity: [quantity, [Validators.required, Validators.min(1)]],
                rate: [rate, [Validators.required, Validators.min(0)]],
                amount: [(quantity as number) * (rate as number)]
            }));
        }
    }

    // Method to update element settings (visibility, position, etc.)
    updateElementSettings(settings: any): void {
        // Store new settings
        this.elementSettings = { ...this.elementSettings, ...settings };

        // If we have a current invoice, update its elementSettings
        if (this.currentInvoice && this.currentInvoice.elementSettings) {
            this.currentInvoice.elementSettings = { ...this.currentInvoice.elementSettings, ...settings };
        } else if (this.currentInvoice) {
            this.currentInvoice.elementSettings = { ...settings };
        }

        // Apply settings to DOM after a short delay to ensure changes are processed
        setTimeout(() => this.applyElementSettings(), 100);
    }

    // Add loadBlueProfessionalLayout method to implement the new template
    loadBlueProfessionalLayout(): void {
        console.log('Loading Blue Professional layout');

        // Reset any existing template content
        this.templateContent = {};

        // Set default colors
        this.headerColor = '#1a237e'; // Navy blue
        this.backgroundColor = '#ffffff';
        this.textColor = '#000000';

        // Update layout class
        this.layout = 'blue-professional';

        // Update the form value
        this.invoiceForm.patchValue({
            layout: this.layout
        }, { emitEvent: false });

        // Set company details
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['company-name'] = 'Aldenaire & Partners';
        this.templateContent['company-email'] = 'hello@yourcompany.com';
        this.templateContent['company-phone'] = '+123-456-7890';
        this.templateContent['company-address'] = '123 Anywhere St, Any City, ST 12345';

        // Set invoice details
        this.templateContent['invoice-number'] = 'INVOICE NO: ' + (this.invoiceNumber || '1234');
        this.templateContent['invoice-date'] = '17th May, 2022';

        // Set client information
        this.templateContent['bill-to-title'] = 'Invoice to:';
        this.templateContent['client-name'] = 'Yael Amari';
        this.templateContent['client-email'] = 'hello@reallygreatsite.com';
        this.templateContent['client-address'] = '123 Anywhere St, Any City, ST 12345';

        // Set table headers
        this.templateContent['col-desc'] = 'Description';
        this.templateContent['col-qty'] = 'Qty';
        this.templateContent['col-rate'] = 'Cost';
        this.templateContent['col-amount'] = 'Subtotal';

        // Set payment details
        this.templateContent['payment-title'] = 'PAYMENT DETAILS:';
        this.templateContent['bank-code'] = 'Bank Code:';
        this.templateContent['bank-code-value'] = '123-456-7890';
        this.templateContent['bank-name'] = 'Bank Name:';
        this.templateContent['bank-name-value'] = 'Fauget Bank';

        // Set contact section
        this.templateContent['contact-title'] = 'CONTACT US';
        this.templateContent['contact-phone'] = '+123-456-7890';
        this.templateContent['contact-website'] = 'www.reallygreatsite.com';
        this.templateContent['contact-address'] = '123 Anywhere St, Any City, ST 12345';

        // Set totals and footer
        this.templateContent['subtotal-label'] = 'Subtotal';
        this.templateContent['tax-label'] = 'Tax';
        this.templateContent['total-label'] = 'TOTAL';
        this.templateContent['thanks-message'] = 'Thank You!';
        this.templateContent['signature-title'] = 'Administrator';

        // Add sample items
        const items = this.getItems();
        // Clear existing items
        while (items.length > 0) {
            items.removeAt(0);
        }

        // Add sample items matching the screenshot
        this.addItem('Initial Consultation', 5, 300.00);
        this.addItem('Project Draft', 2, 500.00);
        this.addItem('Implementation', 1, 12000.00);
        this.addItem('Foundation Labor', 30, 60.00);

        // Set element settings
        this.updateElementSettings({
            header: { visible: true, alignment: 'left' },
            logo: { visible: true, size: 'medium', alignment: 'left' },
            companyInfo: { visible: true, alignment: 'left' },
            clientInfo: { visible: true, alignment: 'right' },
            invoiceDetails: { visible: true, alignment: 'left' },
            itemsTable: { visible: true },
            totalSection: { visible: true, alignment: 'right' },
            notes: { visible: false },
            footer: { visible: true, alignment: 'center', content: 'Thank you for your business!' }
        });

        // Apply all settings to DOM
        this.applyTemplateContent();
    }

    // Add Business Pro layout implementation
    loadBusinessProLayout(): void {
        console.log('Loading Business Pro layout');

        // Reset any existing template content
        this.templateContent = {};

        // Set default colors
        this.headerColor = '#673ab7'; // Purple
        this.backgroundColor = '#ffffff';
        this.textColor = '#000000';

        // Update layout class
        this.layout = 'business-pro';

        // Update the form value
        this.invoiceForm.patchValue({
            layout: this.layout
        }, { emitEvent: false });

        // Set company details
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['company-name'] = 'Business Pro Services';
        this.templateContent['company-email'] = 'accounts@businesspro.com';
        this.templateContent['company-phone'] = '+123-456-7890';
        this.templateContent['company-address'] = '123 Business St, Corporate City, ST 12345';
        this.templateContent['company-gstin'] = 'GSTIN: 29ABCDE1234F1Z5';

        // Set invoice details
        this.templateContent['invoice-number'] = 'Invoice #: INV-' + (this.invoiceNumber || '001');
        this.templateContent['invoice-date'] = 'Date: ' + new Date().toLocaleDateString();
        this.templateContent['due-date'] = 'Due Date: ' + new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();

        // Set client information
        this.templateContent['bill-to-title'] = 'Bill To:';
        this.templateContent['client-name'] = 'Client Name';
        this.templateContent['client-email'] = 'client@example.com';
        this.templateContent['client-address'] = 'Client Address, City, State';

        // Set table headers
        this.templateContent['col-desc'] = 'Item/Service';
        this.templateContent['col-hsn'] = 'HSN/SAC';
        this.templateContent['col-qty'] = 'Quantity';
        this.templateContent['col-rate'] = 'Rate';
        this.templateContent['col-tax'] = 'GST %';
        this.templateContent['col-amount'] = 'Amount';
        this.templateContent['col-total'] = 'Total';

        // Set totals and footer
        this.templateContent['subtotal-label'] = 'Subtotal';
        this.templateContent['tax-label'] = 'GST (18%)';
        this.templateContent['total-label'] = 'TOTAL';
        this.templateContent['terms-title'] = 'Terms & Conditions';
        this.templateContent['terms-content'] = '1. Payment due within 30 days\n2. Please include invoice number with payment\n3. Late payment subject to 2% interest per month';

        // Add sample items
        const items = this.getItems();
        // Clear existing items
        while (items.length > 0) {
            items.removeAt(0);
        }

        // Add sample items
        this.addItem('Consulting Services', 10, 120.00);
        this.addItem('Software Development', 15, 150.00);

        // Set element settings
        this.updateElementSettings({
            header: { visible: true, alignment: 'center' },
            logo: { visible: true, size: 'medium', alignment: 'left' },
            companyInfo: { visible: true, alignment: 'left' },
            clientInfo: { visible: true, alignment: 'right' },
            invoiceDetails: { visible: true, alignment: 'right' },
            itemsTable: { visible: true },
            totalSection: { visible: true, alignment: 'right' },
            notes: { visible: true, alignment: 'left' },
            footer: { visible: true, alignment: 'center', content: 'Thank you for your business!' }
        });

        // Apply all settings to DOM
        this.applyTemplateContent();
    }

    loadThankYouLayout(): void {
        console.log('Loading Thank You invoice layout');

        // Set the layout type
        this.layout = 'thank-you';

        // Set header content
        this.templateContent['header-title'] = 'THANK YOU';

        // Set the footer text
        this.templateContent['footer-text'] = 'We appreciate your business!';

        // Set column headers for items table
        this.templateContent['col-desc'] = 'ITEM DESCRIPTION';
        this.templateContent['col-qty'] = 'QTY';
        this.templateContent['col-rate'] = 'RATE';
        this.templateContent['col-amount'] = 'AMOUNT';

        // Set total label
        this.templateContent['total-label'] = 'TOTAL';

        // Clear existing items and add sample items
        const itemsArray = this.invoiceForm.get('items') as FormArray;
        if (itemsArray.length === 0) {
            // Only add sample items if no items exist
            this.addItem('Your Product or Service', 1, 100);
        }

        // Set element settings for this layout
        this.updateElementSettings({
            header: { visible: true, position: 'top' },
            logo: { visible: true, size: 'medium', alignment: 'left' },
            companyInfo: { visible: true, alignment: 'right' },
            clientInfo: { visible: true, alignment: 'left' },
            invoiceDetails: { visible: true, style: 'standard', position: 'right' },
            itemsTable: { visible: true, style: 'clean' },
            totalSection: { visible: true, alignment: 'right' },
            notes: { visible: true, position: 'bottom' },
            footer: { visible: true, content: 'We appreciate your business!' }
        });

        // Apply all settings to DOM
        this.applyTemplateContent();
    }

    loadBlackWhiteLayout(): void {
        console.log('Loading Black and White Modern Professional Layout');

        // Set the layout
        this.layout = 'black-white';

        // Set header color to black
        this.headerColor = '#000000';
        this.backgroundColor = '#ffffff';
        this.textColor = '#000000';

        // Set template content
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['company-name'] = 'Professional Business Services';
        this.templateContent['company-email'] = 'accounting@profbusiness.com';
        this.templateContent['company-phone'] = '+1 (555) 123-4567';
        this.templateContent['company-address'] = '123 Corporate Plaza, Suite 500, New York, NY 10001';

        // Date and invoice number
        const invoiceNumber = 'INV-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.templateContent['invoice-number'] = 'Invoice #: ' + invoiceNumber;
        this.templateContent['invoice-date'] = 'Date: ' + new Date().toLocaleDateString();
        this.templateContent['due-date'] = 'Due Date: ' + new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString();

        // Client information
        this.templateContent['client-title'] = 'BILL TO:';
        this.templateContent['client-name'] = 'Client Corporation';
        this.templateContent['client-email'] = 'finance@clientcorp.com';
        this.templateContent['client-phone'] = '+1 (555) 987-6543';
        this.templateContent['client-address'] = '456 Enterprise Avenue, Los Angeles, CA 90001';

        // Table headers
        this.templateContent['col-desc'] = 'DESCRIPTION';
        this.templateContent['col-qty'] = 'QTY';
        this.templateContent['col-rate'] = 'RATE';
        this.templateContent['col-amount'] = 'AMOUNT';

        // Terms and footer
        this.templateContent['terms-title'] = 'TERMS & CONDITIONS';
        this.templateContent['terms-content'] = 'Please make all payments to Professional Business Services. A late fee of 2% will be applied to overdue invoices.';
        this.templateContent['footer-text'] = 'Thank you for your business!';

        // Clear existing items
        const items = this.invoiceForm.get('items') as FormArray;
        while (items.length > 0) {
            items.removeAt(0);
        }

        // Add sample items with the original 3-parameter method to avoid errors
        this.addItem('Professional Consulting Services', 40, 150);
        this.addItem('Document Preparation', 1, 750);
        this.addItem('Software Implementation', 1, 1200);

        // Update element settings
        this.updateElementSettings({
            header: { visible: true, position: 'top' },
            logo: { visible: false },
            companyInfo: { visible: true, alignment: 'left' },
            clientInfo: { visible: true, alignment: 'right' },
            invoiceDetails: { visible: true, position: 'right' },
            itemsTable: { visible: true },
            totalSection: { visible: true, alignment: 'right' },
            notes: { visible: true },
            footer: { visible: true, content: 'Thank you for your business!' }
        });

        // Apply layout class
        this.applyLayoutClass();

        // Apply template content after a short delay
        setTimeout(() => {
            this.applyTemplateContent();
        }, 100);
    }

    // Add missing methods
    resetTemplateContent(): void {
        this.templateContent = {};
        this.elementPositions = {};
        this.customSections = [];
        this.currentEditingElement = null;
        this.itemContent = {};
    }

    setFooterText(header: string, footer: string): void {
        this.headerText = header;
        this.footerText = footer;

        // Update template content
        if (header) {
            this.templateContent['header-text'] = header;
        }
        if (footer) {
            this.templateContent['footer-text'] = footer;
        }
    }

    manageFooterVisibility(footerText: string): void {
        const footerElement = document.querySelector('.invoice-footer');
        if (footerElement) {
            if (footerText && footerText.trim().length > 0) {
                footerElement.classList.remove('force-hide');
                this.elementSettings.footer.visible = true;
            } else {
                footerElement.classList.add('force-hide');
                this.elementSettings.footer.visible = false;
            }
        }
    }
} 