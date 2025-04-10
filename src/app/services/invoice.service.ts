import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface InvoiceItem {
    description: string;
    detailedDescription?: string;
    quantity: number;
    rate: number;
    amount: number;
}

export interface Invoice {
    id: string;
    name: string;
    email: string;
    address: string;
    phone: string;
    business: string;
    propertyName: string;
    items: InvoiceItem[];
    total: number;
    date: Date;
    invoiceNumber: string;
    notes: string;
    // Template customization properties
    templateId?: number;
    headerColor?: string;
    backgroundColor?: string;
    textColor?: string;
    layout?: string;
    fontFamily?: string;
    accentColor?: string;
    templateContent?: { [key: string]: string };
    elementPositions?: { [key: string]: { x: number, y: number } };
    customSections?: any[];
    // Custom template reference
    customTemplateId?: string | null;
    // Element settings for visibility and positioning
    elementSettings?: {
        header?: { visible?: boolean, position?: string },
        logo?: { visible?: boolean, size?: string },
        companyInfo?: { visible?: boolean, alignment?: string },
        clientInfo?: { visible?: boolean, alignment?: string },
        invoiceDetails?: { visible?: boolean, style?: string },
        propertyInfo?: { visible?: boolean, position?: string },
        itemsTable?: { visible?: boolean, style?: string },
        totalSection?: { visible?: boolean, alignment?: string },
        notes?: { visible?: boolean, position?: string },
        footer?: { visible?: boolean, content?: string }
    };
}

export interface CustomTemplate {
    id: string;
    name: string;
    description: string;
    thumbnailUrl?: string;
    createdDate: Date;
    lastModified: Date;
    isCustom: boolean;
    layout: string;
    headerColor: string;
    backgroundColor: string;
    textColor: string;
    accentColor?: string;
    fontFamily?: string;
    templateContent: { [key: string]: string };
    elementPositions: { [key: string]: { x: number, y: number } };
    customSections: any[];
    elementSettings?: {
        header?: { visible: boolean, position: string },
        logo?: { visible: boolean, size: string },
        companyInfo?: { visible: boolean, alignment: string },
        clientInfo?: { visible: boolean, alignment: string },
        invoiceDetails?: { visible: boolean, style: string },
        itemsTable?: { visible: boolean, style: string },
        totalSection?: { visible: boolean, alignment: string },
        notes?: { visible: boolean, position: string },
        footer?: { visible: boolean, content: string }
    };
}

@Injectable({
    providedIn: 'root'
})
export class InvoiceService {
    private currentInvoiceSubject = new BehaviorSubject<Invoice | null>(null);
    currentInvoice$ = this.currentInvoiceSubject.asObservable();

    private invoices: Invoice[] = [];
    private customTemplates: CustomTemplate[] = [];

    constructor() {
        // Load saved invoices from localStorage if available
        this.loadInvoicesFromStorage();
        this.loadCustomTemplatesFromStorage();
    }

    // Load invoices from localStorage
    private loadInvoicesFromStorage(): void {
        const savedInvoices = localStorage.getItem('invoices');
        if (savedInvoices) {
            try {
                this.invoices = JSON.parse(savedInvoices);

                // Process invoices to ensure all properties are correct
                this.invoices = this.invoices.map(invoice => {
                    // Convert string dates to Date objects
                    const processedInvoice = {
                        ...invoice,
                        date: new Date(invoice.date)
                    };

                    // Ensure template properties are properly initialized if missing
                    if (!processedInvoice.templateId) processedInvoice.templateId = 1;
                    if (!processedInvoice.layout) processedInvoice.layout = 'classic';
                    if (!processedInvoice.headerColor) processedInvoice.headerColor = '#3f51b5';
                    if (!processedInvoice.backgroundColor) processedInvoice.backgroundColor = '#ffffff';
                    if (!processedInvoice.textColor) processedInvoice.textColor = '#000000';
                    if (!processedInvoice.templateContent) processedInvoice.templateContent = {};
                    if (!processedInvoice.elementPositions) processedInvoice.elementPositions = {};
                    if (!processedInvoice.customSections) processedInvoice.customSections = [];

                    return processedInvoice;
                });
            } catch (e) {
                console.error('Error loading saved invoices:', e);
                // If there's an error, initialize to empty array
                this.invoices = [];
            }
        }
    }

