import { Component, ElementRef, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import * as html2canvas from 'html2canvas';
import * as jsPDF from 'jspdf';

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
        private elementRef: ElementRef
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

        // Generate invoice number once during initialization
        this.invoiceNumber = this.generateInvoiceNumber();
    }

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            if (params['templateId']) {
                this.templateId = +params['templateId'];
            }
            if (params['color']) {
                this.headerColor = params['color'];
            }
            if (params['layout']) {
                this.layout = params['layout']; // Add this property to the class
            }

            this.loadTemplateLayout(); // New method to load layout-specific content
            this.loadSavedTemplate();
        });
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
                this.loadClassicLayout();
                break;
            case 2:
                this.loadModernLayout();
                break;
            case 3:
                this.loadCreativeLayout();
                break;
            case 4:
                this.loadMinimalLayout();
                break;
            default:
                this.loadClassicLayout();
        }
    }

    loadClassicLayout(): void {
        // Traditional layout with formal header and conventional invoice sections
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['footer-text'] = 'Thank you for your business!';
        // No custom sections by default for classic layout
    }

    loadModernLayout(): void {
        // Contemporary layout with bold styling
        this.templateContent['header-title'] = 'INVOICE';
        this.templateContent['footer-text'] = 'Thank you for choosing our services';

        // Add a text custom section
        this.customSections.push({
            id: 'section-' + Date.now(),
            title: 'Payment Terms',
            content: 'Please make payment within 30 days of receipt.',
            color: '#f0f0f0',
            type: 'normal'  // Changed from 'text' to 'normal'
        });
    }

    loadCreativeLayout(): void {
        // Artistic layout with unique sections and focus on drag-drop and color customization
        this.templateContent['header-title'] = 'CREATIVE INVOICE';
        this.templateContent['footer-text'] = 'Created with passion and precision';

        // Add a single text section that highlights drag-drop capability
        this.customSections.push({
            id: 'section-' + Date.now(),
            title: 'Drag & Customize',
            content: 'This creative template allows you to freely position elements and choose custom colors. Click and drag sections to reposition them, and use the color pickers to create a unique design.',
            color: '#e6f7ff',
            type: 'normal'  // Changed from 'text' to 'normal'
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
} 