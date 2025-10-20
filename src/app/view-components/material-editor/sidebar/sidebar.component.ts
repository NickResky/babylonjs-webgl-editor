import { Component, OnInit } from '@angular/core';
import { HotkeysComponent } from '../../hotkeys/hotkeys.component';


@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  imports: [HotkeysComponent]
})
export class SidebarComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}

  onResizeEnd(event: any): void {
    console.log('Element was resized', event);
  }
}
