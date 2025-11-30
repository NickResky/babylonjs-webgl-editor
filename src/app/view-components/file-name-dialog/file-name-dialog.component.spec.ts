import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FileNameDialogComponent } from './file-name-dialog.component';

describe('FileNameDialogComponent', () => {
  let component: FileNameDialogComponent;
  let fixture: ComponentFixture<FileNameDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FileNameDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FileNameDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
