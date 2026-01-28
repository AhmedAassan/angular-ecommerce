import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, NonNullableFormBuilder } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

import { AddressService, Area, CustomerAddress } from '../../services/address';

@Component({
  standalone: true,
  selector: 'app-addresses',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './addresses.html',
  styleUrl: './addresses.scss'
})
export class Addresses {
  private readonly api = inject(AddressService);
  private readonly fb: NonNullableFormBuilder = inject(FormBuilder).nonNullable;

  readonly list  = signal<CustomerAddress[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly busy  = signal<boolean>(false);

  // for quick area-name lookup in the template
  private areaMap = new Map<number, string>();

  // form state
  readonly formOpen  = signal<boolean>(false);
  readonly editingId = signal<number>(0);
  readonly saving    = signal<boolean>(false);

  // menu state for dropdown
  activeMenuId = 0;

  form = this.fb.group({
    id: 0,
    // ✅ must pick a real area (id > 0)
    areaId: this.fb.control(0, { validators: [Validators.min(1)] }),
    avenue: [''],
    street: [''],
    blockNumber: [''],
    buildingNumber: [''],
    floorNumber: [''],
    flatNumber: [''],
    addressLink: [''],
    note: [''],
  });

  ngOnInit() {
    this.load();
    this.api.getAreas().subscribe(a => {
      this.areas.set(a);
      // build a quick "id → label" map
      this.areaMap = new Map(
        a.map(x => [x.id, `${x.englishName} — ${x.arabicName}`])
      );
    });
  }

  load() {
    this.busy.set(true);
    this.api.getMyAddresses().subscribe({
      next: data => { this.list.set(data); this.busy.set(false); },
      error: () => { this.busy.set(false); }
    });
  }

  startAdd() {
    this.editingId.set(0);
    this.form.reset(this.blank());
    this.formOpen.set(true);
    
    // Scroll to form section after a brief delay to ensure form is rendered
    setTimeout(() => {
      const formElement = document.querySelector('.form-container');
      if (formElement) {
        formElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 100);
  }

  startEdit(a: CustomerAddress) {
    this.editingId.set(a.id);
    this.form.reset(a);
    this.formOpen.set(true);
    
    // Scroll to form section after a brief delay to ensure form is rendered
    setTimeout(() => {
      const formElement = document.querySelector('.form-container');
      if (formElement) {
        formElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 100);
  }

  closeForm() { this.formOpen.set(false); }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);

    const body = this.form.getRawValue() as CustomerAddress;
    const req$ = this.editingId() === 0
      ? this.api.addAddress({ ...body, id: 0 })
      : this.api.editAddress({ ...body, id: this.editingId() });

    req$.subscribe({
      next: res => {
        this.saving.set(false);
        Swal.fire({ icon: 'success', title: res?.msgEN || 'Saved', toast: true, timer: 1500, showConfirmButton: false, position: 'top-end' });
        this.formOpen.set(false);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        Swal.fire({ icon: 'error', title: 'Save failed', text: err?.error?.msgEN || err?.message || 'Unexpected error' });
      }
    });
  }

  confirmDelete(id: number) {
    Swal.fire({
      icon: 'warning',
      title: 'Delete address?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Delete'
    }).then(r => {
      if (r.isConfirmed) {
        this.api.deleteAddress(id).subscribe({
          next: res => {
            Swal.fire({ icon: 'success', title: res?.msgEN || 'Address deleted', toast: true, timer: 1500, showConfirmButton: false, position: 'top-end' });
            this.load();
          },
          error: err => {
            Swal.fire({ icon: 'error', title: 'Delete failed', text: err?.error?.msgEN || err?.message || 'Unexpected error' });
          }
        });
      }
    });
  }

  /** Helper for template: show area name for an id */
  areaLabel(id: number): string {
    return this.areaMap.get(id) ?? `Area #${id}`;
  }

  /** TrackBy function for ngFor performance */
  trackByAddressId(index: number, address: CustomerAddress): number {
    return address.id;
  }

  /** Toggle dropdown menu for address actions */
  toggleMenu(addressId: number) {
    this.activeMenuId = this.activeMenuId === addressId ? 0 : addressId;
  }

  /** Close dropdown menu */
  closeMenu() {
    this.activeMenuId = 0;
  }

  private blank(): CustomerAddress {
    return {
      id: 0, areaId: 0, avenue: '', street: '', blockNumber: '',
      buildingNumber: '', floorNumber: '', flatNumber: '',
      addressLink: '', note: '', deliveryCharge: 0
    };
  }
}