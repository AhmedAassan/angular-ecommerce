// import { Component, inject, signal, computed, OnInit, ViewChild, effect } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
// import { RouterModule, Router } from '@angular/router';

// // Material Imports
// import { MatStepperModule, MatStepper } from '@angular/material/stepper';
// import { MatButtonModule } from '@angular/material/button';
// import { MatIconModule } from '@angular/material/icon';
// import { MatRadioModule } from '@angular/material/radio';
// import { MatCardModule } from '@angular/material/card';
// import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
// import { MatDividerModule } from '@angular/material/divider';
// import { MatFormFieldModule } from '@angular/material/form-field';
// import { MatInputModule } from '@angular/material/input';
// import { MatSelectModule } from '@angular/material/select';
// import { MatChipsModule } from '@angular/material/chips';
// import { MatTooltipModule } from '@angular/material/tooltip';
// import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
// import { trigger, transition, style, animate } from '@angular/animations';

// // Services
// import { CheckoutService, OrderType, PaymentMethod, SubmitCartRequest } from '../../services/checkout';
// import { AddressService, CustomerAddress, Area } from '../../services/address';

// // SweetAlert2
// import Swal from 'sweetalert2';

// @Component({
//   selector: 'app-checkout',
//   standalone: true,
//   imports: [
//     CommonModule,
//     ReactiveFormsModule,
//     RouterModule,
//     // Material
//     MatStepperModule,
//     MatButtonModule,
//     MatIconModule,
//     MatRadioModule,
//     MatCardModule,
//     MatProgressSpinnerModule,
//     MatDividerModule,
//     MatFormFieldModule,
//     MatInputModule,
//     MatSelectModule,
//     MatChipsModule,
//     MatTooltipModule
//   ],
//   providers: [
//     {
//       provide: STEPPER_GLOBAL_OPTIONS,
//       useValue: { showError: true, displayDefaultIndicatorType: false }
//     }
//   ],
//   templateUrl: './checkout.html',
//   styleUrl: './checkout.scss',
//   animations: [
//     trigger('fadeInOut', [
//       transition(':enter', [
//         style({ opacity: 0, transform: 'translateY(-10px)' }),
//         animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
//       ]),
//       transition(':leave', [
//         animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
//       ])
//     ])
//   ]
// })
// export class Checkout implements OnInit {
//   // ═══════════════════════════════════════════════════════════════════════════
//   // DEPENDENCY INJECTION
//   // ═══════════════════════════════════════════════════════════════════════════
  
//   private readonly checkoutService = inject(CheckoutService);
//   private readonly addressService = inject(AddressService);
//   private readonly fb = inject(FormBuilder).nonNullable;
//   private readonly router = inject(Router);

//   @ViewChild('stepper') stepper!: MatStepper;

//   // ═══════════════════════════════════════════════════════════════════════════
//   // SIGNALS & STATE
//   // ═══════════════════════════════════════════════════════════════════════════

//   // From checkout service
//   readonly orderTypes = this.checkoutService.filteredOrderTypes;
//   readonly loading = this.checkoutService.loading;
//   readonly submitting = this.checkoutService.submitting;
//   readonly isDelivery = this.checkoutService.isDelivery;
//   readonly paymentMethods = this.checkoutService.paymentMethods;

//   // Local signals
//   readonly addresses = signal<CustomerAddress[]>([]);
//   readonly areas = signal<Area[]>([]);
//   readonly loadingAddresses = signal<boolean>(false);
//   readonly loadingAreas = signal<boolean>(false);
//   readonly showAddressForm = signal<boolean>(false);
//   readonly savingAddress = signal<boolean>(false);
//   readonly selectedAddressId = signal<number | null>(null);

//   // Area map for quick lookup
//   private areaMap = new Map<number, { en: string; ar: string }>();

//   // ═══════════════════════════════════════════════════════════════════════════
//   // FORMS
//   // ═══════════════════════════════════════════════════════════════════════════

//   // Step 1: Order Type Form
//   orderTypeForm: FormGroup = this.fb.group({
//     orderTypeId: [0, [Validators.required, Validators.min(1)]]
//   });

//   // Step 2: Address Form (for delivery)
//   addressSelectionForm: FormGroup = this.fb.group({
//     customerAddressId: [0, [Validators.required, Validators.min(1)]]
//   });

//   // New Address Form
//   newAddressForm: FormGroup = this.fb.group({
//     id: [0],
//     areaId: [0, [Validators.required, Validators.min(1)]],
//     avenue: [''],
//     street: ['', Validators.required],
//     blockNumber: ['', Validators.required],
//     buildingNumber: ['', Validators.required],
//     floorNumber: [''],
//     flatNumber: [''],
//     addressLink: [''],
//     note: ['']
//   });

