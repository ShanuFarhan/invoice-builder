import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Invoice, InvoiceService } from '../../services/invoice.service';

@Component({
    selector: 'app-invoice-form',
    templateUrl: './invoice-form.component.html',
    styleUrls: ['./invoice-form.component.scss']
})
export class InvoiceFormComponent implements OnInit {
    invoiceForm: FormGroup;

    constructor(
        private fb: FormBuilder,
        private router: Router,
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
                this.createItem()
            ])
        });
    }

    ngOnInit(): void {
        // Check if there's a current invoice we're editing
        const currentInvoice = this.invoiceService.getCurrentInvoice();
        if (currentInvoice) {
            this.populateForm(currentInvoice);
        }
    }

    populateForm(invoice: Invoice): void {
        // Set form values from the invoice
        this.invoiceForm.patchValue({
            name: invoice.name,
            email: invoice.email,
            address: invoice.address,
            phone: invoice.phone,
            business: invoice.business,
            propertyName: invoice.propertyName
        });

        // Clear existing items
        const itemsFormArray = this.getItems();
        while (itemsFormArray.length > 0) {
            itemsFormArray.removeAt(0);
        }

        // Add items from the invoice
        invoice.items.forEach(item => {
            itemsFormArray.push(this.fb.group({
                description: [item.description, Validators.required],
                quantity: [item.quantity, [Validators.required, Validators.min(1)]],
                rate: [item.rate, [Validators.required, Validators.min(0)]],
                amount: [{ value: item.amount, disabled: true }]
            }));
        });
    }

    createItem(): FormGroup {
        return this.fb.group({
            description: ['', Validators.required],
            quantity: [1, [Validators.required, Validators.min(1)]],
            rate: [0, [Validators.required, Validators.min(0)]],
            amount: [{ value: 0, disabled: true }]
        });
    }

    getItems(): FormArray {
        return this.invoiceForm.get('items') as FormArray;
    }

    addItem(): void {
        this.getItems().push(this.createItem());
    }

    removeItem(index: number): void {
        this.getItems().removeAt(index);
    }

    updateAmount(index: number): void {
        const items = this.getItems();
        const item = items.at(index);
        const quantity = item.get('quantity')?.value || 0;
        const rate = item.get('rate')?.value || 0;
        const amount = quantity * rate;

        item.get('amount')?.setValue(amount);
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

    onSubmit(): void {
        if (this.invoiceForm.valid) {
            // Get all form data
            const formData = this.invoiceForm.getRawValue();

            // Create invoice object
            const invoice: Invoice = {
                id: crypto.randomUUID(), // Generate a unique ID
                name: formData.name,
                email: formData.email,
                address: formData.address,
                phone: formData.phone,
                business: formData.business,
                propertyName: formData.propertyName,
                items: formData.items.map((item: any) => ({
                    ...item,
                    amount: item.quantity * item.rate
                })),
                total: this.calculateTotal(),
                date: new Date(),
                invoiceNumber: this.invoiceService.generateInvoiceNumber(),
                notes: ''
            };

            // Save invoice to service
            this.invoiceService.setCurrentInvoice(invoice);

            // Navigate to the invoice creator page with template parameters
            this.router.navigate(['/create'], {
                queryParams: {
                    templateId: 1, // Default template
                    color: '#3f51b5', // Default color
                    layout: 'classic' // Default layout
                }
            });
        } else {
            // Mark all fields as touched to show validation errors
            this.markFormGroupTouched(this.invoiceForm);
        }
    }

    markFormGroupTouched(formGroup: FormGroup): void {
        Object.keys(formGroup.controls).forEach(key => {
            const control = formGroup.get(key);

            if (control instanceof FormGroup) {
                this.markFormGroupTouched(control);
            } else {
                control?.markAsTouched();
            }
        });
    }
} 