import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'app-booking-flow',
    templateUrl: './booking-flow.component.html',
    styleUrls: ['./booking-flow.component.css'],
    standalone : false
})
export class BookingFlowComponent implements OnInit {
    eventId: number | null = null;
    shows: any[] = [];
    seats: any[] = [];

    selectedShowId: number | null = null;
    selectedSeats: number[] = []; // IDs
    showPopup: boolean = false;
    totalPrice: number = 0;
    credits: number = 0;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private userService: UserService,
        private authService: AuthService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            this.eventId = Number(params.get('eventId'));
            this.loadShows();
        });
    }

    loadShows() {
        if (this.eventId) {
            this.userService.getShows(this.eventId).subscribe(data => this.shows = data);
        }
    }

    onSelectShow(showId: number) {
        this.selectedShowId = showId;
        this.selectedSeats = [];
        this.userService.getSeats(showId).subscribe(data => this.seats = data);
        this.loadCredits();
    }

    loadCredits() {
        // Use CreditsService directly or via userService if added
        fetch('http://localhost:3000/user/credits', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        })
        .then(res => res.json())
        .then(data => this.credits = data.credits || 0);
    }

    toggleSeat(seat: any) {
        if (seat.status === 'BOOKED') return;

        const index = this.selectedSeats.indexOf(seat.id);
        if (index >= 0) {
            this.selectedSeats.splice(index, 1);
        } else {
            this.selectedSeats.push(seat.id);
        }
    }

    isSelected(seatId: number) {
        return this.selectedSeats.includes(seatId);
    }

    getSelectedTotal(): number {
        return this.selectedSeats.reduce((sum, id) => {
            const seat = this.seats.find((s: any) => s.id === id);
            return sum + (seat ? Number(seat.current_price || seat.base_price) : 0);
        }, 0);
    }

    confirmBooking() {
        if (!this.selectedShowId || this.selectedSeats.length === 0) return;
        // Calculate total price using current dynamic price
        this.totalPrice = this.selectedSeats.reduce((sum, id) => {
            const seat = this.seats.find((s: any) => s.id === id);
            return sum + (seat ? Number(seat.current_price || seat.base_price) : 0);
        }, 0);
        this.showPopup = true;
    }

    cancelPopup() {
        this.showPopup = false;
    }

    payAndBook() {
        if (!this.selectedShowId || this.selectedSeats.length === 0) return;
        const user = this.authService.currentUserValue;
        if (!user) {
            this.router.navigate(['/login']);
            return;
        }
        const payload = {
            showId: this.selectedShowId,
            seatIds: this.selectedSeats,
            userId: user.id
        };
        this.userService.bookSeats(payload).subscribe({
            next: (res) => {
                this.snackBar.open('Booking Confirm! ID: ' + res.bookingId, 'Close', { duration: 5000 });
                this.router.navigate(['/events']);
            },
            error: (err) => {
                this.snackBar.open('Booking Failed: ' + err.error.error, 'Close', { duration: 3000 });
                if (this.selectedShowId) this.onSelectShow(this.selectedShowId);
            }
        });
        this.showPopup = false;
    }
}