//   // Step 3: Payment Method Form
//   paymentForm: FormGroup = this.fb.group({
//     paymentMethod: [0, Validators.required]
//   });

//   // ═══════════════════════════════════════════════════════════════════════════
//   // COMPUTED
//   // ═══════════════════════════════════════════════════════════════════════════

//   readonly selectedOrderType = computed(() => {
//     // 1. Get the current state from the service signal
//     const state = this.checkoutService.checkoutState();
//     // 2. Use the ID from the state
//     const id = state.orderTypeId; 
//     // 3. Find the matching object
//     return this.orderTypes().find(ot => ot.id === id) ?? null;
//   });

//   readonly selectedAddress = computed(() => {
//     const id = this.selectedAddressId();
//     return this.addresses().find(a => a.id === id) ?? null;
//   });

//   readonly canProceedToStep2 = computed(() => {
//     return this.orderTypeForm.valid;
//   });

//   readonly canProceedToStep3 = computed(() => {
//     if (!this.isDelivery()) return true;
//     return this.addressSelectionForm.valid || this.selectedAddressId() !== null;
//   });

//   readonly orderSummary = computed(() => {
//     const state = this.checkoutService.checkoutState();
//     return {
//       orderType: this.checkoutService.getOrderTypeLabel(state.orderTypeId ?? 0, 'en'),
//       paymentMethod: this.checkoutService.getPaymentMethodLabel(state.paymentMethod, 'en'),
//       address: this.selectedAddress()
//     };
//   });

//   // ═══════════════════════════════════════════════════════════════════════════
//   // LIFECYCLE
//   // ═══════════════════════════════════════════════════════════════════════════

//   constructor() {
//     // Effect to sync order type with service
//     effect(() => {
//       const orderTypeId = this.orderTypeForm.get('orderTypeId')?.value;
//       if (orderTypeId > 0) {
//         this.checkoutService.setOrderType(orderTypeId);
//       }
//     }, { allowSignalWrites: true });

//     // Effect to sync payment method with service
//     effect(() => {
//       const paymentMethod = this.paymentForm.get('paymentMethod')?.value;
//       this.checkoutService.setPaymentMethod(paymentMethod);
//     }, { allowSignalWrites: true });
//   }

//   ngOnInit(): void {
//     this.loadOrderTypes();
//     this.loadAreas();
//   }

//   // ═══════════════════════════════════════════════════════════════════════════
//   // DATA LOADING
//   // ═══════════════════════════════════════════════════════════════════════════

//   private loadOrderTypes(): void {
//     this.checkoutService.loadOrderTypes().subscribe({
//       error: (err) => {
//         Swal.fire({
//           icon: 'error',
//           title: 'Failed to load order types',
//           text: err?.error?.msgEN || 'Please try again later'
//         });
//       }
//     });
//   }

//   private loadAddresses(): void {
//     this.loadingAddresses.set(true);
//     this.addressService.getMyAddresses().subscribe({
//       next: (addresses) => {
//         this.addresses.set(addresses);
//         this.loadingAddresses.set(false);
        
//         // If user has addresses, preselect the first one
//         if (addresses.length > 0 && !this.selectedAddressId()) {
//           this.selectAddress(addresses[0].id);
//         }
//       },
//       error: (err) => {
//         this.loadingAddresses.set(false);
//         console.error('Failed to load addresses:', err);
//       }
//     });
//   }

//   private loadAreas(): void {
//     this.loadingAreas.set(true);
//     this.addressService.getAreas().subscribe({
//       next: (areas) => {
//         this.areas.set(areas);
//         this.loadingAreas.set(false);
        
//         // Build area map
//         this.areaMap = new Map(
//           areas.map(a => [a.id, { en: a.englishName, ar: a.arabicName }])
//         );
//       },
//       error: () => {
//         this.loadingAreas.set(false);
//       }
//     });
//   }

//   // ═══════════════════════════════════════════════════════════════════════════
//   // ORDER TYPE SELECTION (STEP 1)
//   // ═══════════════════════════════════════════════════════════════════════════

//   selectOrderType(orderType: OrderType): void {
//     this.orderTypeForm.patchValue({ orderTypeId: orderType.id });
//     this.checkoutService.setOrderType(orderType.id);
    
//     // If delivery, load addresses
//     if (orderType.id === 2) {
//       this.loadAddresses();
//     } else {
//       // Reset address selection for pickup
//       this.selectedAddressId.set(null);
//       this.checkoutService.setCustomerAddress(null);
//     }
//   }

