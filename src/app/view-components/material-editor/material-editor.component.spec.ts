import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialEditorComponent } from './material-editor.component';

describe('MaterialEditorComponent', () => {
  let component: MaterialEditorComponent;
  let fixture: ComponentFixture<MaterialEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MaterialEditorComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MaterialEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
