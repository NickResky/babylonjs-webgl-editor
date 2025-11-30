import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CameraEditorComponent } from './camera-editor.component';

describe('CameraEditorComponent', () => {
  let component: CameraEditorComponent;
  let fixture: ComponentFixture<CameraEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CameraEditorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CameraEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