//   isOrderTypeSelected(orderType: OrderType): boolean {
//     return this.orderTypeForm.get('orderTypeId')?.value === orderType.id;
//   }

//   // ═══════════════════════════════════════════════════════════════════════════
//   // ADDRESS MANAGEMENT (STEP 2)
//   // ═══════════════════════════════════════════════════════════════════════════

//   selectAddress(addressId: number): void {
//     this.selectedAddressId.set(addressId);
//     this.addressSelectionForm.patchValue({ customerAddressId: addressId });
//     this.checkoutService.setCustomerAddress(addressId);
//     this.showAddressForm.set(false);
//   }

//   isAddressSelected(address: CustomerAddress): boolean {
//     return this.selectedAddressId() === address.id;
//   }

//   toggleAddressForm(): void {
//     this.showAddressForm.update(v => !v);
//     if (this.showAddressForm()) {
//       this.resetNewAddressForm();
//     }
//   }

//   resetNewAddressForm(): void {
//     this.newAddressForm.reset({
//       id: 0,
//       areaId: 0,
//       avenue: '',
//       street: '',
//       blockNumber: '',
//       buildingNumber: '',
//       floorNumber: '',
//       flatNumber: '',
//       addressLink: '',
//       note: ''
//     });
//   }

//   saveNewAddress(): void {
//     if (this.newAddressForm.invalid) {
//       this.newAddressForm.markAllAsTouched();
//       return;
//     }

//     this.savingAddress.set(true);
//     const addressData = this.newAddressForm.getRawValue() as CustomerAddress;

//     this.addressService.addAddress({ ...addressData, id: 0 }).subscribe({
//       next: (response) => {
//         this.savingAddress.set(false);
        
//         Swal.fire({
//           icon: 'success',
//           title: response?.msgEN || 'Address added successfully',
//           toast: true,
//           timer: 2000,
//           showConfirmButton: false,
//           position: 'top-end'
//         });

//         // Reload addresses and select the new one
//         this.loadingAddresses.set(true);
//         this.addressService.getMyAddresses().subscribe({
//           next: (addresses) => {
//             this.addresses.set(addresses);
//             this.loadingAddresses.set(false);
            
//             // Find and select the newly created address (last one or match by details)
//             if (addresses.length > 0) {
//               const newAddress = addresses[addresses.length - 1];
//               this.selectAddress(newAddress.id);
//             }
            
//             this.showAddressForm.set(false);
//           },
//           error: () => {
//             this.loadingAddresses.set(false);
//           }
//         });
//       },
//       error: (err) => {
//         this.savingAddress.set(false);
//         Swal.fire({
//           icon: 'error',
//           title: 'Failed to add address',
//           text: err?.error?.msgEN || 'Please try again'
//         });
//       }
//     });
//   }

//   getAreaLabel(areaId: number): string {
//     const area = this.areaMap.get(areaId);
//     if (!area) return `Area #${areaId}`;
//     return `${area.en} — ${area.ar}`;
//   }

//   // ═══════════════════════════════════════════════════════════════════════════
//   // PAYMENT METHOD (STEP 3)
//   // ═══════════════════════════════════════════════════════════════════════════

//   selectPaymentMethod(method: PaymentMethod): void {
//     this.paymentForm.patchValue({ paymentMethod: method.id });
//     this.checkoutService.setPaymentMethod(method.id);
//   }

//   isPaymentMethodSelected(method: PaymentMethod): boolean {
//     return this.paymentForm.get('paymentMethod')?.value === method.id;
//   }

//   // ═══════════════════════════════════════════════════════════════════════════
//   // STEPPER NAVIGATION
//   // ═══════════════════════════════════════════════════════════════════════════

//   onStepChange(event: any): void {
//     // Step 1 → Step 2: If delivery, ensure addresses are loaded
//     if (event.selectedIndex === 1 && this.isDelivery() && this.addresses().length === 0) {
//       this.loadAddresses();
//     }
//   }

//   goToNextStep(): void {
//     if (this.stepper) {
//       this.stepper.next();
//     }
//   }

//   goToPreviousStep(): void {
//     if (this.stepper) {
//       this.stepper.previous();
//     }
//   }

//   // ═══════════════════════════════════════════════════════════════════════════
//   // CHECKOUT SUBMISSION
//   // ═══════════════════════════════════════════════════════════════════════════

