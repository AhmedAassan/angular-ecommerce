export const environment = {
  production: false,
  TOKEN_REFRESH_GRACE_MS: 300_000, // 5 minutes before expiry
  apiBase: 'https://www.poszonekw.com:801',
  imageBase: 'https://www.poszonekw.com/Documents/Items/',   // ✅ add this
  SESSION_TIMEOUT_MS: 7 * 24 * 60 * 60 * 1000,
};


// "base_urls": {
//       "category_image_url": "https://poszonekw.com:100/Documents/Categories/",
//       "brand_image_url": "",
//       "product_image_url": "https://poszonekw.com:100/Documents/Items/",
//       "orderType_image_url": "https://poszonekw.com:100/Documents/OrderTypes/",
//       "paymentType_image_url": "https://poszonekw.com:100/Documents/PaymentTypes/",
//       "unit_image_url": "https://poszonekw.com:100/Documents/Units/",
//       "supplier_image_url": "",
//       "shop_image_url": "https://poszonekw.com:100/Documents/Company/",
//       "admin_image_url": "",
//       "customer_image_url": ""
//     }