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
        const savedInvoices = localStorage.getItem('invoices');
        if (savedInvoices) {
            try {
                this.invoices = JSON.parse(savedInvoices);
            } catch (e) {
                console.error('Error loading saved invoices:', e);
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