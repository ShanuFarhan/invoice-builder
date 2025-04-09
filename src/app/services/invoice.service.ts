import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface InvoiceItem {
    description: string;
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
    // Template customization properties
    templateId?: number;
    headerColor?: string;
    backgroundColor?: string;
    textColor?: string;
    layout?: string;
    templateContent?: { [key: string]: string };
    elementPositions?: { [key: string]: { x: number, y: number } };
    customSections?: any[];
}

@Injectable({
    providedIn: 'root'
})
export class InvoiceService {
    private currentInvoiceSubject = new BehaviorSubject<Invoice | null>(null);
    currentInvoice$ = this.currentInvoiceSubject.asObservable();

    private invoices: Invoice[] = [];

    constructor() {
        // Load saved invoices from localStorage if available
        this.loadInvoicesFromStorage();
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
        // Ensure the invoice has an ID
        if (!invoice.id) {
            invoice.id = 'invoice_' + Date.now();
        }

        // Ensure the invoice has a date
        if (!invoice.date) {
            invoice.date = new Date();
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
} 