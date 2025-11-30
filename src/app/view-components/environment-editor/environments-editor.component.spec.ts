import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EnvironmentsEditorComponent } from './environments-editor.component';

describe('EnviromentEditorComponent', () => {
  let component: EnvironmentsEditorComponent;
  let fixture: ComponentFixture<EnvironmentsEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EnvironmentsEditorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EnvironmentsEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
