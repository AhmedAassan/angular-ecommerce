// import { Component } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { RouterModule } from '@angular/router';

// interface PolicySection {
//   id: string;
//   title: string;
//   body: string;   // raw HTML string
// }

// @Component({
//   selector: 'app-privacy-policy',
//   standalone: true,
//   imports: [CommonModule, RouterModule],
//   templateUrl: './privacy-policy.html',
//   styleUrls: ['./privacy-policy.scss'],
// })
// export class PrivacyPolicy {
//   /** accordion sections */
//   sections: PolicySection[] = [
//     {
//       id: 'p1',
//       title: '1. Introduction',
//       body: `Your privacy matters to <strong>OurStore</strong>. This policy explains how we collect,
//              use, and safeguard your information when you visit our site.`,
//     },
//     {
//       id: 'p2',
//       title: '2. Information We Collect',
//       body: `
//         <ul>
//           <li><strong>Personal Data –</strong> name, email, address.</li>
//           <li><strong>Payment Data –</strong> handled securely by Stripe; we never store full card numbers.</li>
//           <li><strong>Device Data –</strong> IP address, browser, time zone, cookies.</li>
//         </ul>`,
//     },
//     {
//       id: 'p3',
//       title: '3. How We Use Your Information',
//       body: `We fulfil orders, improve the site experience, provide support, and combat fraud. 
//              We never sell your data.`,
//     },
//     {
//       id: 'p4',
//       title: '4. Cookies & Tracking',
//       body: `We use first-party cookies and Google Analytics to understand site performance. 
//              You can disable cookies, but some features may break.`,
//     },
//     {
//       id: 'p5',
//       title: '5. Data Sharing',
//       body: `We share data with trusted providers (shipping, payments, analytics) under strict contracts
//              that prohibit any other use.`,
//     },
//     {
//       id: 'p6',
//       title: '6. Your Rights',
//       body: `Depending on your region, you may request access, correction, or deletion of your personal data. 
//              Email <a href="mailto:privacy@ourstore.example">privacy@ourstore.example</a>.`,
//     },
//     {
//       id: 'p7',
//       title: '7. Policy Updates',
//       body: `We may update this policy periodically. Changes appear here with a new “Last updated” date.`,
//     },
//     {
//       id: 'p8',
//       title: '8. Contact',
//       body: `Questions? Email
//              <a href="mailto:privacy@ourstore.example">privacy@ourstore.example</a> 
//              or write to OurStore LLC, 123 Main St, New Cairo 11835, Egypt.`,
//     },
//   ];
// }


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface PolicySection {
  id: string;
  title: string;
  body: string;
  icon: string;
  lastUpdated?: string;
}

interface ContactInfo {
  email: string;
  address: string;
  phone?: string;
}

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './privacy-policy.html',
  styleUrls: ['./privacy-policy.scss'],
})
export class PrivacyPolicy implements OnInit {
  
  // Policy metadata
  lastUpdated = 'December 15, 2024';
  effectiveDate = 'January 1, 2024';
  version = '2.1';
  
  // Contact information
  contactInfo: ContactInfo = {
    email: 'privacy@ourstore.com',
    address: 'OurStore LLC, 123 Business Street, New Cairo 11835, Egypt',
    phone: '+20 123 456 7890'
  };

  // Expandable sections state
  expandedSections: Set<string> = new Set();

