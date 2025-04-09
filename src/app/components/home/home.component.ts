import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Invoice, InvoiceService } from '../../services/invoice.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
    userName: string = '';
    savedInvoices: Invoice[] = [];

    constructor(
        private router: Router,
        private authService: AuthService,
        private invoiceService: InvoiceService
    ) { }

    // Reload invoices when the user comes back to this page
    @HostListener('window:focus', ['$event'])
    onFocus(event: FocusEvent): void {
        this.loadSavedInvoices();
    }

    ngOnInit(): void {
        this.authService.user$.subscribe(user => {
            this.userName = user?.email?.split('@')[0] || 'User';
        });

        // Load saved invoices
        this.loadSavedInvoices();
    }

    loadSavedInvoices(): void {
        this.savedInvoices = this.invoiceService.getAllInvoices();
        // Sort invoices by date (newest first)
        this.savedInvoices.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });
    }

    createNewInvoice(): void {
        // Clear any current invoice data
        this.invoiceService.clearCurrentInvoice();
        this.router.navigate(['/invoice']);
    }

    editInvoice(invoice: Invoice): void {
        // Set the current invoice for editing
        this.invoiceService.setCurrentInvoice(invoice);
        this.router.navigate(['/invoice']);
    }

    viewInvoice(invoice: Invoice): void {
        // Set the current invoice for viewing
        this.invoiceService.setCurrentInvoice(invoice);

        // Navigate to the invoice creator with the right parameters
        this.router.navigate(['/create'], {
            queryParams: {
                // Include these parameters to ensure the layout loads properly
                templateId: invoice.templateId || 1,
                layout: invoice.layout || 'classic'
            }
        });
    }

    deleteInvoice(id: string, event: Event): void {
        event.stopPropagation(); // Prevent triggering the card click
        if (confirm('Are you sure you want to delete this invoice?')) {
            this.invoiceService.deleteInvoice(id);
            this.loadSavedInvoices(); // Reload the list
        }
    }

    navigateToTemplates(): void {
        this.router.navigate(['/templates']);
    }

    // Format the date for display
    formatDate(date: Date): string {
        return new Date(date).toLocaleString();
    }
} 