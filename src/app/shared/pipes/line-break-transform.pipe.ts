import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
    name: 'lineBreakTransform'
})
export class LineBreakTransformPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) { }

    transform(value: string): SafeHtml {
        if (!value) return '';

        // Replace newlines with <br> tags
        const withBrs = value.replace(/\n/g, '<br>');

        // Return as safe HTML
        return this.sanitizer.bypassSecurityTrustHtml(withBrs);
    }
} 