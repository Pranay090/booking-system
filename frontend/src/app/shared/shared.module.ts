import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { LoaderComponent } from './components/loader/loader.component';

@NgModule({
    declarations: [
        LoaderComponent
    ],
    imports: [
        CommonModule,
        MatProgressBarModule,
        MatButtonModule,
        MatInputModule,
        MatCardModule,
        MatIconModule,
        MatToolbarModule,
        MatTableModule,
        MatTabsModule,
        MatSelectModule,
        MatSnackBarModule,
        FormsModule,
        ReactiveFormsModule
    ],
    exports: [
        LoaderComponent,
        MatProgressBarModule,
        MatButtonModule,
        MatInputModule,
        MatCardModule,
        MatIconModule,
        MatToolbarModule,
        MatTableModule,
        MatTabsModule,
        MatSelectModule,
        MatSnackBarModule,
        FormsModule,
        ReactiveFormsModule,
        CommonModule
    ]
})
export class SharedModule { }