    // Load custom templates from localStorage
    private loadCustomTemplatesFromStorage(): void {
        console.log('Loading custom templates from localStorage');
        const savedTemplates = localStorage.getItem('customTemplates');

        if (savedTemplates) {
            try {
                let templates = JSON.parse(savedTemplates);
                console.log('Found saved templates:', templates.length);

                // Process templates to ensure dates are properly converted
                this.customTemplates = templates.map((template: any) => {
                    return {
                        ...template,
                        createdDate: new Date(template.createdDate),
                        lastModified: new Date(template.lastModified)
                    };
                });

                console.log('Templates loaded successfully');
            } catch (e) {
                console.error('Error loading custom templates:', e);
                this.customTemplates = [];
            }
        } else {
            console.log('No saved templates found in localStorage');
            this.customTemplates = [];
        }
    }

    getCurrentInvoice(): Invoice | null {
        return this.currentInvoiceSubject.value;
    }

    setCurrentInvoice(invoice: Invoice): void {
        this.currentInvoiceSubject.next(invoice);

        // Save to session storage in case user refreshes during the process
        sessionStorage.setItem('currentInvoice', JSON.stringify(invoice));
    }

    generateInvoiceNumber(): string {
        // Generate a random invoice number with INV- prefix
        return 'INV-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    }

    saveInvoice(invoice: Invoice): void {
        console.log('Saving invoice with font family:', invoice.fontFamily);
        console.log('Saving invoice with accent color:', invoice.accentColor);

        // Ensure the invoice has an ID
        if (!invoice.id) {
            invoice.id = 'invoice_' + Date.now();
        }

        // Ensure the invoice has a date
        if (!invoice.date) {
            invoice.date = new Date();
        }

        // Ensure typography properties are preserved
        if (invoice.customTemplateId) {
            const template = this.getCustomTemplateById(invoice.customTemplateId);
            if (template) {
                if (!invoice.fontFamily && template.fontFamily) {
                    invoice.fontFamily = template.fontFamily;
                }
                if (!invoice.accentColor && template.accentColor) {
                    invoice.accentColor = template.accentColor;
                }
            }
        }

        // If the invoice already exists, update it
        const existingIndex = this.invoices.findIndex(inv => inv.id === invoice.id);

        if (existingIndex >= 0) {
            this.invoices[existingIndex] = invoice;
        } else {
            // If it's a new invoice, add it to the array
            this.invoices.push(invoice);
        }

        // Save to localStorage
        localStorage.setItem('invoices', JSON.stringify(this.invoices));

        // Set this as the current invoice
        this.setCurrentInvoice(invoice);
    }

    getAllInvoices(): Invoice[] {
        // Refresh from storage in case it was updated elsewhere
        this.loadInvoicesFromStorage();
        return this.invoices;
    }

    getInvoiceById(id: string): Invoice | undefined {
        return this.invoices.find(invoice => invoice.id === id);
    }

    deleteInvoice(id: string): void {
        this.invoices = this.invoices.filter(invoice => invoice.id !== id);
        localStorage.setItem('invoices', JSON.stringify(this.invoices));
    }

    // Check if there's a saved current invoice in session storage
    loadSavedCurrentInvoice(): Invoice | null {
        const savedInvoice = sessionStorage.getItem('currentInvoice');
        if (savedInvoice) {
            try {
                const invoice = JSON.parse(savedInvoice);
                this.currentInvoiceSubject.next(invoice);
                return invoice;
            } catch (e) {
                console.error('Error loading saved current invoice:', e);
            }
        }
        return null;
    }

    clearCurrentInvoice(): void {
        this.currentInvoiceSubject.next(null);
        sessionStorage.removeItem('currentInvoice');
    }

    // Custom Template Methods
    getAllCustomTemplates(): CustomTemplate[] {
        this.loadCustomTemplatesFromStorage();
        console.log('Returning all custom templates:', this.customTemplates.length);
        return [...this.customTemplates]; // Return a copy to prevent unintended modifications
    }

    getCustomTemplateById(id: string): CustomTemplate | undefined {
        const template = this.customTemplates.find(template => template.id === id);
        console.log(`Template with id ${id} ${template ? 'found' : 'not found'}`);
        return template;
    }

    saveCustomTemplate(template: CustomTemplate): void {
        console.log('Saving custom template:', template.name);

        // Ensure template has required properties
        if (!template.id) {
            template.id = 'template_' + Date.now();
        }

        // Make sure dates are set
        if (!template.createdDate) {
            template.createdDate = new Date();
        }
        template.lastModified = new Date();

        // Ensure all required properties exist
        const validatedTemplate: CustomTemplate = {
            ...template,
            isCustom: true,
            layout: template.layout || 'classic',
            headerColor: template.headerColor || '#3f51b5',
            backgroundColor: template.backgroundColor || '#ffffff',
            textColor: template.textColor || '#000000',
            accentColor: template.accentColor || '#f44336',
            fontFamily: template.fontFamily || 'Roboto, sans-serif',
            templateContent: template.templateContent || {},
            elementPositions: template.elementPositions || {},
            customSections: template.customSections || [],
            elementSettings: template.elementSettings || {
                header: { visible: true, position: 'top' },
                logo: { visible: true, size: 'medium' },
                companyInfo: { visible: true, alignment: 'left' },
                clientInfo: { visible: true, alignment: 'right' },
                invoiceDetails: { visible: true, style: 'standard' },
                itemsTable: { visible: true, style: 'standard' },
                totalSection: { visible: true, alignment: 'right' },
                notes: { visible: true, position: 'bottom' },
                footer: { visible: true, content: 'Thank you for your business!' }
            }
        };

        // Update or add the template
        const existingIndex = this.customTemplates.findIndex(t => t.id === template.id);
        if (existingIndex >= 0) {
            console.log(`Updating existing template at index ${existingIndex}`);
            this.customTemplates[existingIndex] = validatedTemplate;
        } else {
            console.log('Adding new template to collection');
            this.customTemplates.push(validatedTemplate);
        }

        // Save to localStorage
        try {
            localStorage.setItem('customTemplates', JSON.stringify(this.customTemplates));
            console.log('Templates saved to localStorage successfully, count:', this.customTemplates.length);
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            throw new Error('Failed to save template to local storage');
        }
    }

    deleteCustomTemplate(id: string): void {
        this.customTemplates = this.customTemplates.filter(template => template.id !== id);
        localStorage.setItem('customTemplates', JSON.stringify(this.customTemplates));
    }

    // Convert invoice to template
    createTemplateFromInvoice(invoice: Invoice, templateName: string, description: string): CustomTemplate {
        return {
            id: 'template_' + Date.now(),
            name: templateName,
            description: description,
            createdDate: new Date(),
            lastModified: new Date(),
            isCustom: true,
            layout: invoice.layout || 'classic',
            headerColor: invoice.headerColor || '#3f51b5',
            backgroundColor: invoice.backgroundColor || '#ffffff',
            textColor: invoice.textColor || '#000000',
            accentColor: invoice.accentColor || '#f44336',
            fontFamily: invoice.fontFamily || 'Roboto, sans-serif',
            templateContent: invoice.templateContent || {},
            elementPositions: invoice.elementPositions || {},
            customSections: invoice.customSections || [],
            // Default element settings
            elementSettings: {
                header: { visible: true, position: 'top' },
                logo: { visible: true, size: 'medium' },
                companyInfo: { visible: true, alignment: 'left' },
                clientInfo: { visible: true, alignment: 'right' },
                invoiceDetails: { visible: true, style: 'standard' },
                itemsTable: { visible: true, style: 'standard' },
                totalSection: { visible: true, alignment: 'right' },
                notes: { visible: true, position: 'bottom' },
                footer: { visible: true, content: 'Thank you for your business!' }
            }
        };
    }
} 