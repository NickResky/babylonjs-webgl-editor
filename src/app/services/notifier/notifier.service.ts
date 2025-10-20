import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NotifierService {
  

  constructor() {
   
  }

  notify(type: 'success' | 'error' | 'warning' | 'info', message: string) {
    console.log(message)
  }
}
