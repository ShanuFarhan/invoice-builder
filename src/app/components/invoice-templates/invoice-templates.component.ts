import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CustomTemplate, InvoiceService } from '../../services/invoice.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

interface Template {
    id: number;
    name: string;
    image: string;
    color: string;
    description: string;
    layout: 'classic' | 'modern' | 'minimal' | 'creative' | 'real-estate' | 'business-pro' | 'blue-professional' | 'thank-you' | 'black-white';
    features: string[];
}

@Component({
    selector: 'app-invoice-templates',
    templateUrl: './invoice-templates.component.html',
    styleUrls: ['./invoice-templates.component.scss']
})
export class InvoiceTemplatesComponent implements OnInit, OnDestroy {
    templates: Template[] = [
        {
            id: 1,
            name: 'Classic Invoice',
            image: '/assets/images/template1.jpg',
            color: '#3f51b5',
            description: 'Traditional invoice layout with formal design',
            layout: 'classic',
            features: ['Professional formatting', 'Clear sections', 'Traditional invoice layout']
        },
        {
            id: 2,
            name: 'Modern Invoice',
            image: '/assets/images/template2.jpg',
            color: '#2196f3',
            description: 'Contemporary design with clean layout',
            layout: 'modern',
            features: ['Clean lines', 'Minimalist design', 'Modern typography']
        },
        {
            id: 3,
            name: 'Creative Invoice',
            image: '/assets/images/template3.jpg',
            color: '#8e44ad',
            description: 'Artistic layout with unique sections and drag-drop functionality',
            layout: 'creative',
            features: ['Colorful design', 'Drag & drop sections', 'Creative layout']
        },
        {
            id: 4,
            name: 'Real Estate Invoice',
            image: '/assets/images/template4.jpg',
            color: '#34495e',
            description: 'Specialized template for real estate transactions with property details and summary tables',
            layout: 'real-estate',
            features: ['Property details section', 'Agreement summaries', 'Payment breakdown', 'Professional real estate format']
        },
        {
            id: 6,
            name: 'Blue White Modern Professional',
            image: '/assets/images/template6.jpg',
            color: '#1a237e',
            description: 'Professional template with navy blue header, orange accents, and structured layout',
            layout: 'blue-professional',
            features: ['Diagonal design elements', 'Payment details section', 'Clean tabular format', 'Contact information footer']
        },
        {
            id: 5,
            name: 'Business Pro',
            image: '/assets/images/template5.jpg',
            color: '#673ab7',
            description: 'Professional business invoice with tax/GST support for consulting and services',
            layout: 'business-pro',
            features: ['GST/HSN support', 'Digital signature', 'Terms & conditions', 'Multi-currency format']
        },
        {
            id: 7,
            name: 'Thank You Invoice',
            image: '/assets/images/template7.jpg',
            color: '#424242',
            description: 'Elegant minimalist invoice with a personal touch and "Thank You" header',
            layout: 'thank-you',
            features: ['Clean minimalist design', 'Elegant typography', 'Simple item layout', 'Professional summary section']
        },
        {
            id: 8,
            name: 'Black and White Modern Professional',
            image: '/assets/images/template8.jpg',
            color: '#000000',
            description: 'Clean monochromatic design with bold black header and structured layout',
            layout: 'black-white',
            features: ['Bold black header', 'Minimalist design', 'Clean tabular format', 'Professional business style']
        }
    ];

    customTemplates: CustomTemplate[] = [];
    private subscriptions: Subscription = new Subscription();

    constructor(
        private router: Router,
        private invoiceService: InvoiceService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        // Initial load of templates
        this.loadCustomTemplates();

        // Subscribe to router events to refresh templates when navigating to this page
        this.subscriptions.add(
            this.router.events.pipe(
                filter(event => event instanceof NavigationEnd)
            ).subscribe(() => {
                // Only reload if we're viewing the templates page
                if (this.router.url.includes('/templates')) {
                    this.loadCustomTemplates();
                }
            })
        );
    }

    ngOnDestroy(): void {
        // Clean up subscriptions to prevent memory leaks
        this.subscriptions.unsubscribe();
    }

    loadCustomTemplates(): void {
        console.log('Loading custom templates...');
        this.customTemplates = this.invoiceService.getAllCustomTemplates();
        console.log('Loaded templates:', this.customTemplates);
    }

    selectTemplate(template: Template): void {
        // Route to the invoice creator with the selected template
        this.router.navigate(['/create'], {
            queryParams: {
                templateId: template.id,
                color: template.color,
                layout: template.layout
            }
        });
    }

    selectCustomTemplate(template: CustomTemplate): void {
        // Route to the invoice creator with the custom template
        this.router.navigate(['/create'], {
            queryParams: {
                customTemplateId: template.id,
                isCustomTemplate: true,
                layout: template.layout
            }
        });
    }

    createNewTemplate(): void {
        this.router.navigate(['/template/create']);
    }

    editCustomTemplate(template: CustomTemplate): void {
        this.router.navigate(['/template/edit', template.id]);
    }

    deleteTemplate(templateId: string, event: Event): void {
        event.stopPropagation(); // Prevent navigating to template

        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '400px',
            data: {
                title: 'Delete Template',
                message: 'Are you sure you want to delete this template? This action cannot be undone.',
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                isDestructive: true
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.invoiceService.deleteCustomTemplate(templateId);
                this.loadCustomTemplates(); // Reload templates
                this.snackBar.open('Template successfully deleted', 'Close', {
                    duration: 3000,
                    panelClass: ['success-snackbar']
                });
            }
        });
    }

    // Helper method to get contrasting text color (white or black) based on background color
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

    // Helper method to lighten a color by a percentage
    lightenColor(hexColor: string, percent: number): string {
        // Return default color if hexColor is undefined or null
        if (!hexColor) {
            return '#ffffff';
        }

        // Remove hash if it exists
        hexColor = hexColor.replace('#', '');

        // Check if the color is valid hex format
        if (!/^([0-9A-F]{3}){1,2}$/i.test(hexColor)) {
            return '#ffffff';
        }

        // Convert to RGB
        let r = parseInt(hexColor.substr(0, 2), 16);
        let g = parseInt(hexColor.substr(2, 2), 16);
        let b = parseInt(hexColor.substr(4, 2), 16);

        // Lighten
        r = Math.min(255, Math.floor(r * (1 + percent / 100)));
        g = Math.min(255, Math.floor(g * (1 + percent / 100)));
        b = Math.min(255, Math.floor(b * (1 + percent / 100)));

        // Convert back to hex
        const rHex = r.toString(16).padStart(2, '0');
        const gHex = g.toString(16).padStart(2, '0');
        const bHex = b.toString(16).padStart(2, '0');

        return `#${rHex}${gHex}${bHex}`;
    }
} 