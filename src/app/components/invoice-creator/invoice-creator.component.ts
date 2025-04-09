import { Component, ElementRef, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import * as html2canvas from 'html2canvas';
import * as jsPDF from 'jspdf';
import { Invoice, InvoiceService } from '../../services/invoice.service';

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
export class InvoiceCreatorComponent implements OnInit {
    invoiceForm: FormGroup;
    templateId: number = 1;
    headerColor: string = '#3f51b5'; // Default color
    backgroundColor: string = '#ffffff'; // Default background color
    textColor: string = '#000000'; // Default text color
    today: Date = new Date();
    Math: any = Math; // Add Math as a class property
    invoiceNumber: string; // Store invoice number as a property
    currentInvoice: Invoice | null = null;

    // Template customization properties
    isEditMode: boolean = false;
    templateContent: TemplateContent = {};
    elementPositions: { [key: string]: { x: number, y: number } } = {};
    currentEditingElement: string | null = null;
    itemContent: { [key: string]: any } = {};
    customSections: CustomSection[] = [];
    defaultColumns: string[] = ['Column 1', 'Column 2', 'Column 3'];
    layout: string = 'classic'; // Add this property to the class

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private fb: FormBuilder,
        private sanitizer: DomSanitizer,
        private elementRef: ElementRef,
        private invoiceService: InvoiceService
    ) {
        this.invoiceForm = this.fb.group({
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            address: ['', Validators.required],
            phone: ['', Validators.required],
            business: ['', Validators.required],
            propertyName: ['', Validators.required],
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
    }

    ngOnInit(): void {
        // First load invoice data if available
        this.loadInvoiceData();

        // Then apply URL parameters if provided (they will override the invoice data)
        this.route.queryParams.subscribe(params => {
            if (params['templateId']) {
                this.templateId = +params['templateId'];
            }
            if (params['color']) {
                this.headerColor = params['color'];
            }
            if (params['layout']) {
                this.layout = params['layout'];
            }

            // Load default layout content if needed
            if (!this.currentInvoice) {
                this.loadTemplateLayout();
                this.loadSavedTemplate();
            }
        });
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
        }
    }

    // Toggle edit mode for template customization
    toggleEditMode(): void {
        this.isEditMode = !this.isEditMode;
        if (!this.isEditMode) {
            // Clean up when exiting edit mode
            this.currentEditingElement = null;
        }
    }

    // Edit element content - can be triggered by click anywhere in the element
    editElement(elementId: string): void {
        if (!this.isEditMode) return;

        this.currentEditingElement = elementId;
        const element = document.getElementById(elementId);
        if (element) {
            // Save current text if not already saved
            if (!this.templateContent[elementId]) {
                this.templateContent[elementId] = element.innerText;
            }

            // Focus the element for editing
            element.focus();

            // Place cursor at the end of the text
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(element);
            range.collapse(false); // false means collapse to end
            sel?.removeAllRanges();
            sel?.addRange(range);
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
            this.templateContent[elementId] = element.innerText;
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
    }

    // Remove an item from the invoice
    removeItem(index: number): void {
        const items = this.getItems();
        if (items.length > 1) {
            items.removeAt(index);
        } else {
            alert('You must have at least one item in the invoice.');
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
        // The color is already bound with ngModel, no need to do anything else
        // This method is here for any additional processing if needed
    }

    // Update text color
    updateTextColor(): void {
        // Apply text color to all text elements
        const textElements = document.querySelectorAll('.invoice-template p, .invoice-template h1, .invoice-template h2, .invoice-template h3, .invoice-template td, .invoice-template th');
        textElements.forEach(el => {
            (el as HTMLElement).style.color = this.textColor;
        });
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

        // Show success message
        alert('Template saved successfully!');
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
        if (!this.elementPositions[elementId]) {
            this.elementPositions[elementId] = { x: 0, y: 0 };
        }

        // Get transform values
        const transform = event.source.element.nativeElement.style.transform;
        const regex = /translate3d\((-?\d+)px, (-?\d+)px, 0px\)/;
        const match = transform.match(regex);

        if (match) {
            this.elementPositions[elementId] = {
                x: parseInt(match[1], 10),
                y: parseInt(match[2], 10)
            };
        }
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
        return {
            'background-color': this.headerColor
        };
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

    loadTemplateLayout(): void {
        console.log('Loading template layout:', this.templateId);
        // Reset to default
        this.templateContent = {};
        this.customSections = [];

        switch (this.templateId) {
            case 1:
                this.layout = 'classic';
                this.loadClassicLayout();
                break;
            case 2:
                this.layout = 'modern';
                this.loadModernLayout();
                break;
            case 3:
                this.layout = 'creative';
                this.loadCreativeLayout();
                break;
            case 4:
                this.layout = 'minimal';
                this.loadMinimalLayout();
                break;
            default:
                this.layout = 'classic';
                this.loadClassicLayout();
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
        this.templateContent['payment-details'] = 'PAYMENT DETAILS';
        this.templateContent['bank-info'] = 'Bank Name: [Bank Name]\nAccount Name: [Account Name]\nAccount Number: [Account Number]\nRouting Number: [Routing Number]';
        this.templateContent['payment-link'] = 'Or pay online: [Payment Link]';
        this.templateContent['footer-text'] = 'Terms: Payment due within 30 days of receipt\nThank you for your business!';

        // Add a payment details custom section
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

    // getTransform(elementId: string): string {
    //     if (this.templateId === 3 && this.elementPositions[elementId]) {
    //         const pos = this.elementPositions[elementId];
    //         return `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    //     }
    //     return '';
    // }

    // // Add this method to handle the drop event
    // onDrop(event: CdkDragDrop<CustomSection[]>): void {
    //     if (this.templateId === 3) {
    //         moveItemInArray(
    //             this.customSections,
    //             event.previousIndex,
    //             event.currentIndex
    //         );

    //         // Update positions after reordering
    //         this.customSections.forEach((section, index) => {
    //             if (!this.elementPositions[section.id]) {
    //                 this.elementPositions[section.id] = { x: 0, y: 0 };
    //             }
    //             this.elementPositions[section.id] = {
    //                 x: this.elementPositions[section.id].x,
    //                 y: index * 20 // Add some vertical spacing between items
    //             };
    //         });
    //     }
    // }

    // Save current invoice
    saveInvoice(): void {
        // Create or update the invoice
        const formValues = this.invoiceForm.value;

        // Generate items with calculated amounts
        const items = this.getItems().controls.map(control => {
            const item = control.value;
            return {
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.quantity * item.rate
            };
        });

        // Create the invoice object
        const invoice: Invoice = {
            id: this.currentInvoice?.id || 'invoice_' + Date.now(),
            name: formValues.name,
            email: formValues.email,
            address: formValues.address,
            phone: formValues.phone,
            business: formValues.business,
            propertyName: formValues.propertyName,
            items: items,
            total: this.calculateTotal(),
            date: new Date(),
            invoiceNumber: this.invoiceNumber,
            // Include template customization properties
            templateId: this.templateId,
            headerColor: this.headerColor,
            backgroundColor: this.backgroundColor,
            textColor: this.textColor,
            layout: this.layout,
            templateContent: { ...this.templateContent },
            elementPositions: { ...this.elementPositions },
            customSections: [...this.customSections]
        };

        // Save the invoice
        this.invoiceService.saveInvoice(invoice);

        // Update the current invoice
        this.currentInvoice = invoice;
        this.invoiceService.setCurrentInvoice(invoice);

        // Show success message
        alert('Invoice saved successfully!');
    }

    // Call this method after downloading PDF
    downloadPdfAndSave(): void {
        this.downloadPdf();
        this.saveInvoice();
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
        this.saveInvoice();
        this.router.navigate(['/home']);
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
        }, 100); // Small delay to ensure DOM elements are available
    }
} 