import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
    loginForm: FormGroup;
    loading = false;
    hidePassword = true;
    isSignUp = false;
    errorMessage = '';
    returnUrl: string = '/home';

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute
    ) {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
    }

    ngOnInit() {
        // Check if user is already logged in
        this.authService.user$.subscribe(user => {
            if (user) {
                console.log('Login page: User already logged in, redirecting to home');
                this.router.navigate(['/home']);
            }
        });

        // Get return URL from route parameters or default to '/home'
        this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
    }

    async onSubmit() {
        if (this.loginForm.valid) {
            this.loading = true;
            this.errorMessage = '';
            try {
                const { email, password } = this.loginForm.value;
                if (this.isSignUp) {
                    await this.authService.signUp(email, password);
                    console.log('Login component: SignUp successful, navigating to', this.returnUrl);
                    this.router.navigate([this.returnUrl]);
                } else {
                    await this.authService.signIn(email, password);
                    console.log('Login component: SignIn successful, navigating to', this.returnUrl);
                    this.router.navigate([this.returnUrl]);
                }
            } catch (error: any) {
                console.error(this.isSignUp ? 'Sign up error:' : 'Login error:', error);
                this.errorMessage = this.getReadableErrorMessage(error);
            } finally {
                this.loading = false;
            }
        }
    }

    async googleSignIn() {
        try {
            this.loading = true;
            await this.authService.googleSignIn();
            console.log('Login component: Google SignIn successful, navigating to', this.returnUrl);
            this.router.navigate([this.returnUrl]);
        } catch (error: any) {
            console.error('Google sign-in error:', error);
            this.errorMessage = this.getReadableErrorMessage(error);
        } finally {
            this.loading = false;
        }
    }

    toggleSignUp() {
        this.isSignUp = !this.isSignUp;
        this.errorMessage = '';
    }

    private getReadableErrorMessage(error: any): string {
        // Extract the error code if available
        const errorCode = error.code || '';
        const errorMessage = error.message || '';

        // Map Firebase error codes to user-friendly messages
        if (errorCode.includes('auth/invalid-credential') || errorCode.includes('auth/wrong-password')) {
            return 'Invalid email or password. Please try again.';
        }
        if (errorCode.includes('auth/user-not-found')) {
            return 'No account found with this email. Please sign up.';
        }
        if (errorCode.includes('auth/email-already-in-use')) {
            return 'This email is already registered. Please sign in instead.';
        }
        if (errorCode.includes('auth/weak-password')) {
            return 'Password is too weak. Please use a stronger password.';
        }
        if (errorCode.includes('auth/invalid-email')) {
            return 'Please enter a valid email address.';
        }
        if (errorCode.includes('auth/network-request-failed')) {
            return 'Network error. Please check your internet connection.';
        }
        if (errorCode.includes('auth/too-many-requests')) {
            return 'Too many failed login attempts. Please try again later.';
        }
        if (errorCode.includes('auth/popup-closed-by-user')) {
            return 'Sign-in popup was closed before completing. Please try again.';
        }

        // If we can't identify a specific error code, provide a generic message
        return 'Authentication failed. Please try again.';
    }
} 