import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ParticipantFormDialogComponent } from './participant-form-dialog.component';

describe('ParticipantFormDialogComponent', () => {
  const dialogRef = { close: vi.fn() };

  function create(data: unknown = null) {
    TestBed.configureTestingModule({
      imports: [ParticipantFormDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    const fixture = TestBed.createComponent(ParticipantFormDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => vi.clearAllMocks());

  it('is invalid with an empty name or a malformed email', () => {
    const c = create();
    c.form.setValue({ fullName: '', email: 'not-an-email', targetRole: 'Backend', seniority: 'MID', notes: '' });
    expect(c.form.valid).toBe(false);
    expect(c.form.controls.fullName.hasError('required')).toBe(true);
    expect(c.form.controls.email.hasError('email')).toBe(true);
  });

  it('closes with trimmed values when valid', () => {
    const c = create();
    c.form.setValue({
      fullName: '  Ana Popescu ',
      email: ' Ana@Example.com ',
      targetRole: ' Backend Engineer ',
      seniority: 'SENIOR',
      notes: '',
    });
    c.save();
    expect(dialogRef.close).toHaveBeenCalledWith({
      fullName: 'Ana Popescu',
      email: 'ana@example.com',
      targetRole: 'Backend Engineer',
      seniority: 'SENIOR',
      notes: null,
    });
  });

  it('prefills when editing', () => {
    const c = create({ fullName: 'Ion', email: 'ion@x.dev', targetRole: 'QA', seniority: 'JUNIOR', notes: 'n' });
    expect(c.form.getRawValue()).toMatchObject({ fullName: 'Ion', seniority: 'JUNIOR', notes: 'n' });
  });
});
