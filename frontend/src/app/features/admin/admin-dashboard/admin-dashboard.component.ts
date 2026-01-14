import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'app-admin-dashboard',
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.css'],
    standalone: false
})
export class AdminDashboardComponent implements OnInit {
    tables = ['events', 'shows', 'seats', 'bookings', 'users', 'booking_seats'];
    currentTable = 'events';
    tableData: any[] = [];
    displayedColumns: string[] = [];
    showPopUp = false;
    // Forms
    eventName = '';

    showEventId: number | null = null;
    showTime = '';

    seatShowId: number | null = null;
    seatCount = 0;
    seatPrefix = 'A';
    seatBasePrice: number = 0;
    seatLeastPrice: number = 0;

    eventsList: any[] = [];

    constructor(
        private adminService: AdminService,
        private authService: AuthService,
        private router: Router,
        private snackBar: MatSnackBar,
        private readonly cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadTable(this.currentTable);
        this.loadEvents();
    }

    loadEvents() {
        this.adminService.getEvents().subscribe(data => {
            this.eventsList = data;
            this.cdr.detectChanges();
        });
    }

    loadTable(tableName: string) {
        this.currentTable = tableName;
        this.adminService.getTableData(tableName).subscribe({
            next: (data) => {
                this.tableData = data;
                if (data.length > 0) {
                    this.displayedColumns = Object.keys(data[0]);
                } else {
                    this.displayedColumns = [];
                }
            },
            error: () => this.tableData = []
        });
    }

    // Create Event
    onAddEvent() {
        if (!this.eventName) return;
        this.adminService.createEvent({ name: this.eventName }).subscribe(() => {
            this.snackBar.open('Event created', 'Close', { duration: 3000 });
            this.eventName = '';
            this.loadEvents();
            if (this.currentTable === 'events') this.loadTable('events');
        });
    }

    // Create Show
    onAddShow() {
        if (!this.showEventId || !this.showTime) return;
        this.adminService.createShow({ event_id: this.showEventId, show_time: this.showTime }).subscribe(() => {
            this.snackBar.open('Show created', 'Close', { duration: 3000 });
            if (this.currentTable === 'shows') this.loadTable('shows');
        });
    }

    // Create Seats
    onAddSeats() {
        if (!this.seatShowId || this.seatCount <= 0 || this.seatBasePrice <= 0 || this.seatLeastPrice < 0) return;

        const seats = [];
        for (let i = 1; i <= this.seatCount; i++) {
            seats.push({ seat_number: `${this.seatPrefix}${i}`, base_price: this.seatBasePrice, least_selling_price: this.seatLeastPrice });
        }

        this.adminService.createSeats(this.seatShowId, seats).subscribe(() => {
            this.snackBar.open(`${this.seatCount} seats added`, 'Close', { duration: 3000 });
            if (this.currentTable === 'seats') this.loadTable('seats');
        });
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    onLogout() {
        this.showPopUp = true;
    }

    cancelPopup() {
        this.showPopUp = false;
    }

}
