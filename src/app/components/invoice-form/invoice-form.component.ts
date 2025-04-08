import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
    selector: 'app-invoice-form',
    templateUrl: './invoice-form.component.html',
    styleUrls: ['./invoice-form.component.scss']
})
export class InvoiceFormComponent implements OnInit {
    invoiceForm: FormGroup;

    constructor(
        private fb: FormBuilder,
        private router: Router
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
            // Navigate to the invoice creator page
            this.router.navigate(['/create']);
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