//   submitCheckout(): void {
//     // Validate all steps
//     if (!this.orderTypeForm.valid) {
//       Swal.fire({
//         icon: 'warning',
//         title: 'Please select order type',
//         text: 'You must choose Pickup or Delivery'
//       });
//       this.stepper.selectedIndex = 0;
//       return;
//     }

//     if (this.isDelivery() && !this.selectedAddressId()) {
//       Swal.fire({
//         icon: 'warning',
//         title: 'Please select delivery address',
//         text: 'You must select or add a delivery address'
//       });
//       this.stepper.selectedIndex = 1;
//       return;
//     }

//     // ════════════════════════════════════════════════════════════
//     // BUILD REQUEST PAYLOAD
//     // ════════════════════════════════════════════════════════════
    
//     // Start with base object (using 'any' to allow dynamic property addition)
//     const requestPayload: any = {
//       orderTypeId: this.orderTypeForm.get('orderTypeId')?.value,
//       paymentMethod: this.paymentForm.get('paymentMethod')?.value
//     };

//     // Only add customerAddressId if it is Delivery (OrderType 2)
//     // If OrderType is 1 (Pickup), this key will not exist in the final object
//     if (this.isDelivery()) {
//       requestPayload.customerAddressId = this.selectedAddressId() ?? 0;
//     }

//     const request = requestPayload as SubmitCartRequest;

//     // ════════════════════════════════════════════════════════════

//     // Confirm before submission
//     Swal.fire({
//       icon: 'question',
//       title: 'Confirm Order',
//       html: this.buildConfirmationHtml(request),
//       showCancelButton: true,
//       confirmButtonText: 'Place Order',
//       confirmButtonColor: '#4CAF50',
//       cancelButtonText: 'Review Order'
//     }).then((result) => {
//       if (result.isConfirmed) {
//         this.processSubmission(request);
//       }
//     });
//   }

//   private buildConfirmationHtml(request: SubmitCartRequest): string {
//     const orderType = this.checkoutService.getOrderTypeLabel(request.orderTypeId, 'en');
//     const paymentMethod = this.checkoutService.getPaymentMethodLabel(request.paymentMethod, 'en');
//     const address = this.selectedAddress();

//     let html = `
//       <div style="text-align: left; padding: 10px;">
//         <p><strong>Order Type:</strong> ${orderType}</p>
//         <p><strong>Payment Method:</strong> ${paymentMethod}</p>
//     `;

//     if (request.orderTypeId === 2 && address) {
//       html += `
//         <p><strong>Delivery Address:</strong></p>
//         <p style="margin-left: 15px; color: #666;">
//           ${this.getAreaLabel(address.areaId)}<br>
//           Block ${address.blockNumber}, Street ${address.street}<br>
//           Building ${address.buildingNumber}
//           ${address.floorNumber ? ', Floor ' + address.floorNumber : ''}
//           ${address.flatNumber ? ', Flat ' + address.flatNumber : ''}
//           <br>
//           <strong>Delivery charge:</strong> ${address.deliveryCharge} <strong>KWD</strong>
//         </p>
//       `;
//     }

//     html += '</div>';
//     return html;
//   }

//   private processSubmission(request: SubmitCartRequest): void {
//     // Show loading
//     Swal.fire({
//       title: 'Processing your order...',
//       html: 'Please wait while we submit your order',
//       allowOutsideClick: false,
//       allowEscapeKey: false,
//       didOpen: () => {
//         Swal.showLoading();
//       }
//     });

//     this.checkoutService.submitCart(request).subscribe({
//       next: (response) => {
//         if (response.status) {
//           Swal.fire({
//             icon: 'success',
//             title: 'Order Placed Successfully!',
//             html: `
//               <p>${response.msgEN || 'Your order has been submitted.'}</p>
//               <p style="color: #666; margin-top: 10px;">
//                 <strong>Payment link will be sent to your WhatsApp</strong>
//               </p>
//             `,
//             confirmButtonText: 'Continue Shopping',
//             confirmButtonColor: '#4CAF50'
//           }).then(() => {
//             // Reset checkout state
//             this.checkoutService.resetState();
//             this.resetAllForms();
            
//             // Navigate to home or orders page
//             this.router.navigate(['/']);
//           });
//         } else {
//           Swal.fire({
//             icon: 'error',
//             title: 'Order Failed',
//             text: response.msgEN || 'Failed to place order. Please try again.'
//           });
//         }
//       },
//       error: (err) => {
//         Swal.fire({
//           icon: 'error',
//           title: 'Order Failed',
//           text: err?.error?.msgEN || err?.message || 'An unexpected error occurred. Please try again.'
//         });
//       }
//     });
//   }