  /** Enhanced accordion sections with icons and detailed content */
  sections: PolicySection[] = [
    {
      id: 'introduction',
      title: 'Introduction & Overview',
      icon: 'bi-info-circle',
      body: `
        <div class="policy-intro">
          <p class="lead">Your privacy is fundamental to how we operate. This Privacy Policy explains how <strong>OurStore</strong> collects, uses, protects, and shares your personal information when you use our website, mobile application, and services.</p>
          
          <div class="key-points mt-4">
            <h6 class="fw-bold mb-3"><i class="bi bi-check-circle text-success me-2"></i>Key Commitments:</h6>
            <ul class="privacy-list">
              <li><strong>Transparency:</strong> We clearly explain what data we collect and why</li>
              <li><strong>Control:</strong> You have choices about how your data is used</li>
              <li><strong>Security:</strong> We protect your information with industry-standard measures</li>
              <li><strong>No Sale:</strong> We never sell your personal data to third parties</li>
            </ul>
          </div>

          <div class="compliance-badges mt-4">
            <span class="badge bg-primary me-2">GDPR Compliant</span>
            <span class="badge bg-info me-2">CCPA Compliant</span>
            <span class="badge bg-success">ISO 27001 Certified</span>
          </div>
        </div>
      `,
      lastUpdated: 'December 15, 2024'
    },
    {
      id: 'information-collection',
      title: 'Information We Collect',
      icon: 'bi-collection',
      body: `
        <div class="info-collection">
          <p>We collect different types of information to provide and improve our services:</p>
          
          <div class="data-categories">
            <div class="data-category mb-4">
              <h6 class="fw-bold text-primary"><i class="bi bi-person me-2"></i>Personal Information</h6>
              <ul class="privacy-list">
                <li><strong>Account Data:</strong> Name, email address, phone number, date of birth</li>
                <li><strong>Profile Information:</strong> Profile picture, preferences, wishlist items</li>
                <li><strong>Communication:</strong> Messages, reviews, customer service interactions</li>
              </ul>
            </div>

            <div class="data-category mb-4">
              <h6 class="fw-bold text-success"><i class="bi bi-credit-card me-2"></i>Payment & Billing</h6>
              <ul class="privacy-list">
                <li><strong>Payment Methods:</strong> Last 4 digits of cards, payment provider tokens</li>
                <li><strong>Billing Address:</strong> For tax calculation and fraud prevention</li>
                <li><strong>Transaction History:</strong> Purchase records, refunds, order status</li>
              </ul>
              <div class="alert alert-info mt-2">
                <i class="bi bi-shield-check me-2"></i>
                <strong>Security Note:</strong> Full payment details are handled by certified payment processors (Stripe, PayPal). We never store complete credit card numbers.
              </div>
            </div>

            <div class="data-category mb-4">
              <h6 class="fw-bold text-warning"><i class="bi bi-laptop me-2"></i>Technical Information</h6>
              <ul class="privacy-list">
                <li><strong>Device Data:</strong> IP address, browser type, operating system</li>
                <li><strong>Usage Analytics:</strong> Pages visited, time spent, click patterns</li>
                <li><strong>Cookies:</strong> Session data, preferences, shopping cart contents</li>
                <li><strong>Location:</strong> General location (city/country) for shipping and compliance</li>
              </ul>
            </div>
          </div>
        </div>
      `,
      lastUpdated: 'November 20, 2024'
    },
    {
      id: 'data-usage',
      title: 'How We Use Your Information',
      icon: 'bi-gear',
      body: `
        <div class="data-usage">
          <p>We use your information for the following legitimate business purposes:</p>
          
          <div class="usage-purposes">
            <div class="purpose-item mb-3">
              <h6 class="fw-bold"><i class="bi bi-bag me-2 text-primary"></i>Order Processing & Fulfillment</h6>
              <p>Process payments, manage inventory, arrange shipping, handle returns and refunds.</p>
            </div>

            <div class="purpose-item mb-3">
              <h6 class="fw-bold"><i class="bi bi-headset me-2 text-success"></i>Customer Support</h6>
              <p>Respond to inquiries, resolve issues, provide technical assistance, process warranty claims.</p>
            </div>

            <div class="purpose-item mb-3">
              <h6 class="fw-bold"><i class="bi bi-shield-check me-2 text-warning"></i>Security & Fraud Prevention</h6>
              <p>Detect suspicious activities, prevent unauthorized access, comply with legal requirements.</p>
            </div>

            <div class="purpose-item mb-3">
              <h6 class="fw-bold"><i class="bi bi-graph-up me-2 text-info"></i>Service Improvement</h6>
              <p>Analyze usage patterns, test new features, optimize website performance, enhance user experience.</p>
            </div>

            <div class="purpose-item mb-3">
              <h6 class="fw-bold"><i class="bi bi-envelope me-2 text-secondary"></i>Communications</h6>
              <p>Send order updates, promotional offers (with consent), important policy changes, newsletter content.</p>
            </div>
          </div>

          <div class="legal-basis mt-4">
            <h6 class="fw-bold">Legal Basis for Processing (GDPR)</h6>
            <ul class="privacy-list">
              <li><strong>Contract Performance:</strong> Processing orders and providing services</li>
              <li><strong>Legitimate Interest:</strong> Fraud prevention, analytics, customer support</li>
              <li><strong>Consent:</strong> Marketing communications, optional features</li>
              <li><strong>Legal Obligation:</strong> Tax records, fraud reporting, regulatory compliance</li>
            </ul>
          </div>
        </div>
      `,
      lastUpdated: 'December 10, 2024'
    },
    {
      id: 'cookies-tracking',
      title: 'Cookies & Tracking Technologies',
      icon: 'bi-cookie',
      body: `
        <div class="cookies-section">
          <p>We use cookies and similar technologies to enhance your browsing experience and analyze site usage.</p>
          
          <div class="cookie-types">
            <div class="cookie-type mb-4">
              <h6 class="fw-bold text-success"><i class="bi bi-check-circle me-2"></i>Essential Cookies</h6>
              <p>Required for basic site functionality, security, and user authentication. These cannot be disabled.</p>
              <ul class="privacy-list small">
                <li>Session management and login status</li>
                <li>Shopping cart contents</li>
                <li>Security tokens and CSRF protection</li>
              </ul>
            </div>

            <div class="cookie-type mb-4">
              <h6 class="fw-bold text-primary"><i class="bi bi-graph-up me-2"></i>Analytics Cookies</h6>
              <p>Help us understand how visitors interact with our website to improve performance.</p>
              <ul class="privacy-list small">
                <li>Google Analytics (anonymized data)</li>
                <li>Page view statistics</li>
                <li>User behavior patterns</li>
              </ul>
            </div>

            <div class="cookie-type mb-4">
              <h6 class="fw-bold text-info"><i class="bi bi-person-check me-2"></i>Preference Cookies</h6>
              <p>Remember your choices and preferences for a personalized experience.</p>
              <ul class="privacy-list small">
                <li>Language and currency settings</li>
                <li>Theme preferences (dark/light mode)</li>
                <li>Recently viewed products</li>
              </ul>
            </div>

            <div class="cookie-type mb-4">
              <h6 class="fw-bold text-warning"><i class="bi bi-megaphone me-2"></i>Marketing Cookies</h6>
              <p>Used to deliver relevant advertisements and track campaign effectiveness.</p>
              <ul class="privacy-list small">
                <li>Facebook Pixel (if consent given)</li>
                <li>Google Ads conversion tracking</li>
                <li>Retargeting campaigns</li>
              </ul>
            </div>
          </div>

          <div class="cookie-controls mt-4">
            <h6 class="fw-bold">Your Cookie Choices</h6>
            <p>You can control cookies through:</p>
            <ul class="privacy-list">
              <li><strong>Cookie Banner:</strong> Manage preferences when you first visit</li>
              <li><strong>Browser Settings:</strong> Block or delete cookies at any time</li>
              <li><strong>Opt-out Links:</strong> Disable specific tracking services</li>
            </ul>
            
            <div class="alert alert-warning mt-3">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Note:</strong> Disabling essential cookies may affect site functionality and your user experience.
            </div>
          </div>
        </div>
      `,
      lastUpdated: 'December 5, 2024'
    },
    {
      id: 'data-sharing',
      title: 'Data Sharing & Third Parties',
      icon: 'bi-share',
      body: `
        <div class="data-sharing">
          <p>We only share your information with trusted partners under strict contractual obligations:</p>
          
          <div class="sharing-categories">
            <div class="sharing-category mb-4">
              <h6 class="fw-bold text-primary"><i class="bi bi-truck me-2"></i>Shipping & Logistics</h6>
              <ul class="privacy-list">
                <li><strong>Delivery Partners:</strong> Name, address, phone for package delivery</li>
                <li><strong>Tracking Services:</strong> Order status and delivery updates</li>
                <li><strong>Returns Processing:</strong> Return address and product information</li>
              </ul>
            </div>

            <div class="sharing-category mb-4">
              <h6 class="fw-bold text-success"><i class="bi bi-credit-card me-2"></i>Payment Processing</h6>
              <ul class="privacy-list">
                <li><strong>Payment Gateways:</strong> Stripe, PayPal for secure transactions</li>
                <li><strong>Fraud Detection:</strong> Transaction monitoring services</li>
                <li><strong>Financial Reporting:</strong> Tax and regulatory compliance</li>
              </ul>
            </div>

            <div class="sharing-category mb-4">
              <h6 class="fw-bold text-info"><i class="bi bi-cloud me-2"></i>Technology Partners</h6>
              <ul class="privacy-list">
                <li><strong>Cloud Hosting:</strong> AWS, Google Cloud for data storage</li>
                <li><strong>Analytics:</strong> Google Analytics, Hotjar for insights</li>
                <li><strong>Customer Support:</strong> Zendesk, Intercom for help desk</li>
              </ul>
            </div>

            <div class="sharing-category mb-4">
              <h6 class="fw-bold text-warning"><i class="bi bi-shield me-2"></i>Legal Requirements</h6>
              <p>We may disclose information when required by law:</p>
              <ul class="privacy-list">
                <li>Court orders or legal proceedings</li>
                <li>Regulatory investigations</li>
                <li>Tax authorities and government agencies</li>
                <li>Law enforcement (with proper legal basis)</li>
              </ul>
            </div>
          </div>

          <div class="no-sale-policy mt-4">
            <div class="alert alert-success">
              <h6 class="fw-bold mb-2"><i class="bi bi-shield-check me-2"></i>Our No-Sale Promise</h6>
              <p class="mb-0">We <strong>never</strong> sell, rent, or lease your personal information to third parties for their marketing purposes. Your data is not a commodity to us.</p>
            </div>
          </div>
        </div>
      `,
      lastUpdated: 'December 1, 2024'
    },
    {
      id: 'user-rights',
      title: 'Your Privacy Rights',
      icon: 'bi-person-check',
      body: `
        <div class="user-rights">
          <p>Depending on your location, you have various rights regarding your personal data:</p>
          
          <div class="rights-by-region">
            <div class="region-rights mb-4">
              <h6 class="fw-bold text-primary"><i class="bi bi-flag me-2"></i>GDPR Rights (EU Residents)</h6>
              <div class="row">
                <div class="col-md-6">
                  <ul class="privacy-list">
                    <li><strong>Access:</strong> Request a copy of your data</li>
                    <li><strong>Rectification:</strong> Correct inaccurate information</li>
                    <li><strong>Erasure:</strong> Request deletion of your data</li>
                    <li><strong>Portability:</strong> Export your data in a standard format</li>
                  </ul>
                </div>
                <div class="col-md-6">
                  <ul class="privacy-list">
                    <li><strong>Restrict Processing:</strong> Limit how we use your data</li>
                    <li><strong>Object:</strong> Opt-out of certain processing activities</li>
                    <li><strong>Withdraw Consent:</strong> Revoke previously given permissions</li>
                    <li><strong>Lodge Complaints:</strong> Contact your local data protection authority</li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="region-rights mb-4">
              <h6 class="fw-bold text-success"><i class="bi bi-flag-usa me-2"></i>CCPA Rights (California Residents)</h6>
              <ul class="privacy-list">
                <li><strong>Know:</strong> What personal information we collect and how it's used</li>
                <li><strong>Delete:</strong> Request deletion of your personal information</li>
                <li><strong>Sell:</strong> Opt-out of the sale of personal information (we don't sell data)</li>
                <li><strong>Non-Discrimination:</strong> Equal service regardless of privacy choices</li>
              </ul>
            </div>
          </div>

          <div class="exercise-rights mt-4">
            <h6 class="fw-bold">How to Exercise Your Rights</h6>
            <div class="contact-methods">
              <div class="row">
                <div class="col-md-6">
                  <div class="contact-method p-3 border rounded">
                    <h6><i class="bi bi-envelope me-2"></i>Email Us</h6>
                    <p class="mb-2">Send your request to:</p>
                    <a href="mailto:${this.contactInfo.email}" class="text-decoration-none fw-bold">${this.contactInfo.email}</a>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="contact-method p-3 border rounded">
                    <h6><i class="bi bi-telephone me-2"></i>Call Us</h6>
                    <p class="mb-2">Speak with our privacy team:</p>
                    <a href="tel:${this.contactInfo.phone}" class="text-decoration-none fw-bold">${this.contactInfo.phone}</a>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="alert alert-info mt-3">
              <i class="bi bi-clock me-2"></i>
              <strong>Response Time:</strong> We'll respond to your privacy requests within 30 days (or sooner when possible).
            </div>
          </div>
        </div>
      `,
      lastUpdated: 'November 30, 2024'
    },
    {
      id: 'data-security',
      title: 'Data Security & Retention',
      icon: 'bi-shield-lock',
      body: `
        <div class="data-security">
          <h6 class="fw-bold mb-3"><i class="bi bi-shield-check me-2 text-success"></i>Security Measures</h6>
          <p>We implement multiple layers of security to protect your information:</p>
          
          <div class="security-measures">
            <div class="row">
              <div class="col-md-6">
                <div class="security-item mb-3">
                  <h6 class="fw-semibold"><i class="bi bi-lock me-2"></i>Encryption</h6>
                  <ul class="privacy-list small">
                    <li>TLS 1.3 for data in transit</li>
                    <li>AES-256 for data at rest</li>
                    <li>End-to-end encryption for sensitive data</li>
                  </ul>
                </div>
                
                <div class="security-item mb-3">
                  <h6 class="fw-semibold"><i class="bi bi-person-badge me-2"></i>Access Control</h6>
                  <ul class="privacy-list small">
                    <li>Role-based access permissions</li>
                    <li>Multi-factor authentication</li>
                    <li>Regular access reviews</li>
                  </ul>
                </div>
              </div>
              
              <div class="col-md-6">
                <div class="security-item mb-3">
                  <h6 class="fw-semibold"><i class="bi bi-eye me-2"></i>Monitoring</h6>
                  <ul class="privacy-list small">
                    <li>24/7 security monitoring</li>
                    <li>Intrusion detection systems</li>
                    <li>Regular vulnerability scans</li>
                  </ul>
                </div>
                
                <div class="security-item mb-3">
                  <h6 class="fw-semibold"><i class="bi bi-building me-2"></i>Compliance</h6>
                  <ul class="privacy-list small">
                    <li>SOC 2 Type II certified</li>
                    <li>PCI DSS compliance</li>
                    <li>Regular security audits</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div class="retention-policy mt-4">
            <h6 class="fw-bold mb-3"><i class="bi bi-clock-history me-2 text-warning"></i>Data Retention</h6>
            <p>We keep your information only as long as necessary:</p>
            <ul class="privacy-list">
              <li><strong>Account Data:</strong> Until account deletion or 3 years of inactivity</li>
              <li><strong>Transaction Records:</strong> 7 years for tax and legal compliance</li>
              <li><strong>Support Communications:</strong> 2 years after case closure</li>
              <li><strong>Marketing Data:</strong> Until consent is withdrawn</li>
              <li><strong>Analytics Data:</strong> Anonymized after 26 months</li>
            </ul>
          </div>

          <div class="breach-response mt-4">
            <h6 class="fw-bold mb-3"><i class="bi bi-exclamation-triangle me-2 text-danger"></i>Data Breach Response</h6>
            <p>In the unlikely event of a security incident:</p>
            <ul class="privacy-list">
              <li>We'll investigate and contain the breach immediately</li>
              <li>Affected users will be notified within 72 hours</li>
              <li>Relevant authorities will be informed as required by law</li>
              <li>We'll provide clear information about steps to protect yourself</li>
            </ul>
          </div>
        </div>
      `,
      lastUpdated: 'December 12, 2024'
    },
    {
      id: 'policy-updates',
      title: 'Policy Updates & Changes',
      icon: 'bi-arrow-clockwise',
      body: `
        <div class="policy-updates">
          <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors.</p>
          
          <div class="update-process">
            <h6 class="fw-bold mb-3"><i class="bi bi-bell me-2 text-info"></i>How We Handle Updates</h6>
            <ul class="privacy-list">
              <li><strong>Advance Notice:</strong> We'll notify you of significant changes at least 30 days before they take effect</li>
              <li><strong>Email Notification:</strong> Registered users will receive update notifications via email</li>
              <li><strong>Website Banner:</strong> Important changes will be highlighted on our website</li>
              <li><strong>Version History:</strong> Previous versions are archived for your reference</li>
            </ul>
          </div>

          <div class="change-types mt-4">
            <h6 class="fw-bold mb-3">Types of Changes</h6>
            <div class="row">
              <div class="col-md-6">
                <div class="change-type mb-3">
                  <h6 class="fw-semibold text-success"><i class="bi bi-check-circle me-2"></i>Minor Updates</h6>
                  <ul class="privacy-list small">
                    <li>Clarifications to existing policies</li>
                    <li>Contact information updates</li>
                    <li>Formatting improvements</li>
                  </ul>
                </div>
              </div>
              <div class="col-md-6">
                <div class="change-type mb-3">
                  <h6 class="fw-semibold text-warning"><i class="bi bi-exclamation-circle me-2"></i>Major Changes</h6>
                  <ul class="privacy-list small">
                    <li>New data collection practices</li>
                    <li>Changes to data sharing</li>
                    <li>Updated user rights</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div class="version-info mt-4">
            <div class="alert alert-primary">
              <h6 class="fw-bold mb-2"><i class="bi bi-info-circle me-2"></i>Current Version</h6>
              <ul class="list-unstyled mb-0">
                <li><strong>Version:</strong> ${this.version}</li>
                <li><strong>Last Updated:</strong> ${this.lastUpdated}</li>
                <li><strong>Effective Date:</strong> ${this.effectiveDate}</li>
              </ul>
            </div>
          </div>
        </div>
      `,
      lastUpdated: 'December 15, 2024'
    },
    {
      id: 'contact-support',
      title: 'Contact & Support',
      icon: 'bi-headset',
      body: `
        <div class="contact-support">
          <p>Have questions about this Privacy Policy or how we handle your data? We're here to help.</p>
          
          <div class="contact-options">
            <div class="row">
              <div class="col-md-4">
                <div class="contact-card text-center p-3 border rounded h-100">
                  <i class="bi bi-envelope-fill fs-2 text-primary mb-3"></i>
                  <h6 class="fw-bold">Email Support</h6>
                  <p class="small text-muted mb-3">Get detailed responses to your privacy questions</p>
                  <a href="mailto:${this.contactInfo.email}" class="btn btn-outline-primary btn-sm">
                    ${this.contactInfo.email}
                  </a>
                </div>
              </div>
              
              <div class="col-md-4">
                <div class="contact-card text-center p-3 border rounded h-100">
                  <i class="bi bi-telephone-fill fs-2 text-success mb-3"></i>
                  <h6 class="fw-bold">Phone Support</h6>
                  <p class="small text-muted mb-3">Speak directly with our privacy team</p>
                  <a href="tel:${this.contactInfo.phone}" class="btn btn-outline-success btn-sm">
                    ${this.contactInfo.phone}
                  </a>
                </div>
              </div>
              
              <div class="col-md-4">
                <div class="contact-card text-center p-3 border rounded h-100">
                  <i class="bi bi-geo-alt-fill fs-2 text-info mb-3"></i>
                  <h6 class="fw-bold">Postal Address</h6>
                  <p class="small text-muted mb-3">Send written inquiries or legal notices</p>
                  <address class="small mb-0">
                    ${this.contactInfo.address}
                  </address>
                </div>
              </div>
            </div>
          </div>

          <div class="response-times mt-4">
            <h6 class="fw-bold mb-3"><i class="bi bi-clock me-2 text-warning"></i>Response Times</h6>
            <div class="row">
              <div class="col-md-6">
                <ul class="privacy-list">
                  <li><strong>General Inquiries:</strong> Within 2 business days</li>
                  <li><strong>Privacy Requests:</strong> Within 30 days</li>
                </ul>
              </div>
              <div class="col-md-6">
                <ul class="privacy-list">
                  <li><strong>Urgent Matters:</strong> Within 24 hours</li>
                  <li><strong>Data Breach Reports:</strong> Immediate response</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="privacy-officer mt-4">
            <div class="alert alert-info">
              <h6 class="fw-bold mb-2"><i class="bi bi-person-badge me-2"></i>Data Protection Officer</h6>
              <p class="mb-1">For complex privacy matters, you can contact our Data Protection Officer directly:</p>
              <p class="mb-0"><strong>Email:</strong> dpo@ourstore.com | <strong>Phone:</strong> +20 123 456 7891</p>
            </div>
          </div>
        </div>
      `
    }
  ];

  ngOnInit() {
    // Optionally expand the first section by default
    this.expandedSections.add('introduction');
  }

  /**
   * Toggle accordion section
   */
  toggleSection(sectionId: string) {
    if (this.expandedSections.has(sectionId)) {
      this.expandedSections.delete(sectionId);
    } else {
      this.expandedSections.add(sectionId);
    }
  }
  trackBySection(index: number, section: PolicySection): string {
  return section.id;
}
  /**
   * Check if section is expanded
   */
  isSectionExpanded(sectionId: string): boolean {
    return this.expandedSections.has(sectionId);
  }

  /**
   * Expand all sections
   */
  expandAll() {
    this.sections.forEach(section => {
      this.expandedSections.add(section.id);
    });
  }

  /**
   * Collapse all sections
   */
  collapseAll() {
    this.expandedSections.clear();
  }

  /**
   * Print the privacy policy
   */
  printPolicy() {
    window.print();
  }

  /**
   * Download policy as PDF (placeholder for future implementation)
   */
  downloadPDF() {
    // TODO: Implement PDF generation
    console.log('PDF download feature to be implemented');
  }
}