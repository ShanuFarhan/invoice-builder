import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'firebase/auth';
import { Observable } from 'rxjs';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'invoice-builder';
  user$: Observable<User | null>;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.user$ = this.authService.user$;
  }

  ngOnInit() {
    // Check authentication state on app initialization
    this.authService.user$.subscribe(user => {
      console.log('App component detected auth state:', user ? 'Logged in' : 'Not logged in');

      // Get current route
      const currentRoute = this.router.url;

      if (user) {
        // User is logged in
        if (currentRoute === '/login') {
          console.log('Redirecting from login to home page');
          this.router.navigate(['/home']);
        }
      } else {
        // User is not logged in
        if (currentRoute !== '/login') {
          console.log('User not authenticated, redirecting to login');
          this.router.navigate(['/login']);
        }
      }
    });
  }

  logout() {
    this.authService.signOut();
  }

  getInitials(email: string): string {
    if (!email) return '?';
    const name = email.split('@')[0];
    return name.substring(0, 2).toUpperCase();
  }
}
