import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './contact.html',
  styleUrls: ['./contact.scss'],
})
export class Contact {
  private fb = inject(FormBuilder);

  // Form state properties
  isSubmitting = false;
  submitSuccess = false;
  submitError = false;

  // Contact form with all fields
  contactForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    subject: [''], // Optional field
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    privacyConsent: [false, Validators.requiredTrue],
  });

  /**
   * Handle form submission with enhanced UX
   */
  async onSubmit(): Promise<void> {
    // Reset previous states
    this.submitSuccess = false;
    this.submitError = false;

    // Check form validity
    if (this.contactForm.invalid) {
      this.markAllFieldsAsTouched();
      await this.showValidationError();
      return;
    }

    // Start submission process
    this.isSubmitting = true;

    try {
      // Simulate API call (replace with your actual backend call)
      await this.submitContactForm();
      
      // Success handling
      this.submitSuccess = true;
      await this.showSuccessMessage();
      this.resetForm();

    } catch (error) {
      // Error handling
      this.submitError = true;
      await this.showErrorMessage();
      console.error('Contact form submission error:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Simulate backend API call
   */
  private async submitContactForm(): Promise<void> {
    const formData = this.getFormData();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Log form data (replace with actual API call)
    console.log('📧 Contact Form Submission:', formData);
    
    // TODO: Replace with actual HTTP service call
    // return this.http.post('/api/contact', formData).toPromise();
    
    // Simulate random success/failure for demo
    if (Math.random() > 0.1) { // 90% success rate
      return Promise.resolve();
    } else {
      throw new Error('Simulated server error');
    }
  }

  /**
   * Get clean form data for submission
   */
  private getFormData() {
    const formValue = this.contactForm.value;
    return {
      name: formValue.name?.trim(),
      email: formValue.email?.trim().toLowerCase(),
      subject: formValue.subject || 'General Inquiry',
      message: formValue.message?.trim(),
      privacyConsent: formValue.privacyConsent,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Mark all form fields as touched to show validation errors
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.contactForm.controls).forEach(key => {
      this.contactForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Reset form to initial state
   */
  private resetForm(): void {
    this.contactForm.reset();
    this.contactForm.patchValue({
      subject: '',
      privacyConsent: false
    });
  }

  /**
   * Show success message with SweetAlert2
   */
  private async showSuccessMessage(): Promise<void> {
    await Swal.fire({
      title: '✅ Message Sent!',
      html: `
        <p>Thank you for reaching out! We've received your message and will get back to you within <strong>24 hours</strong>.</p>
        <p class="text-muted small">Check your email for a confirmation.</p>
      `,
      icon: 'success',
      confirmButtonText: 'Got it!',
      confirmButtonColor: '#f46d29',
      customClass: {
        popup: 'swal-theme-popup',
        title: 'swal-theme-title',
        confirmButton: 'swal-theme-button'
      },
      showClass: {
        popup: 'animate__animated animate__fadeInUp animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutDown animate__faster'
      }
    });
  }

  /**
   * Show validation error message
   */
  private async showValidationError(): Promise<void> {
    const errors = this.getFormErrors();
    
    await Swal.fire({
      title: '⚠️ Please Check Your Form',
      html: `
        <p>Please fix the following errors before submitting:</p>
        <ul class="text-left" style="text-align: left;">
          ${errors.map(error => `<li>${error}</li>`).join('')}
        </ul>
      `,
      icon: 'warning',
      confirmButtonText: 'Fix Errors',
      confirmButtonColor: '#f46d29',
      customClass: {
        popup: 'swal-theme-popup',
        title: 'swal-theme-title',
        confirmButton: 'swal-theme-button'
      }
    });
  }

  /**
   * Show error message for submission failure
   */
  private async showErrorMessage(): Promise<void> {
    await Swal.fire({
      title: '❌ Oops! Something Went Wrong',
      html: `
        <p>We couldn't send your message right now. This could be due to:</p>
        <ul class="text-left" style="text-align: left;">
          <li>Network connectivity issues</li>
          <li>Server maintenance</li>
          <li>High traffic volume</li>
        </ul>
        <p><strong>Please try again in a few minutes</strong>, or contact us directly at <a href="mailto:support@company.com">support@company.com</a></p>
      `,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Try Again',
      cancelButtonText: 'Contact Direct',
      confirmButtonColor: '#f46d29',
      cancelButtonColor: '#6c757d',
      customClass: {
        popup: 'swal-theme-popup',
        title: 'swal-theme-title',
        confirmButton: 'swal-theme-button',
        cancelButton: 'swal-theme-cancel-button'
      }
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        window.location.href = 'mailto:support@company.com?subject=Contact Form Issue';
      }
    });
  }

  /**
   * Get array of form validation errors
   */
  private getFormErrors(): string[] {
    const errors: string[] = [];
    const controls = this.contactForm.controls;

    if (controls.name.errors) {
      if (controls.name.errors['required']) {
        errors.push('Name is required');
      }
      if (controls.name.errors['minlength']) {
        errors.push('Name must be at least 2 characters long');
      }
    }

    if (controls.email.errors) {
      if (controls.email.errors['required']) {
        errors.push('Email address is required');
      }
      if (controls.email.errors['email']) {
        errors.push('Please enter a valid email address');
      }
    }

    if (controls.message.errors) {
      if (controls.message.errors['required']) {
        errors.push('Message is required');
      }
      if (controls.message.errors['minlength']) {
        errors.push('Message must be at least 10 characters long');
      }
      if (controls.message.errors['maxlength']) {
        errors.push('Message must be less than 1000 characters');
      }
    }

    if (controls.privacyConsent.errors) {
      if (controls.privacyConsent.errors['required']) {
        errors.push('You must agree to the privacy policy');
      }
    }

    return errors;
  }

  /**
   * Get character count for message field
   */
  getMessageCharacterCount(): number {
    return this.contactForm.get('message')?.value?.length || 0;
  }

  /**
   * Check if message is approaching character limit
   */
  isMessageNearLimit(): boolean {
    return this.getMessageCharacterCount() > 900; // Warning at 900+ chars
  }

  /**
   * Get form field error message
   */
  getFieldError(fieldName: string): string | null {
    const field = this.contactForm.get(fieldName);
    if (field && field.errors && field.touched) {
      const errors = field.errors;
      
      if (errors['required']) return `${this.getFieldLabel(fieldName)} is required`;
      if (errors['email']) return 'Please enter a valid email address';
      if (errors['minlength']) return `${this.getFieldLabel(fieldName)} is too short`;
      if (errors['maxlength']) return `${this.getFieldLabel(fieldName)} is too long`;
    }
    return null;
  }

  /**
   * Get human-readable field label
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Name',
      email: 'Email',
      subject: 'Subject',
      message: 'Message',
      privacyConsent: 'Privacy consent'
    };
    return labels[fieldName] || fieldName;
  }

  /**
   * Check if form field is valid and touched
   */
  isFieldValid(fieldName: string): boolean {
    const field = this.contactForm.get(fieldName);
    return !!(field && field.valid && field.touched);
  }

  /**
   * Check if form field is invalid and touched
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.contactForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}