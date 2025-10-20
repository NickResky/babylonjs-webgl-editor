import { Component, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-hotkeys',
  templateUrl: './hotkeys.component.html',
  styleUrls: ['./hotkeys.component.css'],
  imports: [MatTableModule]
})
export class HotkeysComponent implements OnInit {
  public hotkeyTableColumns: string[] = ['key', 'description'];
  public hotkeyTableDataSource = [
    { key: '0-9', description: 'Activate saved camera shot' },
    { key: 'C', description: 'Toggle LUT' },
    { key: 'CRTL+R', description: 'Reload application' },
    { key: 'CRTL+SHIFT+I', description: 'Toggle Developer Tools' },
    { key: 'F', description: 'Toggle free camera' },
    { key: 'F1', description: 'Activate previous camera shot' },
    { key: 'F2', description: 'Activate next camera shot' },
    { key: 'F11', description: 'Toggle fullscreen mode' },
    { key: 'I', description: 'Toggle Inspector' },
    { key: 'J', description: 'Resize sidebar' },
    { key: 'L', description: 'Toggle lightmaps/ AO maps' },
    { key: 'WASD', description: 'Controls for free camera' },
    { key: 'M', description: 'Toggle mobile device viewport' },
    { key: 'H', description: 'Toggle Action Items' },
    { key: 'K', description: 'Toggle Lens Flares' },
    { key: 'V', description: 'Toggle VCAO view' },
  ];

  constructor() { }

  ngOnInit(): void {
    
  }

}


