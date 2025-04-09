import { Component, OnInit } from '@angular/core';
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

    ngOnInit(): void {
        this.authService.user$.subscribe(user => {
            this.userName = user?.email?.split('@')[0] || 'User';
        });

        // Load saved invoices
        this.loadSavedInvoices();
    }

    loadSavedInvoices(): void {
        this.savedInvoices = this.invoiceService.getAllInvoices();
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
        this.router.navigate(['/create']);
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
} 