//   private resetAllForms(): void {
//     this.orderTypeForm.reset({ orderTypeId: 0 });
//     this.addressSelectionForm.reset({ customerAddressId: 0 });
//     this.paymentForm.reset({ paymentMethod: 0 });
//     this.selectedAddressId.set(null);
//     this.showAddressForm.set(false);
    
//     if (this.stepper) {
//       this.stepper.reset();
//     }
//   }

//   // ═══════════════════════════════════════════════════════════════════════════
//   // UTILITY METHODS
//   // ═══════════════════════════════════════════════════════════════════════════

//   getOrderTypeIcon(orderType: OrderType | null | undefined): string {
//     // Safety check: if orderType is null, return a default icon
//     if (!orderType) return 'receipt';

//     switch (orderType.id) {
//       case 1: return 'shopping_bag'; // Pickup
//       case 2: return 'delivery_dining'; // Delivery
//       default: return 'receipt';
//     }
//   }

//   getPaymentIcon(method: PaymentMethod): string {
//     switch (method.id) {
//       case 0: return 'payments'; // COD
//       case 1: return 'credit_card'; // Online
//       default: return 'payment';
//     }
//   }

//   trackByOrderType(index: number, item: OrderType): number {
//     return item.id;
//   }

//   trackByAddress(index: number, item: CustomerAddress): number {
//     return item.id;
//   }

//   trackByPayment(index: number, item: PaymentMethod): number {
//     return item.id;
//   }
// }


