/* THE CULINARY ATLAS - ONLINE ORDERING LOGIC */

document.addEventListener('DOMContentLoaded', () => {
  initOrderSystem();
});

function initOrderSystem() {
  // 1. Food Menu Catalog Metadata
  const menuMetadata = {
    'it-tagliolini': { name: 'Truffle Tagliolini', price: 1250, cuisine: 'Italian' },
    'it-margherita': { name: 'Margherita D.O.C.', price: 850, cuisine: 'Italian' },
    'it-ribeye': { name: 'Fiorentina Ribeye', price: 2400, cuisine: 'Italian' },
    'in-biryani': { name: 'Royal Awadhi Biryani', price: 950, cuisine: 'Indian' },
    'in-butterchicken': { name: 'Signature Butter Chicken', price: 850, cuisine: 'Indian' },
    'in-paneer': { name: 'Nazaqati Paneer Tikka', price: 750, cuisine: 'Indian' },
    'zh-duck': { name: 'Imperial Peking Duck', price: 1800, cuisine: 'Chinese' },
    'zh-dumplings': { name: 'Jade Dumplings', price: 900, cuisine: 'Chinese' },
    'zh-seabass': { name: 'Szechuan Chili Sea Bass', price: 1600, cuisine: 'Chinese' },
    'ja-nigiri': { name: 'Omakase Nigiri', price: 2200, cuisine: 'Japanese' },
    'ja-wagyu': { name: 'A5 Wagyu Tataki', price: 2600, cuisine: 'Japanese' },
    'ja-ramen': { name: 'Kuro Hana Ramen', price: 1100, cuisine: 'Japanese' },
    'mx-lobster': { name: 'Tulum Lobster Tacos', price: 1200, cuisine: 'Mexican' },
    'mx-barbacoa': { name: 'Ancho Chili Barbacoa', price: 950, cuisine: 'Mexican' },
    'mx-guacamole': { name: 'Smoked Mezcal Guacamole', price: 650, cuisine: 'Mexican' }
  };

  // Fixed luxury delivery fee
  const deliveryFee = 150;

  // 2. Initialize Supabase client / Mock Database Fallback
  let supabase = null;
  if (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    try {
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      console.log('Supabase client initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
    }
  } else {
    console.warn('Supabase credentials missing in config.js. Falling back to LocalStorage Mock database.');
  }

  // Initialize EmailJS client / Mock Fallback
  let isEmailJSActive = false;
  if (typeof CONFIG !== 'undefined' && CONFIG.EMAILJS_PUBLIC_KEY && CONFIG.EMAILJS_SERVICE_ID && CONFIG.EMAILJS_TEMPLATE_ID_OWNER) {
    try {
      window.emailjs.init({
        publicKey: CONFIG.EMAILJS_PUBLIC_KEY,
      });
      isEmailJSActive = true;
      console.log('EmailJS client initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize EmailJS client:', err);
    }
  } else {
    console.warn('EmailJS credentials missing in config.js. Email sending will run in Mock Mode.');
  }

  // Helper to format date and time nicely
  function formatDateTime(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // Send email notifications to the owner and optionally the customer using EmailJS or Fallback Mock
  async function sendEmailNotifications(order) {
    // Generate order item list text formatted as requested: name x quantity
    let itemsStr = '';
    order.ordered_items.forEach((item, index) => {
      itemsStr += `${item.name} x ${item.quantity}${index < order.ordered_items.length - 1 ? '\n' : ''}`;
    });

    const emailParams = {
      order_id: order.order_id,
      customer_name: order.customer_name,
      phone: order.phone_number,
      customer_email: order.email || 'None',
      delivery_address: order.delivery_address,
      items: itemsStr,
      subtotal: `₹${order.subtotal.toLocaleString()}`,
      delivery_fee: `₹${order.delivery_fee.toLocaleString()}`,
      grand_total: `₹${order.grand_total.toLocaleString()}`,
      notes: order.additional_notes || 'None'
    };

    let ownerSent = false;
    let customerSent = false;

    if (isEmailJSActive) {
      try {
        // 1. Send to Restaurant Owner
        await window.emailjs.send(
          CONFIG.EMAILJS_SERVICE_ID,
          CONFIG.EMAILJS_TEMPLATE_ID_OWNER,
          emailParams
        );
        ownerSent = true;
        console.log(`EmailJS: Notification sent to restaurant owner for order ${order.order_id}`);

        // 2. Send to Customer if email is provided
        if (order.email && CONFIG.EMAILJS_TEMPLATE_ID_CUSTOMER) {
          await window.emailjs.send(
            CONFIG.EMAILJS_SERVICE_ID,
            CONFIG.EMAILJS_TEMPLATE_ID_CUSTOMER,
            emailParams
          );
          customerSent = true;
          console.log(`EmailJS: Confirmation receipt sent to customer (${order.email}) for order ${order.order_id}`);
        } else {
          customerSent = true; // Mark as successful if customer email wasn't provided
        }
      } catch (error) {
        console.error('EmailJS dispatch failed:', error);
        throw error;
      }
    } else {
      // Mock mode logging
      console.log('%c[CULINARY ATLAS EMAIL SERVICE - MOCK MODE]', 'color: #D4AF37; font-weight: bold;');
      console.log(`Owner Email Sent To: ${CONFIG.RESTAURANT_EMAIL || 'forlogin1402@gmail.com'}`);
      console.log(`Subject: New Order Received - ${emailParams.order_id}`);
      console.log(`Content:\n`, emailParams.items);
      ownerSent = true;

      if (order.email) {
        console.log(`Customer Confirmation Email Sent To: ${order.email}`);
        console.log(`Subject: Your Culinary Atlas Order Has Been Received`);
        console.log(`Content: Thank you for ordering with The Culinary Atlas. Order ID: ${order.order_id}. Est. Response Time: 10-15 mins.`);
        customerSent = true;
      } else {
        customerSent = true;
      }
    }

    if (ownerSent && customerSent) {
      // Update status in DB
      await updateNotificationStatus(order.order_id, 'Email Sent');
      order.notification_status = 'Email Sent';
    }
  }

  // Update notification status in database
  async function updateNotificationStatus(orderId, status) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ notification_status: status })
          .eq('order_id', orderId);
        if (error) throw error;
        console.log(`Database updated notification_status for ${orderId} to: ${status}`);
      } catch (err) {
        console.error(`Failed to update DB notification_status for ${orderId}:`, err);
      }
    } else {
      // Mock database update
      try {
        const localOrders = JSON.parse(localStorage.getItem('atlas_mock_orders') || '[]');
        const idx = localOrders.findIndex(o => o.order_id === orderId);
        if (idx !== -1) {
          localOrders[idx].notification_status = status;
          localStorage.setItem('atlas_mock_orders', JSON.stringify(localOrders));
          console.log(`Mock DB updated notification_status for ${orderId} to: ${status}`);
        }
      } catch (err) {
        console.warn('Failed to update mock database notification_status:', err);
      }
    }
  }

  // Get next Order Reference ID (e.g. ATLAS-1001)
  async function generateOrderId() {
    let nextId = 1001;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('order_id')
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) {
          const lastId = data[0].order_id;
          const match = lastId.match(/ATLAS-(\d+)/);
          if (match) {
            nextId = parseInt(match[1]) + 1;
          }
        }
      } catch (err) {
        console.error("Error fetching last order ID from Supabase, falling back to LocalStorage checks:", err);
      }
    }
    
    // Check localStorage fallback to ensure unique sequence
    try {
      const localOrders = JSON.parse(localStorage.getItem('atlas_mock_orders') || '[]');
      if (localOrders.length > 0) {
        localOrders.forEach(o => {
          const match = o.order_id.match(/ATLAS-(\d+)/);
          if (match) {
            const num = parseInt(match[1]);
            if (num >= nextId) {
              nextId = num + 1;
            }
          }
        });
      }
    } catch (err) {
      console.warn("Could not read local orders for generating ID:", err);
    }
    return `ATLAS-${nextId}`;
  }

  // Save order to database (Supabase or LocalStorage Mock)
  async function saveOrder(orderData) {
    if (supabase) {
      const { data, error } = await supabase
        .from('orders')
        .insert([orderData]);
      if (error) {
        throw error;
      }
      return data;
    } else {
      // LocalStorage Mock
      const localOrders = JSON.parse(localStorage.getItem('atlas_mock_orders') || '[]');
      localOrders.push(orderData);
      localStorage.setItem('atlas_mock_orders', JSON.stringify(localOrders));
      console.log('Mock database updated. Orders count:', localOrders.length);
      return localOrders;
    }
  }

  // Helper to generate formatted restaurant notification
  function generateRestaurantNotificationText(order) {
    let itemsStr = '';
    order.ordered_items.forEach(item => {
      itemsStr += `* ${item.name} × ${item.quantity}\n`;
    });

    return `New Order Received\n\n` +
           `Order ID: ${order.order_id}\n\n` +
           `Customer: ${order.customer_name}\n` +
           `Phone: ${order.phone_number}\n\n` +
           `Address:\n` +
           `${order.delivery_address}\n\n` +
           `Order:\n` +
           `${itemsStr}\n` +
           `Total: ₹${order.grand_total.toLocaleString()}\n\n` +
           `Status: ${order.order_status}`;
  }

  // Cart state initialized from sessionStorage
  let cart = [];
  try {
    cart = JSON.parse(sessionStorage.getItem('order_cart') || '[]');
  } catch (err) {
    console.warn('SessionStorage is disabled or unavailable:', err);
  }

  // 3. UI References
  const steps = document.querySelectorAll('.wizard-step');
  const desktopCartContainer = document.querySelector('.desktop-cart-panel .cart-items-container');
  const drawerItemsContainer = document.querySelector('.mobile-cart-drawer .drawer-items-list');
  const checkoutSummaryContainer = document.querySelector('.checkout-summary-panel .summary-items-list');
  const reviewItemsContainer = document.querySelector('.review-items-table');
  const reviewDetailsContainer = document.querySelector('.review-details-block');
  
  const addressForm = document.getElementById('address-form');
  const placeOrderBtn = document.querySelector('.place-order-whatsapp-btn');
  
  // Mobile Floating Bar references
  const mobileCartBar = document.querySelector('.mobile-cart-bar');
  const mobileCartCount = document.querySelector('.mobile-cart-count');
  const mobileCartTotal = document.querySelector('.mobile-cart-total');
  const mobileViewCartBtn = document.querySelector('.mobile-view-cart-btn');
  const drawerOverlay = document.querySelector('.cart-drawer-overlay');
  const closeDrawerBtn = document.querySelector('.close-drawer-btn');

  // Customer checkout state
  let customerDetails = {};

  // 4. Cart Core Functions
  function saveCart() {
    try {
      sessionStorage.setItem('order_cart', JSON.stringify(cart));
    } catch (err) {
      console.warn('Failed to save cart to SessionStorage:', err);
    }
    updateUI();
  }

  function addToCart(id) {
    const item = cart.find(c => c.id === id);
    if (item) {
      item.quantity += 1;
    } else {
      const meta = menuMetadata[id];
      if (meta) {
        cart.push({
          id: id,
          name: meta.name,
          price: meta.price,
          cuisine: meta.cuisine,
          quantity: 1
        });
      }
    }
    saveCart();
  }

  function removeFromCart(id) {
    const item = cart.find(c => c.id === id);
    if (item) {
      item.quantity -= 1;
      if (item.quantity <= 0) {
        cart = cart.filter(c => c.id !== id);
      }
    }
    saveCart();
  }

  function deleteItem(id) {
    cart = cart.filter(c => c.id !== id);
    saveCart();
  }

  function getCartSubtotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  function getCartItemsCount() {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }

  // 5. Update UI Sync function
  function updateUI() {
    const subtotal = getCartSubtotal();
    const count = getCartItemsCount();
    const isCartEmpty = cart.length === 0;

    // A. Sync Quantity selectors in the catalog
    document.querySelectorAll('.dish-card').forEach(card => {
      const id = card.getAttribute('data-id');
      const item = cart.find(c => c.id === id);
      const qtyVal = card.querySelector('.qty-val');
      
      if (item) {
        card.classList.add('in-cart');
        if (qtyVal) qtyVal.textContent = item.quantity;
      } else {
        card.classList.remove('in-cart');
        if (qtyVal) qtyVal.textContent = '0';
      }
    });

    // B. Render Desktop sticky Cart panel
    if (desktopCartContainer) {
      if (isCartEmpty) {
        desktopCartContainer.innerHTML = `
          <div class="empty-cart-message">
            <span class="empty-cart-icon">🛒</span>
            <p>Select exceptional dishes from our world catalog to begin order.</p>
          </div>
        `;
      } else {
        desktopCartContainer.innerHTML = '';
        cart.forEach(item => {
          const row = document.createElement('div');
          row.className = 'cart-item-row';
          row.innerHTML = `
            <div class="cart-item-info">
              <div class="cart-item-name">${item.name}</div>
              <div class="cart-item-price">₹${item.price.toLocaleString()}</div>
            </div>
            <div class="cart-item-actions">
              <div class="cart-item-qty-control">
                <button class="qty-btn dec" data-id="${item.id}">&minus;</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-btn inc" data-id="${item.id}">&plus;</button>
              </div>
              <button class="cart-item-remove-btn" data-id="${item.id}">&times;</button>
            </div>
          `;
          desktopCartContainer.appendChild(row);
        });
      }
    }

    // C. Render Mobile Cart Drawer List
    if (drawerItemsContainer) {
      if (isCartEmpty) {
        drawerItemsContainer.innerHTML = `
          <div class="empty-cart-message">
            <span class="empty-cart-icon">🛒</span>
            <p>Your order registry is currently empty.</p>
          </div>
        `;
      } else {
        drawerItemsContainer.innerHTML = '';
        cart.forEach(item => {
          const row = document.createElement('div');
          row.className = 'cart-item-row';
          row.innerHTML = `
            <div class="cart-item-info">
              <div class="cart-item-name">${item.name}</div>
              <div class="cart-item-price">₹${item.price.toLocaleString()}</div>
            </div>
            <div class="cart-item-actions">
              <div class="cart-item-qty-control">
                <button class="qty-btn dec" data-id="${item.id}">&minus;</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-btn inc" data-id="${item.id}">&plus;</button>
              </div>
              <button class="cart-item-remove-btn" data-id="${item.id}">&times;</button>
            </div>
          `;
          drawerItemsContainer.appendChild(row);
        });
      }
    }

    // D. Update Billing summaries globally
    const finalDeliveryFee = isCartEmpty ? 0 : deliveryFee;
    const grandTotal = subtotal + finalDeliveryFee;

    document.querySelectorAll('.bill-val.subtotal, .subtotal-val, .review-subtotal-val').forEach(el => {
      el.textContent = `₹${subtotal.toLocaleString()}`;
    });
    document.querySelectorAll('.bill-val.delivery, .delivery-val, .review-delivery-val').forEach(el => {
      el.textContent = `₹${finalDeliveryFee.toLocaleString()}`;
    });
    document.querySelectorAll('.bill-val.grand-total, .grand-val, .review-grand-val').forEach(el => {
      el.textContent = `₹${grandTotal.toLocaleString()}`;
    });

    // E. Enable / Disable checkout buttons
    document.querySelectorAll('.checkout-proceed-btn').forEach(btn => {
      btn.disabled = isCartEmpty;
    });

    // F. Sync Mobile Floating Cart Bar
    if (mobileCartBar) {
      if (isCartEmpty) {
        mobileCartBar.style.display = 'none';
        drawerOverlay.classList.remove('active');
        document.body.classList.remove('menu-open-lock');
      } else {
        mobileCartBar.style.display = 'flex';
        if (mobileCartCount) mobileCartCount.textContent = `${count} Item${count > 1 ? 's' : ''}`;
        if (mobileCartTotal) mobileCartTotal.textContent = `₹${subtotal.toLocaleString()}`;
      }
    }
  }

  // 6. Bind Catalog click events (Using delegation for responsiveness)
  document.querySelector('.menu-catalog-list').addEventListener('click', (e) => {
    const addBtn = e.target.closest('.add-to-cart-btn');
    const incBtn = e.target.closest('.qty-btn.inc');
    const decBtn = e.target.closest('.qty-btn.dec');
    const card = e.target.closest('.dish-card');
    
    if (card) {
      const id = card.getAttribute('data-id');
      if (addBtn) addToCart(id);
      if (incBtn) addToCart(id);
      if (decBtn) removeFromCart(id);
    }
  });

  // Bind Cart Panels click events (Desktop & Mobile)
  const bindCartPanelActions = (container) => {
    if (container) {
      container.addEventListener('click', (e) => {
        const incBtn = e.target.closest('.qty-btn.inc');
        const decBtn = e.target.closest('.qty-btn.dec');
        const removeBtn = e.target.closest('.cart-item-remove-btn');
        
        if (incBtn) addToCart(incBtn.getAttribute('data-id'));
        if (decBtn) removeFromCart(decBtn.getAttribute('data-id'));
        if (removeBtn) deleteItem(removeBtn.getAttribute('data-id'));
      });
    }
  };

  bindCartPanelActions(desktopCartContainer);
  bindCartPanelActions(drawerItemsContainer);

  // 7. Mobile Drawer Panel Triggers
  if (mobileViewCartBtn) {
    mobileViewCartBtn.addEventListener('click', () => {
      drawerOverlay.classList.add('active');
      document.body.classList.add('menu-open-lock');
    });
  }

  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', () => {
      drawerOverlay.classList.remove('active');
      document.body.classList.remove('menu-open-lock');
    });
  }

  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', (e) => {
      if (e.target === drawerOverlay) {
        drawerOverlay.classList.remove('active');
        document.body.classList.remove('menu-open-lock');
      }
    });
  }

  // 8. Wizard Step Navigation Logic
  function switchStep(targetStepId) {
    // Hide active step
    steps.forEach(step => {
      step.classList.remove('active');
    });

    // Show target step
    const targetStep = document.getElementById(`step-${targetStepId}`);
    if (targetStep) {
      targetStep.classList.add('active');
      // Scroll to top of order wizard section
      document.getElementById('ordering-wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Trigger step specific compilations
    if (targetStepId === 'checkout-form') {
      compileCheckoutSummary();
    } else if (targetStepId === 'order-review') {
      compileReviewDetails();
    }
  }

  // Bind proceed checkout actions
  document.querySelectorAll('.checkout-proceed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchStep('checkout-form');
    });
  });

  // Bind wizard back buttons
  document.querySelectorAll('.wizard-back-btn, .edit-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-back') || btn.getAttribute('data-edit');
      if (target === 'menu') {
        switchStep('menu');
      } else if (target === 'form') {
        switchStep('checkout-form');
      }
    });
  });

  // 9. Step 2 form submit -> Step 3 Order Review
  if (addressForm) {
    addressForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Collect customer information from inputs
      customerDetails = {
        name: document.getElementById('c-name').value.trim(),
        phone: document.getElementById('c-phone').value.trim(),
        email: document.getElementById('c-email').value.trim(),
        address: document.getElementById('c-address').value.trim(),
        city: document.getElementById('c-city').value.trim(),
        state: document.getElementById('c-state').value.trim(),
        zip: document.getElementById('c-zip').value.trim(),
        landmark: document.getElementById('c-landmark').value.trim(),
        notes: document.getElementById('c-notes').value.trim()
      };

      // Switch to Order Review Step
      switchStep('order-review');
    });
  }

  // Step 2 Sidebar item compilation
  function compileCheckoutSummary() {
    if (checkoutSummaryContainer) {
      checkoutSummaryContainer.innerHTML = '';
      cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'summary-item-line';
        row.innerHTML = `
          <span><span class="qty">${item.quantity}x</span> ${item.name}</span>
          <span>₹${(item.price * item.quantity).toLocaleString()}</span>
        `;
        checkoutSummaryContainer.appendChild(row);
      });
    }
  }

  // Step 3 Order details compilation
  function compileReviewDetails() {
    // Populate Ordered Items table
    if (reviewItemsContainer) {
      reviewItemsContainer.innerHTML = '';
      cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'review-item-row';
        row.innerHTML = `
          <span><span class="qty-col">${item.quantity}x</span> ${item.name}</span>
          <span>₹${(item.price * item.quantity).toLocaleString()}</span>
        `;
        reviewItemsContainer.appendChild(row);
      });
    }

    // Populate Customer Address/Details card
    if (reviewDetailsContainer) {
      reviewDetailsContainer.innerHTML = `
        <div class="review-detail-line">
          <span class="label">Customer Identity</span>
          <span class="val"><strong>${customerDetails.name}</strong> (${customerDetails.phone})</span>
        </div>
        ${customerDetails.email ? `
        <div class="review-detail-line">
          <span class="label">Email Contact</span>
          <span class="val">${customerDetails.email}</span>
        </div>` : ''}
        <div class="review-detail-line">
          <span class="label">Delivery Destination</span>
          <span class="val">
            ${customerDetails.address},<br>
            Landmark: ${customerDetails.landmark},<br>
            ${customerDetails.city}, ${customerDetails.state} - ${customerDetails.zip}
          </span>
        </div>
        ${customerDetails.notes ? `
        <div class="review-detail-line">
          <span class="label">Notes for Concierge</span>
          <span class="val">"${customerDetails.notes}"</span>
        </div>` : ''}
      `;
    }
  }

  // 10. Confirm Place order -> Save to database first, then display Success Confirmation Page
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async () => {
      // Prevent double submission
      if (placeOrderBtn.disabled) return;
      placeOrderBtn.disabled = true;

      // Show loader spinner
      const loader = document.getElementById('checkout-loader');
      if (loader) loader.classList.add('active');

      try {
        const subtotal = getCartSubtotal();
        const grandTotal = subtotal + deliveryFee;
        
        // Generate unique order reference ID (ATLAS-XXXX)
        const orderId = await generateOrderId();

        // Format delivery address for display and storage
        const formattedAddress = `${customerDetails.address}\nLandmark: ${customerDetails.landmark}\n${customerDetails.city}, ${customerDetails.state} - ${customerDetails.zip}`;

        // Create database model payload
        const orderPayload = {
          order_id: orderId,
          customer_name: customerDetails.name,
          phone_number: customerDetails.phone,
          delivery_address: formattedAddress,
          city: customerDetails.city,
          postal_code: customerDetails.zip,
          email: customerDetails.email || null,
          ordered_items: cart, // JSON Array of items
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          grand_total: grandTotal,
          order_status: 'Pending Confirmation',
          notification_status: 'Pending', // Default status on save
          additional_notes: customerDetails.notes || null,
          created_at: new Date().toISOString()
        };

        // Save to Supabase (or LocalStorage Fallback)
        await saveOrder(orderPayload);

        // Dispatch Email Notifications (Owner & Customer)
        try {
          await sendEmailNotifications(orderPayload);
        } catch (emailErr) {
          console.error("Failed to execute email notifications:", emailErr);
          // Set database status to Failed for administrative visibility
          await updateNotificationStatus(orderId, 'Failed');
          orderPayload.notification_status = 'Failed';
        }

        // Lock order details and switch UI context
        // Populate Success Step Elements
        const successIdEl = document.getElementById('success-id');
        const successAddressEl = document.getElementById('success-address');
        const successGrandEl = document.getElementById('success-grand');
        const successItemsEl = document.getElementById('success-items-list');

        if (successIdEl) successIdEl.textContent = orderId;
        if (successAddressEl) {
          successAddressEl.innerHTML = `
            <strong>${customerDetails.name}</strong><br>
            ${customerDetails.phone}<br>
            ${customerDetails.address.replace(/\n/g, '<br>')}<br>
            Landmark: ${customerDetails.landmark}<br>
            ${customerDetails.city}, ${customerDetails.state} - ${customerDetails.zip}
          `;
        }
        if (successGrandEl) successGrandEl.textContent = `₹${grandTotal.toLocaleString()}`;

        if (successItemsEl) {
          let itemsSummaryHtml = '';
          cart.forEach(item => {
            itemsSummaryHtml += `
              <div class="success-summary-line">
                <span><span class="qty">${item.quantity}x</span> ${item.name}</span>
                <span>₹${(item.price * item.quantity).toLocaleString()}</span>
              </div>
            `;
          });
          successItemsEl.innerHTML = itemsSummaryHtml;
        }

        // Setup Copy ID button behavior
        const copyBtn = document.querySelector('.copy-id-btn');
        if (copyBtn) {
          // Recreate to clear previous event listeners
          const newCopyBtn = copyBtn.cloneNode(true);
          copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
          newCopyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(orderId).then(() => {
              newCopyBtn.textContent = 'Copied!';
              setTimeout(() => { newCopyBtn.textContent = 'Copy ID'; }, 2000);
            }).catch(err => {
              console.error('Failed to copy text: ', err);
            });
          });
        }

        // Generate prepared restaurant notification logs
        const notificationText = generateRestaurantNotificationText(orderPayload);
        console.log('%c[CULINARY ATLAS NOTIFICATION SYSTEM]', 'color: #D4AF37; font-weight: bold;');
        console.log(notificationText);

        // Clear active cart memory from state and session storage
        cart = [];
        try {
          sessionStorage.removeItem('order_cart');
        } catch (err) {}
        
        // Update catalog inputs and UI
        updateUI();

        // Transition views to the Success step
        switchStep('success');

      } catch (err) {
        console.error('Error placing Culinary Atlas order:', err);
        alert('We encountered an error securing your order. Please try again or contact concierge.');
      } finally {
        // Hide loader and re-enable button (for next sessions or failures)
        if (loader) loader.classList.remove('active');
        placeOrderBtn.disabled = false;
      }
    });
  }

  // 11. Scroll Spy Tab Observer & Smooth Scrolling
  const tabs = document.querySelectorAll('.sidebar-tab, .mobile-tab-pill');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.getAttribute('href');
      const section = document.querySelector(targetId);
      if (section) {
        // Scroll smoothly to target section
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Manual active highlight before observer fires
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      }
    });
  });

  const sections = document.querySelectorAll('.menu-cuisine-section');
  if (sections.length > 0 && 'IntersectionObserver' in window) {
    const observerOptions = {
      root: null,
      rootMargin: '-15% 0px -65% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          tabs.forEach(tab => {
            if (tab.getAttribute('href') === `#${id}`) {
              tab.classList.add('active');
              // Auto-scroll the horizontal pill container on mobile to center the active pill
              if (tab.classList.contains('mobile-tab-pill')) {
                const container = document.querySelector('.mobile-tabs-scroll');
                if (container) {
                  const leftOffset = tab.offsetLeft - (container.offsetWidth / 2) + (tab.offsetWidth / 2);
                  container.scrollTo({ left: leftOffset, behavior: 'smooth' });
                }
              }
            } else {
              tab.classList.remove('active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
  }

  // 12. Initial Sync
  updateUI();
}
