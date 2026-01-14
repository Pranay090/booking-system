
import { NgModule } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { UserDashboardComponent } from './user-dashboard/user-dashboard.component';
import { BookingFlowComponent } from './booking-flow/booking-flow.component';
import { FormsModule } from '@angular/forms';
import {MatTooltipModule} from '@angular/material/tooltip'; 

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
        RouterModule.forChild(routes),
        FormsModule,
        MatTooltipModule
    ],
    providers: [DecimalPipe]
})
export class UserModule { }
