import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ActionItemEditorComponent } from './action-item-editor.component';

describe('ActionItemEditorComponent', () => {
  let component: ActionItemEditorComponent;
  let fixture: ComponentFixture<ActionItemEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ActionItemEditorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ActionItemEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
