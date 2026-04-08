
import { NgModule } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { UserDashboardComponent } from './user-dashboard/user-dashboard.component';
import { BookingFlowComponent } from './booking-flow/booking-flow.component';
import { MyBookingsComponent } from './my-bookings/my-bookings.component';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip'; 
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';

const routes: Routes = [
    { path: '', component: UserDashboardComponent },
    { path: 'book/:eventId', component: BookingFlowComponent },
    { path: 'my-bookings', component: MyBookingsComponent }
];

@NgModule({
    declarations: [
        UserDashboardComponent,
        BookingFlowComponent,
        MyBookingsComponent
    ],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild(routes),
        FormsModule,
        MatTooltipModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MatDividerModule
    ],
    providers: [DecimalPipe]
})
export class UserModule { }
