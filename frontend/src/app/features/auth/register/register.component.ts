import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css'],
    standalone: false
})
export class RegisterComponent {
    registerForm: FormGroup;
    hidePassword = true;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        private snackBar: MatSnackBar
    ) {
        this.registerForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]],
            role: ['user', Validators.required]
        });
    }


    onSubmit() {
        if (this.registerForm.valid) {
            this.authService.register(this.registerForm.value).subscribe({
                next: (res) => {
                    this.snackBar.open('Registration successful!', 'Close', { duration: 2000 });
                    if (res.role === 'admin') {
                        this.router.navigate(['/admin']);
                    } else {
                        console.log('Navigating to events');
                        this.router.navigate(['/events']);
                    }
                },
                error: (err) => {

                    if (err.status === 500) {
                        this.snackBar.open('Email already exists', 'Close', { duration: 3000 });
                    }
                }
            });
        }
    }

    signUpWithGoogle() {
        this.authService.loginWithGoogle();
    }
}
