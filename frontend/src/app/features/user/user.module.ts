import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { UserDashboardComponent } from './user-dashboard/user-dashboard.component';
import { BookingFlowComponent } from './booking-flow/booking-flow.component';

const routes: Routes = [
    { path: '', component: UserDashboardComponent },
    { path: 'book/:eventId', component: BookingFlowComponent }
];

@NgModule({
    declarations: [
        UserDashboardComponent,
        BookingFlowComponent
    ],
    imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild(routes)
    ]
})
export class UserModule { }
