import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { Component, HostListener, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Invoice, InvoiceService } from '../../services/invoice.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    animations: [
        trigger('fadeIn', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('600ms ease-in', style({ opacity: 1 })),
            ]),
        ]),
        trigger('listAnimation', [
            transition('* => *', [
                query(':enter', [
                    style({ opacity: 0, transform: 'translateY(15px)' }),
                    stagger(100, [
                        animate('500ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
                    ]),
                ], { optional: true }),
            ]),
        ]),
    ],
})
export class HomeComponent implements OnInit {
    userName: string = '';
    savedInvoices: Invoice[] = [];
    isLoading: boolean = true;

    constructor(
        private router: Router,
        private authService: AuthService,
        private invoiceService: InvoiceService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar
    ) { }

    // Reload invoices when the user comes back to this page
    @HostListener('window:focus', ['$event'])
    onFocus(event: FocusEvent): void {
        this.loadSavedInvoices();
    }

    ngOnInit(): void {
        this.isLoading = true;

        this.authService.user$.subscribe(user => {
            this.userName = user?.email?.split('@')[0] || 'User';
        });

        // Load saved invoices with a slight delay to show animations
        setTimeout(() => {
            this.loadSavedInvoices();
            this.isLoading = false;
        }, 300);
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

    deleteInvoice(invoiceId: string): void {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '350px',
            data: {
                title: 'Delete Invoice',
                message: 'Are you sure you want to delete this invoice? This action cannot be undone.',
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                isDestructive: true
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                // Before deleting, make sure to clear any current invoice to prevent navigation
                this.invoiceService.clearCurrentInvoice();

                // Delete the invoice
                this.invoiceService.deleteInvoice(invoiceId);

                // Reload invoices
                this.loadSavedInvoices();

                // Show success message
                this.snackBar.open('Invoice successfully deleted', 'Close', {
                    duration: 3000,
                    panelClass: ['success-snackbar']
                });
            }
        });
    }

    navigateToTemplates(): void {
        this.router.navigate(['/templates']);
    }

    createCustomTemplate(): void {
        this.router.navigate(['/template/create']);
    }

    // Format the date for display
    formatDate(date: Date): string {
        return new Date(date).toLocaleString();
    }
} 