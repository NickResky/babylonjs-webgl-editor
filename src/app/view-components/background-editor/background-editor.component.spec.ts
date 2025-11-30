import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BackgroundEditorComponent } from './background-editor.component';

describe('BackgroundEditorComponent', () => {
  let component: BackgroundEditorComponent;
  let fixture: ComponentFixture<BackgroundEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [BackgroundEditorComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BackgroundEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
