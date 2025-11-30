import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
    providedIn: 'root'
})
export class NotifierService {
    private _snackBar = inject(MatSnackBar);

    constructor() {}

    notify(type: 'success' | 'error' | 'warning' | 'info', message: string) {
        console.log(message);
        this._snackBar.open(message, undefined, {
            duration: 5000,
            panelClass: [`snackbar-${type}`]
        });
    }
}
