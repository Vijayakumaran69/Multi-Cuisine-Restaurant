/* THE CULINARY ATLAS - ADMIN REGISTRY LOGIC */

document.addEventListener('DOMContentLoaded', () => {
  initAdminDashboard();
});

function initAdminDashboard() {
  // 1. Authentication Check & Lock Gate
  const loginOverlay = document.getElementById('admin-login-overlay');
  const adminContent = document.getElementById('admin-panel-content');
  const passcodeForm = document.getElementById('passcode-form');
  const passcodeInput = document.getElementById('passcode-input');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('admin-logout-btn');

  function checkAuthentication() {
    const isAuth = sessionStorage.getItem('admin_authenticated') === 'true';
    if (isAuth) {
      // Unlocked
      if (loginOverlay) loginOverlay.classList.remove('active');
      if (adminContent) adminContent.style.display = 'block';
      if (logoutBtn) logoutBtn.style.display = 'block';
      loadDashboardData();
    } else {
      // Locked
      if (loginOverlay) loginOverlay.classList.add('active');
      if (adminContent) adminContent.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }

  if (passcodeForm) {
    passcodeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPasscode = passcodeInput.value.trim();
      const correctPasscode = (typeof CONFIG !== 'undefined' && CONFIG.ADMIN_PASSCODE) ? CONFIG.ADMIN_PASSCODE : 'ATLAS2026';

      if (enteredPasscode === correctPasscode) {
        sessionStorage.setItem('admin_authenticated', 'true');
        if (loginError) loginError.style.display = 'none';
        passcodeInput.value = '';
        checkAuthentication();
      } else {
        if (loginError) {
          loginError.style.display = 'block';
          // Subtle shake animation for error
          const box = document.querySelector('.login-box');
          box.style.animation = 'none';
          box.offsetHeight; // Trigger reflow
          box.style.animation = 'shake 0.4s ease';
        }
      }
    });
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('admin_authenticated');
      checkAuthentication();
    });
  }

  // Initial gate check
  checkAuthentication();

  // 2. Dashboard Logic (DB interaction)
  let orders = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let activeOrder = null;

  // Initialize Supabase / Fallback
  let supabase = null;
  if (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    try {
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      console.log('Supabase client initialized in admin panel.');
    } catch (err) {
      console.error('Failed to initialize Supabase in admin panel:', err);
    }
  }

  // Fetch all orders from Supabase / Mock database
  async function loadDashboardData() {
    const tableBody = document.getElementById('orders-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr class="table-info-row">
          <td colspan="8" class="text-center">Loading orders from registry database...</td>
        </tr>
      `;
    }

    try {
      if (supabase) {
        // Live database fetch
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        orders = data || [];
      } else {
        // Fallback LocalStorage fetch
        orders = JSON.parse(localStorage.getItem('atlas_mock_orders') || '[]');
        // Sort descending by created_at or default timestamp
        orders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }

      calculateStats();
      renderOrdersTable();
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      if (tableBody) {
        tableBody.innerHTML = `
          <tr class="table-info-row">
            <td colspan="8" class="text-center" style="color: #ff4d4d;">
              Error retrieving orders: ${err.message || 'Connection lost'}.<br>
              Check config.js credentials or network logs.
            </td>
          </tr>
        `;
      }
    }
  }

  // Compute stats metrics
  function calculateStats() {
    const totalCount = orders.length;
    const pendingCount = orders.filter(o => o.order_status === 'Pending Confirmation').length;
    const preparingCount = orders.filter(o => o.order_status === 'Preparing').length;
    const deliveringCount = orders.filter(o => o.order_status === 'Out for Delivery').length;

    document.getElementById('stat-total').textContent = totalCount;
    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('stat-preparing').textContent = preparingCount;
    document.getElementById('stat-delivering').textContent = deliveringCount;
  }

  // Date/Time helper
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

  // Create clean badge markup based on status
  function getStatusBadgeClass(status) {
    switch (status) {
      case 'Pending Confirmation': return 'pending';
      case 'Confirmed': return 'confirmed';
      case 'Preparing': return 'preparing';
      case 'Out for Delivery': return 'delivering';
      case 'Delivered': return 'delivered';
      case 'Cancelled': return 'cancelled';
      default: return 'pending';
    }
  }

  // Create clean badge markup for notification status
  function getNotifBadgeClass(status) {
    switch (status) {
      case 'Email Sent': return 'sent';
      case 'Pending': return 'pending';
      case 'Failed': return 'failed';
      default: return 'pending';
    }
  }

  // Compile list of item names and quantities
  function getItemsSummary(orderedItems) {
    if (!Array.isArray(orderedItems)) return 'No items';
    return orderedItems.map(item => `${item.name} × ${item.quantity}`).join(', ');
  }

  // Render main orders list
  function renderOrdersTable() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    // Filter orders by tab selection
    let filteredOrders = orders;
    if (currentFilter !== 'all') {
      filteredOrders = filteredOrders.filter(o => o.order_status === currentFilter);
    }

    // Filter orders by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredOrders = filteredOrders.filter(o => {
        const idMatch = o.order_id && o.order_id.toLowerCase().includes(query);
        const nameMatch = o.customer_name && o.customer_name.toLowerCase().includes(query);
        const phoneMatch = o.phone_number && o.phone_number.includes(query);
        return idMatch || nameMatch || phoneMatch;
      });
    }

    // Build markup
    if (filteredOrders.length === 0) {
      tableBody.innerHTML = `
        <tr class="table-info-row">
          <td colspan="8" class="text-center">No orders match your criteria.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = '';
    filteredOrders.forEach(order => {
      const row = document.createElement('tr');
      
      const badgeClass = getStatusBadgeClass(order.order_status);
      const itemsSummary = getItemsSummary(order.ordered_items);
      const formattedDate = formatDateTime(order.created_at);
      const notifStatus = order.notification_status || 'Pending';
      const notifClass = getNotifBadgeClass(notifStatus);

      row.innerHTML = `
        <td><a href="#" class="order-id-link" data-id="${order.order_id}">${order.order_id}</a></td>
        <td>${formattedDate}</td>
        <td>
          <div style="font-weight: 500; color: #ffffff;">${order.customer_name}</div>
          <div style="font-size: 0.75rem; color: #8e8e8e; margin-top: 0.15rem;">${order.phone_number}</div>
        </td>
        <td class="items-summary-cell" title="${itemsSummary}">${itemsSummary}</td>
        <td class="total-cell">₹${order.grand_total.toLocaleString()}</td>
        <td><span class="status-badge ${badgeClass}">${order.order_status}</span></td>
        <td><span class="notif-badge ${notifClass}">${notifStatus === 'Failed' ? '⚠️ Failed' : notifStatus}</span></td>
        <td class="text-right">
          <button class="view-details-btn" data-id="${order.order_id}">View Details</button>
        </td>
      `;

      tableBody.appendChild(row);
    });

    // Bind event listeners to ID links and action buttons
    tableBody.querySelectorAll('.order-id-link, .view-details-btn').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const id = trigger.getAttribute('data-id');
        openOrderDetails(id);
      });
    });
  }

  // 3. Search and filter listeners
  const searchInput = document.getElementById('order-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderOrdersTable();
    });
  }

  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-status');
      renderOrdersTable();
    });
  });

  // Clicking stats cards triggers filters too
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    card.addEventListener('click', () => {
      const filterVal = card.getAttribute('data-filter');
      const matchingTab = document.querySelector(`.filter-tab[data-status="${filterVal}"]`) || document.querySelector(`.filter-tab[data-status="all"]`);
      if (matchingTab) {
        matchingTab.click();
      }
    });
  });

  // 4. Details Modal display & logic
  const modalOverlay = document.getElementById('order-detail-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const updateStatusBtn = document.getElementById('update-status-btn');
  const statusSelect = document.getElementById('order-status-select');
  const copyNotifBtn = document.getElementById('copy-notif-btn');
  const notifPreviewBox = document.getElementById('notif-text-preview');

  function openOrderDetails(orderId) {
    activeOrder = orders.find(o => o.order_id === orderId);
    if (!activeOrder || !modalOverlay) return;

    // A. Text Fields
    document.getElementById('modal-order-id').textContent = activeOrder.order_id;
    document.getElementById('modal-cust-name').textContent = activeOrder.customer_name;
    document.getElementById('modal-cust-phone').textContent = activeOrder.phone_number;
    
    const emailWrapper = document.getElementById('modal-email-wrapper');
    const custEmail = document.getElementById('modal-cust-email');
    if (activeOrder.email) {
      if (emailWrapper) emailWrapper.style.display = 'flex';
      if (custEmail) custEmail.textContent = activeOrder.email;
    } else {
      if (emailWrapper) emailWrapper.style.display = 'none';
    }

    document.getElementById('modal-cust-address').innerHTML = activeOrder.delivery_address.replace(/\n/g, '<br>');
    document.getElementById('modal-cust-city-zip').textContent = `${activeOrder.city} - ${activeOrder.postal_code}`;

    const notesWrapper = document.getElementById('modal-notes-wrapper');
    const custNotes = document.getElementById('modal-cust-notes');
    if (activeOrder.additional_notes) {
      if (notesWrapper) notesWrapper.style.display = 'flex';
      if (custNotes) custNotes.textContent = `"${activeOrder.additional_notes}"`;
    } else {
      if (notesWrapper) notesWrapper.style.display = 'none';
    }

    // F. Populate notification status
    const modalNotifStatus = document.getElementById('modal-notif-status');
    if (modalNotifStatus) {
      const ns = activeOrder.notification_status || 'Pending';
      const nc = getNotifBadgeClass(ns);
      modalNotifStatus.innerHTML = `<span class="notif-badge ${nc}">${ns === 'Failed' ? '⚠️ Failed' : ns}</span>`;
    }

    // B. Items Table
    const itemsBody = document.getElementById('modal-items-body');
    if (itemsBody) {
      itemsBody.innerHTML = '';
      if (Array.isArray(activeOrder.ordered_items)) {
        activeOrder.ordered_items.forEach(item => {
          const itemTotal = item.price * item.quantity;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><span style="color: #D4AF37; font-size: 0.68rem; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">${item.cuisine || 'Atlas'}</span></td>
            <td style="font-weight: 500; color: #ffffff;">${item.name}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">₹${item.price.toLocaleString()}</td>
            <td class="text-right" style="font-weight: 500; color: #ffffff;">₹${itemTotal.toLocaleString()}</td>
          `;
          itemsBody.appendChild(tr);
        });
      }
    }

    // C. Pricing summaries
    document.getElementById('modal-subtotal').textContent = `₹${activeOrder.subtotal.toLocaleString()}`;
    document.getElementById('modal-delivery').textContent = `₹${activeOrder.delivery_fee.toLocaleString()}`;
    document.getElementById('modal-grand').textContent = `₹${activeOrder.grand_total.toLocaleString()}`;

    // D. Set current status select value
    if (statusSelect) {
      statusSelect.value = activeOrder.order_status;
    }

    // E. Load Formatted Notification Text Preview
    updateNotificationPreview();

    // Show modal
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
  }

  function updateNotificationPreview() {
    if (!activeOrder || !notifPreviewBox) return;

    let itemsStr = '';
    activeOrder.ordered_items.forEach(item => {
      itemsStr += `* ${item.name} × ${item.quantity}\n`;
    });

    const notifText = `New Order Received\n\n` +
                      `Order ID: ${activeOrder.order_id}\n\n` +
                      `Customer: ${activeOrder.customer_name}\n` +
                      `Phone: ${activeOrder.phone_number}\n\n` +
                      `Address:\n` +
                      `${activeOrder.delivery_address}\n\n` +
                      `Order:\n` +
                      `${itemsStr}\n` +
                      `Total: ₹${activeOrder.grand_total.toLocaleString()}\n\n` +
                      `Status: ${activeOrder.order_status}`;

    notifPreviewBox.textContent = notifText;
  }

  function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove('active');
    document.body.style.overflow = ''; // Restore scroll
    activeOrder = null;
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }

  // Keyboard shortcut ESC to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // Copy notification to clipboard
  if (copyNotifBtn) {
    copyNotifBtn.addEventListener('click', () => {
      if (!notifPreviewBox) return;
      navigator.clipboard.writeText(notifPreviewBox.textContent).then(() => {
        copyNotifBtn.textContent = 'Copied!';
        copyNotifBtn.style.background = '#25d366';
        copyNotifBtn.style.color = '#ffffff';
        copyNotifBtn.style.borderColor = '#25d366';
        setTimeout(() => {
          copyNotifBtn.textContent = 'Copy Text';
          copyNotifBtn.style.background = '';
          copyNotifBtn.style.color = '';
          copyNotifBtn.style.borderColor = '';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text:', err);
      });
    });
  }

  // Update order status in Database / LocalStorage
  if (updateStatusBtn && statusSelect) {
    updateStatusBtn.addEventListener('click', async () => {
      if (!activeOrder) return;

      const newStatus = statusSelect.value;
      
      updateStatusBtn.disabled = true;
      updateStatusBtn.textContent = 'Updating...';

      try {
        if (supabase) {
          // Update in Supabase
          const { error } = await supabase
            .from('orders')
            .update({ order_status: newStatus })
            .eq('order_id', activeOrder.order_id);

          if (error) throw error;
        } else {
          // Update LocalStorage Mock Database
          const localOrders = JSON.parse(localStorage.getItem('atlas_mock_orders') || '[]');
          const idx = localOrders.findIndex(o => o.order_id === activeOrder.order_id);
          if (idx !== -1) {
            localOrders[idx].order_status = newStatus;
            localStorage.setItem('atlas_mock_orders', JSON.stringify(localOrders));
          }
        }

        // Successfully updated
        activeOrder.order_status = newStatus;
        updateNotificationPreview();
        
        // Reload dashboard
        await loadDashboardData();

        // Highlight updated row on reload (visual feedback)
        setTimeout(() => {
          // Find order in newly loaded list
          const rowLink = document.querySelector(`.order-id-link[data-id="${activeOrder.order_id}"]`);
          if (rowLink) {
            const tr = rowLink.closest('tr');
            if (tr) {
              tr.style.backgroundColor = 'rgba(212, 175, 55, 0.15)';
              tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => {
                tr.style.backgroundColor = '';
              }, 2500);
            }
          }
          closeModal();
        }, 300);

      } catch (err) {
        console.error('Failed to update status:', err);
        alert('Could not update status: ' + (err.message || 'Connection lost.'));
      } finally {
        updateStatusBtn.disabled = false;
        updateStatusBtn.textContent = 'Update Status';
      }
    });
  }
}