import { Component, inject, signal, computed, OnInit, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

// Material Imports
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { trigger, transition, style, animate } from '@angular/animations';

// Services
import { CheckoutService, OrderType, PaymentMethod, SubmitCartRequest } from '../../services/checkout';
import { AddressService, CustomerAddress, Area } from '../../services/address';

// SweetAlert2
import Swal from 'sweetalert2';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    // Material
    MatStepperModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule
  ],
  providers: [
    {
      provide: STEPPER_GLOBAL_OPTIONS,
      useValue: { showError: true, displayDefaultIndicatorType: false }
    }
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class Checkout implements OnInit {
  // ═══════════════════════════════════════════════════════════════════════════
  // DEPENDENCY INJECTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  private readonly checkoutService = inject(CheckoutService);
  private readonly addressService = inject(AddressService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly router = inject(Router);

  @ViewChild('stepper') stepper!: MatStepper;

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNALS & STATE
  // ═══════════════════════════════════════════════════════════════════════════

  // From checkout service
  readonly orderTypes = this.checkoutService.filteredOrderTypes;
  readonly loading = this.checkoutService.loading;
  readonly submitting = this.checkoutService.submitting;
  readonly isDelivery = this.checkoutService.isDelivery;
  readonly paymentMethods = this.checkoutService.paymentMethods;

  // Local signals
  readonly addresses = signal<CustomerAddress[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly loadingAddresses = signal<boolean>(false);
  readonly loadingAreas = signal<boolean>(false);
  readonly showAddressForm = signal<boolean>(false);
  readonly savingAddress = signal<boolean>(false);
  readonly selectedAddressId = signal<number | null>(null);

  // Area map for quick lookup
  private areaMap = new Map<number, { en: string; ar: string }>();

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMS
  // ═══════════════════════════════════════════════════════════════════════════

  // Step 1: Order Type Form
  orderTypeForm: FormGroup = this.fb.group({
    orderTypeId: [0, [Validators.required, Validators.min(1)]]
  });

  // Step 2: Address Form (for delivery)
  addressSelectionForm: FormGroup = this.fb.group({
    customerAddressId: [0, [Validators.required, Validators.min(1)]]
  });

  // New Address Form
  newAddressForm: FormGroup = this.fb.group({
    id: [0],
    areaId: [0, [Validators.required, Validators.min(1)]],
    avenue: [''],
    street: ['', Validators.required],
    blockNumber: ['', Validators.required],
    buildingNumber: ['', Validators.required],
    floorNumber: [''],
    flatNumber: [''],
    addressLink: [''],
    note: ['']
  });

  // Step 3: Payment Method Form
  paymentForm: FormGroup = this.fb.group({
    paymentMethod: [0, Validators.required]
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════════════

  readonly selectedOrderType = computed(() => {
    const state = this.checkoutService.checkoutState();
    const id = state.orderTypeId; 
    return this.orderTypes().find(ot => ot.id === id) ?? null;
  });

  readonly selectedAddress = computed(() => {
    const id = this.selectedAddressId();
    return this.addresses().find(a => a.id === id) ?? null;
  });

  readonly canProceedToStep2 = computed(() => {
    return this.orderTypeForm.valid;
  });

  readonly canProceedToStep3 = computed(() => {
    if (!this.isDelivery()) return true;
    return this.addressSelectionForm.valid || this.selectedAddressId() !== null;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  constructor() {
    // Effect to sync order type with service
    effect(() => {
      const orderTypeId = this.orderTypeForm.get('orderTypeId')?.value;
      if (orderTypeId > 0) {
        this.checkoutService.setOrderType(orderTypeId);
      }
    }, { allowSignalWrites: true });

    // Effect to sync payment method with service
    effect(() => {
      const paymentMethod = this.paymentForm.get('paymentMethod')?.value;
      this.checkoutService.setPaymentMethod(paymentMethod);
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.loadOrderTypes();
    this.loadAreas();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  private loadOrderTypes(): void {
    this.checkoutService.loadOrderTypes().subscribe({
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Failed to load order types',
          text: err?.error?.msgEN || 'Please try again later'
        });
      }
    });
  }

  private loadAddresses(): void {
    this.loadingAddresses.set(true);
    this.addressService.getMyAddresses().subscribe({
      next: (addresses) => {
        this.addresses.set(addresses);
        this.loadingAddresses.set(false);
        
        // If user has addresses, preselect the first one
        if (addresses.length > 0 && !this.selectedAddressId()) {
          this.selectAddress(addresses[0].id);
        }
      },
      error: (err) => {
        this.loadingAddresses.set(false);
        console.error('Failed to load addresses:', err);
      }
    });
  }

  private loadAreas(): void {
    this.loadingAreas.set(true);
    this.addressService.getAreas().subscribe({
      next: (areas) => {
        this.areas.set(areas);
        this.loadingAreas.set(false);
        
        // Build area map
        this.areaMap = new Map(
          areas.map(a => [a.id, { en: a.englishName, ar: a.arabicName }])
        );
      },
      error: () => {
        this.loadingAreas.set(false);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER TYPE SELECTION (STEP 1)
  // ═══════════════════════════════════════════════════════════════════════════

  selectOrderType(orderType: OrderType): void {
    this.orderTypeForm.patchValue({ orderTypeId: orderType.id });
    this.checkoutService.setOrderType(orderType.id);
    
    // If delivery, load addresses
    if (orderType.id === 2) {
      this.loadAddresses();
    } else {
      // Reset address selection for pickup
      this.selectedAddressId.set(null);
      this.checkoutService.setCustomerAddress(null);
    }
  }

  isOrderTypeSelected(orderType: OrderType): boolean {
    return this.orderTypeForm.get('orderTypeId')?.value === orderType.id;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDRESS MANAGEMENT (STEP 2)
  // ═══════════════════════════════════════════════════════════════════════════

  selectAddress(addressId: number): void {
    this.selectedAddressId.set(addressId);
    this.addressSelectionForm.patchValue({ customerAddressId: addressId });
    this.checkoutService.setCustomerAddress(addressId);
    this.showAddressForm.set(false);
  }

  isAddressSelected(address: CustomerAddress): boolean {
    return this.selectedAddressId() === address.id;
  }

  toggleAddressForm(): void {
    this.showAddressForm.update(v => !v);
    if (this.showAddressForm()) {
      this.resetNewAddressForm();
    }
  }

  resetNewAddressForm(): void {
    this.newAddressForm.reset({
      id: 0,
      areaId: 0,
      avenue: '',
      street: '',
      blockNumber: '',
      buildingNumber: '',
      floorNumber: '',
      flatNumber: '',
      addressLink: '',
      note: ''
    });
  }

  saveNewAddress(): void {
    if (this.newAddressForm.invalid) {
      this.newAddressForm.markAllAsTouched();
      return;
    }

    this.savingAddress.set(true);
    const addressData = this.newAddressForm.getRawValue() as CustomerAddress;

    this.addressService.addAddress({ ...addressData, id: 0 }).subscribe({
      next: (response) => {
        this.savingAddress.set(false);
        
        Swal.fire({
          icon: 'success',
          title: response?.msgEN || 'Address added successfully',
          toast: true,
          timer: 2000,
          showConfirmButton: false,
          position: 'top-end'
        });

        // Reload addresses and select the new one
        this.loadingAddresses.set(true);
        this.addressService.getMyAddresses().subscribe({
          next: (addresses) => {
            this.addresses.set(addresses);
            this.loadingAddresses.set(false);
            
            if (addresses.length > 0) {
              const newAddress = addresses[addresses.length - 1];
              this.selectAddress(newAddress.id);
            }
            
            this.showAddressForm.set(false);
          },
          error: () => {
            this.loadingAddresses.set(false);
          }
        });
      },
      error: (err) => {
        this.savingAddress.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Failed to add address',
          text: err?.error?.msgEN || 'Please try again'
        });
      }
    });
  }

  getAreaLabel(areaId: number): string {
    const area = this.areaMap.get(areaId);
    if (!area) return `Area #${areaId}`;
    return `${area.en} — ${area.ar}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT METHOD (STEP 3)
  // ═══════════════════════════════════════════════════════════════════════════

  selectPaymentMethod(method: PaymentMethod): void {
    this.paymentForm.patchValue({ paymentMethod: method.id });
    this.checkoutService.setPaymentMethod(method.id);
  }

  isPaymentMethodSelected(method: PaymentMethod): boolean {
    return this.paymentForm.get('paymentMethod')?.value === method.id;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEPPER NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  onStepChange(event: any): void {
    if (event.selectedIndex === 1 && this.isDelivery() && this.addresses().length === 0) {
      this.loadAddresses();
    }
  }

  goToNextStep(): void {
    if (this.stepper) this.stepper.next();
  }

  goToPreviousStep(): void {
    if (this.stepper) this.stepper.previous();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT SUBMISSION (REFACTORED FOR BEST PRECISE DESIGN)
  // ═══════════════════════════════════════════════════════════════════════════

  submitCheckout(): void {
    // 1. Validation
    if (!this.orderTypeForm.valid) {
      Swal.fire({ icon: 'warning', title: 'Please select order type', text: 'You must choose Pickup or Delivery' });
      this.stepper.selectedIndex = 0;
      return;
    }

    if (this.isDelivery() && !this.selectedAddressId()) {
      Swal.fire({ icon: 'warning', title: 'Please select delivery address', text: 'You must select or add a delivery address' });
      this.stepper.selectedIndex = 1;
      return;
    }

    // 2. Build Payload
    const requestPayload: any = {
      orderTypeId: this.orderTypeForm.get('orderTypeId')?.value,
      paymentMethod: this.paymentForm.get('paymentMethod')?.value
    };

    if (this.isDelivery()) {
      requestPayload.customerAddressId = this.selectedAddressId() ?? 0;
    }

    const request = requestPayload as SubmitCartRequest;

    // 3. Confirm (Modern Receipt Design)
    Swal.fire({
      title: '<span style="color: var(--text-color); font-weight: 600;">Confirm Order</span>',
      html: this.buildConfirmationHtml(request),
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Place Order',
      confirmButtonColor: 'var(--product-color, #4CAF50)',
      cancelButtonText: 'Review',
      cancelButtonColor: 'var(--desc-color, #999)',
      reverseButtons: true,
      focusConfirm: false,
      width: 500,
      background: 'var(--card-bg, #fff)'
    }).then((result) => {
      if (result.isConfirmed) {
        this.processSubmission(request);
      }
    });
  }

  /**
   * Generates a "Digital Receipt" style HTML for the confirmation alert
   */
  private buildConfirmationHtml(request: SubmitCartRequest): string {
    const orderType = this.checkoutService.getOrderTypeLabel(request.orderTypeId, 'en');
    const paymentMethod = this.checkoutService.getPaymentMethodLabel(request.paymentMethod, 'en');
    const address = this.selectedAddress();
    const isDelivery = request.orderTypeId === 2 && address;
  
    // Inline styles using your CSS variables
    const styles = {
      container: 'text-align: left; padding: 0 10px;',
      row: 'display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #e0e0e0;',
      label: 'color: var(--desc-color, #666); font-size: 14px;',
      value: 'color: var(--text-color, #333); font-weight: 600; font-size: 15px;',
      addressBox: `
        background-color: var(--image-bg, #f9f9f9); 
        padding: 15px; 
        border-radius: 8px; 
        margin-top: 15px;
        border: 1px solid var(--checkbox-border, #eee);
      `,
      addressTitle: 'display: block; font-weight: 600; font-size: 13px; color: var(--product-color, #1976d2); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;'
    };
  
    let html = `<div style="${styles.container}">`;
  
    // --- Row 1: Order Type ---
    html += `
      <div style="${styles.row}">
        <span style="${styles.label}">Order Type</span>
        <span style="${styles.value}">
          <span style="vertical-align: middle; margin-right: 5px;" class="material-icons">
            ${request.orderTypeId === 2 ? 'local_shipping' : 'store'}
          </span>
          ${orderType}
        </span>
      </div>
    `;
  
    // --- Row 2: Payment Method ---
    html += `
      <div style="${styles.row}">
        <span style="${styles.label}">Payment</span>
        <span style="${styles.value}">${paymentMethod}</span>
      </div>
    `;
  
    // --- Delivery Section (Conditional) ---
    if (isDelivery) {
      html += `
        <div style="${styles.addressBox}">
          <span style="${styles.addressTitle}">Delivery Location</span>
          <div style="font-size: 14px; color: var(--text-color, #444); line-height: 1.6;">
            <strong>${this.getAreaLabel(address.areaId)}</strong><br>
            Block ${address.blockNumber}, Street ${address.street}
            ${address.buildingNumber ? `, Bldg ${address.buildingNumber}` : ''}
          </div>
          
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: var(--desc-color);">Delivery Charge</span>
            <span style="font-weight: 600; color: var(--text-color);">${address.deliveryCharge} KWD</span>
          </div>
        </div>
      `;
    } else {
      // Pickup Message
      html += `
        <div style="${styles.addressBox}; text-align: center;">
          <span class="material-icons" style="font-size: 32px; color: var(--desc-color, #ccc); margin-bottom: 8px;">store</span>
          <div style="font-size: 14px; color: var(--desc-color);">
            You will pick up your order from the store.
          </div>
        </div>
      `;
    }
  
    html += '</div>';
    return html;
  }

    private processSubmission(request: SubmitCartRequest): void {
    Swal.fire({
      title: 'Processing Order...',
      html: 'Please wait while we submit your order',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.checkoutService.submitCart(request).subscribe({
      next: (response) => {
        if (response.status) {
          Swal.fire({
            icon: 'success',
            title: '<span style="color: var(--text-color); font-weight: 600;">Order Placed!</span>',
            html: `
              <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 10px;">
                <p style="color: var(--desc-color); font-size: 16px; margin: 0; line-height: 1.5;">
                  ${response.msgEN || 'Invoice added successfully!'}
                </p>
                
                <!-- WhatsApp Notice Box -->
                <div style="
                  background-color: rgba(76, 175, 80, 0.1); 
                  border: 1px solid rgba(76, 175, 80, 0.2);
                  border-radius: 12px;
                  padding: 16px;
                  display: flex;
                  align-items: center;
                  gap: 16px;
                  text-align: left;
                ">
                  <!-- Fixed: Using SVG instead of font icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 32px; height: 32px; flex-shrink: 0;" role="img" aria-label="WhatsApp">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" fill="#25D366"/>
                  </svg>
                  
                  <div style="display: flex; flex-direction: column; flex: 1;">
                    <strong style="color: var(--text-color); font-size: 14px;">Next Step</strong>
                    <span style="color: var(--desc-color); font-size: 13px; line-height: 1.4;">
                      Payment link will be sent to your WhatsApp shortly.
                    </span>
                  </div>
                </div>
              </div>
            `,
            confirmButtonText: 'Continue Shopping',
            confirmButtonColor: 'var(--product-color, #4CAF50)',
            width: 450,
            padding: '2em',
            background: 'var(--card-bg, #fff)'
          }).then(() => {
            this.checkoutService.resetState();
            this.resetAllForms();
            this.router.navigate(['/']);
          });
        } else {
          Swal.fire({ icon: 'error', title: 'Order Failed', text: response.msgEN || 'Failed to place order.' });
        }
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Order Failed', text: err?.error?.msgEN || 'An unexpected error occurred.' });
      }
    });
  }


  private resetAllForms(): void {
    this.orderTypeForm.reset({ orderTypeId: 0 });
    this.addressSelectionForm.reset({ customerAddressId: 0 });
    this.paymentForm.reset({ paymentMethod: 0 });
    this.selectedAddressId.set(null);
    this.showAddressForm.set(false);
    if (this.stepper) this.stepper.reset();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  getOrderTypeIcon(orderType: OrderType | null | undefined): string {
    if (!orderType) return 'receipt';
    switch (orderType.id) {
      case 1: return 'shopping_bag';
      case 2: return 'delivery_dining';
      default: return 'receipt';
    }
  }

  getPaymentIcon(method: PaymentMethod): string {
    switch (method.id) {
      case 0: return 'payments';
      case 1: return 'credit_card';
      default: return 'payment';
    }
  }

  trackByOrderType(index: number, item: OrderType): number { return item.id; }
  trackByAddress(index: number, item: CustomerAddress): number { return item.id; }
  trackByPayment(index: number, item: PaymentMethod): number { return item.id; }
}
