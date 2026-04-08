import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-my-bookings',
  templateUrl: './my-bookings.component.html',
  styleUrls: ['./my-bookings.component.css'],
  standalone: false
})
export class MyBookingsComponent implements OnInit {
  bookings: any[] = [];
  loading = true;

  constructor(private userService: UserService, private router: Router) { }

  ngOnInit(): void {
    this.userService.getMyBookings().subscribe({
      next: (data) => {
        this.bookings = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching bookings', err);
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/events']);
  }
}
