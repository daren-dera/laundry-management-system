const $ = window.jQuery;
let currentUser = null;
let editing = null;
let cachedCustomers = [];
let cachedServices = [];
let cachedOrders = [];
let noticeTimer;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const currency = value => 'LKR ' + Number(value || 0).toLocaleString('en-LK', {minimumFractionDigits:2, maximumFractionDigits:2});
const dateText = value => value ? new Date(value).toLocaleDateString() : '—';
const statusBadge = status => `<span class="badge ${String(status).toLowerCase()}">${esc(status)}</span>`;

async function api(url, options = {}) {
  const config = { credentials:'same-origin', ...options, headers:{ ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) } };
  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !url.includes('/auth/login')) showLogin();
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}
function showNotice(message, error = false) {
  const el = $('#notice');
  el.text(message).toggleClass('error', error).removeClass('hidden');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.addClass('hidden'), 4500);
}
function showLogin() {
  currentUser = null;
  $('#app-shell').addClass('hidden');
  $('#login-screen').removeClass('hidden');
  $('#password').val('');
}
async function enterApp(user) {
  currentUser = user;
  $('#login-screen').addClass('hidden');
  $('#app-shell').removeClass('hidden');
  $('#sidebar-name').text(user.fullName || user.username);
  $('#today-label').text(new Date().toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric', year:'numeric'}));
  await loadDashboard();
}
$('#login-form').on('submit', async function(e) {
  e.preventDefault();
  $('#login-error').text('');
  try {
    const result = await api('/api/auth/login', {method:'POST', body:JSON.stringify({username:$('#username').val().trim(), password:$('#password').val()})});
    await enterApp(result.user);
  } catch (err) { $('#login-error').text(err.message); }
});
$('#logout-btn').on('click', async () => {
  try { await api('/api/auth/logout', {method:'POST'}); } catch (_) {}
  showLogin();
});
$('#main-nav').on('click', '.nav-item', async function() {
  const page = $(this).data('page');
  $('.nav-item').removeClass('active'); $(this).addClass('active');
  $('.page').addClass('hidden'); $('#page-' + page).removeClass('hidden');
  $('#page-title').text(page[0].toUpperCase() + page.slice(1));
  try { await loadPage(page); } catch (e) { showNotice(e.message, true); }
});
$(document).on('click', '[data-go]', function() {
  const page = $(this).data('go');
  $(`.nav-item[data-page="${page}"]`).trigger('click');
});
async function loadPage(page) {
  if (page === 'dashboard') return loadDashboard();
  if (page === 'services') return loadServices();
  if (page === 'customers') return loadCustomers();
  if (page === 'orders') return loadOrders();
  if (page === 'payments') return loadPayments();
  if (page === 'reports') return loadReports();
}
async function loadDashboard() {
  const d = await api('/api/reports/summary');
  $('#stat-customers').text(d.customers); $('#stat-orders').text(d.orders); $('#stat-active').text(d.activeOrders); $('#stat-revenue').text(currency(d.revenue));
  $('#recent-orders').html(d.recent.length ? d.recent.map(o => `<tr><td><strong>#${o.id}</strong></td><td>${esc(o.customer_name)}</td><td>${esc(o.service_name)}</td><td>${currency(o.total_amount)}</td><td>${statusBadge(o.status)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No orders yet. Add a customer and create your first order.</td></tr>');
}
async function loadServices() {
  const q = $('#service-search').val() || '';
  cachedServices = await api('/api/services?q=' + encodeURIComponent(q));
  $('#services-table').html(cachedServices.length ? cachedServices.map(s => `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.description)}</td><td>${currency(s.price)}</td><td>${s.turnaround_hours} hrs</td><td>${s.active ? '<span class="badge paid">Active</span>' : '<span class="badge">Inactive</span>'}</td><td><div class="actions"><button class="text-btn" data-edit-service="${s.id}">Edit</button><button class="text-btn danger" data-delete-service="${s.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No services found.</td></tr>');
}
async function loadCustomers() {
  const q = $('#customer-search').val() || '';
  cachedCustomers = await api('/api/customers?q=' + encodeURIComponent(q));
  $('#customers-table').html(cachedCustomers.length ? cachedCustomers.map(c => `<tr><td><strong>${esc(c.full_name)}</strong></td><td>${esc(c.phone)}</td><td>${esc(c.email || '—')}</td><td>${esc(c.address || '—')}</td><td><div class="actions"><button class="text-btn" data-edit-customer="${c.id}">Edit</button><button class="text-btn danger" data-delete-customer="${c.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="5" class="empty">No customers found.</td></tr>');
}
async function loadOrders() {
  const q = $('#order-search').val() || '', status = $('#order-status-filter').val() || '';
  cachedOrders = await api('/api/orders?q=' + encodeURIComponent(q) + '&status=' + encodeURIComponent(status));
  $('#orders-table').html(cachedOrders.length ? cachedOrders.map(o => {
    const due = Math.max(0, Number(o.total_amount) - Number(o.paid_amount));
    return `<tr><td><strong>#${o.id}</strong><div class="tiny muted">${dateText(o.order_date)}</div></td><td>${esc(o.customer_name)}<div class="tiny muted">${esc(o.phone)}</div></td><td>${esc(o.service_name)}</td><td>${Number(o.quantity)}</td><td>${currency(o.total_amount)}<div class="tiny muted">Due ${currency(due)}</div></td><td><select class="status-select" data-order-status="${o.id}" aria-label="Order ${o.id} status">${['Pending','Washing','Ready','Delivered','Cancelled'].map(s => `<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td><td><div class="actions"><button class="text-btn" data-pay-order="${o.id}" ${due<=0?'disabled':''}>Pay</button><button class="text-btn danger" data-delete-order="${o.id}">Delete</button></div></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="empty">No orders found. Create a customer and service first.</td></tr>');
}
async function loadPayments() {
  const rows = await api('/api/payments');
  $('#payments-table').html(rows.length ? rows.map(p => `<tr><td><strong>${esc(p.reference_code)}</strong></td><td>#${p.order_id}</td><td>${esc(p.customer_name)}</td><td>${currency(p.amount)}</td><td>${esc(p.method)}</td><td>${statusBadge(p.status)}</td><td>${dateText(p.paid_at)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">No payments recorded yet.</td></tr>');
}
async function loadReports() {
  const d = await api('/api/reports/summary');
  $('#report-revenue').text(currency(d.revenue)); $('#report-outstanding').text(currency(d.outstanding)); $('#report-services').text(d.activeServices); $('#report-orders').text(d.orders);
  const max = Math.max(1, ...d.monthly.map(m => Number(m.revenue)));
  $('#monthly-report').html(d.monthly.length ? d.monthly.map(m => `<div class="month-column"><div class="month-bar-wrap"><div class="month-bar" style="height:${Math.max(3, Number(m.revenue)/max*100)}%"></div></div><div class="month-value">${currency(m.revenue)}</div><div class="month-name">${esc(m.month)}</div></div>`).join('') : '<p class="empty">Monthly revenue will appear after payments are recorded.</p>');
}
function field(name, label, value = '', type = 'text', extra = '') {
  return `<div class="${extra}"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''} required></div>`;
}
function textareaField(name, label, value = '') {
  return `<div class="field-full"><label for="field-${name}">${label}</label><textarea id="field-${name}" name="${name}" maxlength="500">${esc(value)}</textarea></div>`;
}
function selectField(name, label, options, value = '') {
  return `<div><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}" required>${options.map(o => `<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div>`;
}
function openRecordDialog(title, type, record = null) {
  editing = {type, id:record?.id || null};
  $('#dialog-title').text(title); $('#dialog-error').text('');
  let html = '';
  if (type === 'service') html = field('name','Service name',record?.name || '', 'text','field-full') + textareaField('description','Description',record?.description || '') + field('price','Price (LKR)',record?.price ?? '', 'number') + field('turnaround_hours','Turnaround (hours)',record?.turnaround_hours ?? 24,'number');
  if (type === 'customer') html = field('full_name','Full name',record?.full_name || '', 'text','field-full') + field('phone','Phone number',record?.phone || '') + field('email','Email (optional)',record?.email || '', 'email') + textareaField('address','Address',record?.address || '');
  if (type === 'order') {
    if (!cachedCustomers.length || !cachedServices.some(s=>s.active)) { showNotice('Add at least one customer and one active service before creating an order.', true); return; }
    html = selectField('customer_id','Customer',cachedCustomers.map(c=>({value:c.id,label:c.full_name+' — '+c.phone}))) +
      selectField('service_id','Service',cachedServices.filter(s=>s.active).map(s=>({value:s.id,label:s.name+' — '+currency(s.price)}))) +
      field('quantity','Quantity / units','1','number') + textareaField('notes','Order notes (optional)','');
  }
  $('#dialog-fields').html(html);
  document.getElementById('record-dialog').showModal();
}
function closeRecord() { document.getElementById('record-dialog').close(); editing = null; }
$('#add-service').on('click', async () => { try { await loadServices(); openRecordDialog('Add service','service'); } catch(e){showNotice(e.message,true);} });
$('#add-customer').on('click', async () => { try { await loadCustomers(); openRecordDialog('Add customer','customer'); } catch(e){showNotice(e.message,true);} });
$('#add-order').on('click', async () => { try { await loadCustomers(); await loadServices(); openRecordDialog('Create new order','order'); } catch(e){showNotice(e.message,true);} });
$('#close-dialog,#cancel-dialog').on('click', closeRecord);
$('#record-form').on('submit', async function(e) {
  e.preventDefault(); if (!editing) return;
  const values = Object.fromEntries(new FormData(this).entries());
  if (editing.type === 'service') { values.price = Number(values.price); values.turnaround_hours = Number(values.turnaround_hours); }
  if (editing.type === 'order') { values.customer_id = Number(values.customer_id); values.service_id = Number(values.service_id); values.quantity = Number(values.quantity); }
  const endpoint = editing.type === 'service' ? '/api/services' : editing.type === 'customer' ? '/api/customers' : '/api/orders';
  try {
    await api(endpoint + (editing.id ? '/' + editing.id : ''), {method:editing.id?'PUT':'POST', body:JSON.stringify(values)});
    const type = editing.type; closeRecord(); showNotice(type[0].toUpperCase()+type.slice(1)+' saved successfully.');
    await loadPage(type === 'order' ? 'orders' : type === 'service' ? 'services' : 'customers'); await loadDashboard();
  } catch(err) { $('#dialog-error').text(err.message); }
});
$(document).on('click','[data-edit-service]', async function() { try { await loadServices(); const r=cachedServices.find(x=>x.id===Number($(this).data('edit-service'))); if(r) openRecordDialog('Edit service','service',r); } catch(e){showNotice(e.message,true);} });
$(document).on('click','[data-edit-customer]', async function() { try { await loadCustomers(); const r=cachedCustomers.find(x=>x.id===Number($(this).data('edit-customer'))); if(r) openRecordDialog('Edit customer','customer',r); } catch(e){showNotice(e.message,true);} });
$(document).on('click','[data-delete-service]', async function() { const id=$(this).data('delete-service'); if(!confirm('Delete this service? Services used by orders cannot be deleted.'))return; try{await api('/api/services/'+id,{method:'DELETE'});showNotice('Service deleted.');await loadServices();}catch(e){showNotice(e.message,true);} });
$(document).on('click','[data-delete-customer]', async function() { const id=$(this).data('delete-customer'); if(!confirm('Delete this customer? Customers with orders cannot be deleted.'))return; try{await api('/api/customers/'+id,{method:'DELETE'});showNotice('Customer deleted.');await loadCustomers();}catch(e){showNotice(e.message,true);} });
$(document).on('change','[data-order-status]', async function() { const id=$(this).data('order-status'), status=$(this).val(); try{await api('/api/orders/'+id+'/status',{method:'PUT',body:JSON.stringify({status})});showNotice('Order status updated.');await loadOrders();await loadDashboard();}catch(e){showNotice(e.message,true);} });
$(document).on('click','[data-delete-order]', async function() { const id=$(this).data('delete-order'); if(!confirm('Delete this order? Orders with payment records cannot be deleted.'))return; try{await api('/api/orders/'+id,{method:'DELETE'});showNotice('Order deleted.');await loadOrders();await loadDashboard();}catch(e){showNotice(e.message,true);} });
$('#order-search').on('input', debounce(() => loadOrders().catch(e=>showNotice(e.message,true)), 250));
$('#order-status-filter').on('change', () => loadOrders().catch(e=>showNotice(e.message,true)));
$('#customer-search').on('input', debounce(() => loadCustomers().catch(e=>showNotice(e.message,true)), 250));
$('#service-search').on('input', debounce(() => loadServices().catch(e=>showNotice(e.message,true)), 250));
function debounce(fn, delay) { let timer; return (...args) => { clearTimeout(timer); timer=setTimeout(()=>fn(...args),delay); }; }

function openPaymentDialog(order = null) {
  const unpaid = cachedOrders.filter(o => o.status !== 'Cancelled' && Number(o.total_amount) > Number(o.paid_amount));
  if (!unpaid.length) { showNotice('There are no orders with an outstanding balance.', true); return; }
  const chosen = order ? unpaid.find(o=>o.id===Number(order)) : null;
  const options = unpaid.map(o=>({value:o.id,label:`#${o.id} ${o.customer_name} — balance ${currency(Number(o.total_amount)-Number(o.paid_amount))}`}));
  const selected = chosen?.id || options[0].value;
  const balance = chosen ? Number(chosen.total_amount)-Number(chosen.paid_amount) : Number(unpaid[0].total_amount)-Number(unpaid[0].paid_amount);
  $('#payment-fields').html(selectField('order_id','Order',options,selected) + field('amount','Payment amount (LKR)',balance.toFixed(2),'number') +
    selectField('method','Payment method',[{value:'Cash',label:'Cash'},{value:'Card (Mock)',label:'Card (Mock)'},{value:'Bank Transfer (Mock)',label:'Bank Transfer (Mock)'}]));
  $('#payment-error').text(''); document.getElementById('payment-dialog').showModal();
}
$('#add-payment').on('click', async()=>{try{await loadOrders();openPaymentDialog();}catch(e){showNotice(e.message,true);}});
$(document).on('click','[data-pay-order]',async function(){try{await loadOrders();openPaymentDialog($(this).data('pay-order'));}catch(e){showNotice(e.message,true);}});
function closePayment(){document.getElementById('payment-dialog').close();}
$('#close-payment-dialog,#cancel-payment').on('click',closePayment);
$('#payment-form').on('submit',async function(e){
  e.preventDefault(); const values=Object.fromEntries(new FormData(this).entries());values.order_id=Number(values.order_id);values.amount=Number(values.amount);
  try{const result=await api('/api/payments',{method:'POST',body:JSON.stringify(values)});closePayment();showNotice(result.message+' Reference: '+result.reference_code);await loadOrders();await loadPayments();await loadDashboard();await loadReports();}
  catch(err){$('#payment-error').text(err.message);}
});
$('#export-report').on('click',async()=>{
  try {
    const rows = await api('/api/orders');
    const headers=['Order ID','Customer','Phone','Service','Quantity','Total LKR','Paid LKR','Status','Order date'];
    const csv=[headers,...rows.map(o=>[o.id,o.customer_name,o.phone,o.service_name,o.quantity,o.total_amount,o.paid_amount,o.status,o.order_date])]
      .map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download='laundry-orders-report.csv';a.click();URL.revokeObjectURL(url);
  } catch(e){showNotice(e.message,true);}
});
(async function init(){
  try { const result=await api('/api/auth/me'); if(result.user) await enterApp(result.user); else showLogin(); }
  catch (_) { showLogin(); }
})();
