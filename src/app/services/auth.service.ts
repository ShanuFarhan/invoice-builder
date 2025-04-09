import { Inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
    Auth,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    User
} from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private userSubject = new BehaviorSubject<User | null>(null);
    user$ = this.userSubject.asObservable();

    constructor(
        @Inject('FIREBASE_AUTH') private auth: Auth,
        private router: Router
    ) {
        // Set persistence to LOCAL (keeps user logged in after browser restart)
        setPersistence(this.auth, browserLocalPersistence)
            .then(() => {
                console.log('Firebase persistence set to LOCAL');
            })
            .catch(error => {
                console.error('Error setting persistence:', error);
            });

        // Listen for auth state changes
        onAuthStateChanged(this.auth, (user) => {
            console.log('Auth state changed:', user ? user.email : 'No user');
            this.userSubject.next(user);
        });
    }

    async signUp(email: string, password: string) {
        try {
            const result = await createUserWithEmailAndPassword(this.auth, email, password);
            console.log('User signed up successfully');
            return result;
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    }

    async signIn(email: string, password: string) {
        try {
            // Set persistence before each sign in
            await setPersistence(this.auth, browserLocalPersistence);
            const result = await signInWithEmailAndPassword(this.auth, email, password);
            console.log('User signed in successfully');
            return result;
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    async googleSignIn() {
        try {
            // Set persistence before google sign in
            await setPersistence(this.auth, browserLocalPersistence);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(this.auth, provider);
            console.log('Google sign in successful');
            return result;
        } catch (error) {
            console.error('Google sign in error:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await signOut(this.auth);
            console.log('User signed out successfully');
            this.router.navigate(['/login']);
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    isAuthenticated(): boolean {
        return !!this.auth.currentUser;
    }
} 