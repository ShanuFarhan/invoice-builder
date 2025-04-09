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
                this.errorMessage = error.message || 'Authentication failed. Please try again.';
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
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.errorMessage = 'Google sign-in failed. Please try again.';
        } finally {
            this.loading = false;
        }
    }

    toggleSignUp() {
        this.isSignUp = !this.isSignUp;
        this.errorMessage = '';
    }
} 