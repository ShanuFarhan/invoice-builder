import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  isDestructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ data.cancelButtonText || 'Cancel' }}</button>
        <button 
          mat-raised-button 
          [color]="data.isDestructive ? 'warn' : 'primary'" 
          [mat-dialog-close]="true">
          {{ data.confirmButtonText || 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 16px;
    }
    h2 {
      margin-top: 0;
      font-size: 20px;
      font-weight: 500;
    }
    mat-dialog-content {
      min-width: 300px;
      padding: 16px 0;
      font-size: 16px;
    }
    mat-dialog-actions {
      margin-bottom: 0;
      padding: 8px 0;
      justify-content: flex-end;
    }
    button {
      margin-left: 8px;
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) { }
} 