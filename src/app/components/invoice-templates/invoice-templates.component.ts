import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

interface Template {
    id: number;
    name: string;
    image: string;
    color: string;
    description: string;
    layout: 'classic' | 'modern' | 'minimal' | 'creative';
    features: string[];
}

@Component({
    selector: 'app-invoice-templates',
    templateUrl: './invoice-templates.component.html',
    styleUrls: ['./invoice-templates.component.scss']
})
export class InvoiceTemplatesComponent implements OnInit {
    templates: Template[] = [
        {
            id: 1,
            name: 'Professional Classic',
            image: '/assets/images/template1.jpg',
            color: '#3f51b5',
            description: 'Traditional business invoice with a clean, professional layout',
            layout: 'classic',
            features: ['Company header', 'Detailed item table', 'Payment terms section', 'Professional footer']
        },
        {
            id: 2,
            name: 'Modern Business',
            image: '/assets/images/template2.jpg',
            color: '#673ab7',
            description: 'Contemporary design with modern typography and spacing',
            layout: 'modern',
            features: ['Bold header', 'Minimalist item layout', 'Custom sections support']
        },
        {
            id: 3,
            name: 'Creative Studio',
            image: '/assets/images/template3.jpg',
            color: '#2196f3',
            description: 'Artistic layout perfect for creative professionals',
            layout: 'creative',
            features: ['Drag and Drop Functionality', 'Custom section layouts', 'Modern color scheme', 'Creative typography']
        },
    ];

    constructor(private router: Router) { }

    ngOnInit(): void {
    }

    selectTemplate(template: Template): void {
        // Route to the invoice creator with the selected template
        this.router.navigate(['/create'], {
            queryParams: {
                templateId: template.id,
                color: template.color
            }
        });
    }
} 