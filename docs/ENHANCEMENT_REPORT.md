# Practical 02 — Enhancement Report
## Project: Laundry Management System

### 1. Overview
Practical 02 extends the same Laundry Management System created for Practical 01. It adds administrator authentication, security improvements, order/payment workflow, reporting and UI enhancements.

### 2. Enhancements implemented
1. **Authentication:** administrator login and logout using Express sessions.
2. **Password security:** passwords are hashed with bcrypt before storage; plain-text passwords are not saved.
3. **Protected routes:** business APIs require an authenticated session.
4. **Input validation:** required fields, numeric ranges, email format, order status and payment amounts are validated on the server.
5. **Search and filtering:** services, customers and orders can be searched; orders can be filtered by status.
6. **Order tracking:** an order can move through Pending, Washing, Ready, Delivered or Cancelled.
7. **Payment workflow:** the admin can record a simulated payment, select a mock method and see a unique reference. The system prevents a payment from exceeding the outstanding balance.
8. **Reports:** dashboard totals, outstanding balances, monthly paid revenue and downloadable order CSV.
9. **UI improvements:** responsive navigation, metric cards, status badges, dialogs, form feedback and mobile styles.
10. **Documentation:** installation, database, API and security notes are included in README.md.

### 3. Database changes
- `users` stores administrator credentials and roles.
- `payments` stores transaction references and amounts.
- `orders` links customers and services and stores status, due date and total.
- Foreign keys preserve the relationships between customers, services, orders and payments.

### 4. Security considerations
- SQL statements use placeholders rather than concatenating user values.
- Passwords use bcrypt hashing.
- Authenticated sessions are required for business API endpoints.
- User input is validated on both the client and server where appropriate.
- Error responses do not return raw SQL errors to the browser.
- Payment is a mock workflow and does not collect card details.

### 5. Testing checklist
- [ ] Login succeeds with the correct password and fails with an incorrect password.
- [ ] Business API requests without login return HTTP 401.
- [ ] Create, view, update and delete a service.
- [ ] Create, view, update and delete a customer.
- [ ] Create an order and update its status.
- [ ] Search and filter services, customers and orders.
- [ ] Record a partial payment and confirm the outstanding balance decreases.
- [ ] Confirm a payment greater than the balance is rejected.
- [ ] View the report and export orders to CSV.
- [ ] Check the UI at desktop and mobile widths.
- [ ] Log out and verify protected APIs are no longer accessible.

### 6. Limitations and future improvements
The project uses a mock payment workflow and a default in-memory session store intended for local coursework. Future versions could add role-based permissions, persistent session storage, CSRF protection, rate limiting, customer notifications, receipt printing and a real payment provider in a properly secured production environment.

### 7. Conclusion
The enhancements make the original project more secure and practical by adding authentication, order tracking, payment records and reporting while retaining the same application and database.
