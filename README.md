# LaundryCare Management System

A web-based database management system designed for tracking laundry operations, intake pipelines, customer registers, and payment processing tracking.

## Technical Stack
- **Backend Environment:** Node.js (Express framework)
- **Database Engine:** MySQL Server 8.0+
- **Authentication:** Layered password protection via BcryptJS encryption

## Database Initialization & Setup

### 1. Environment Configurations
Configure your root project folder local environment credentials inside your `.env` file:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=daren@2005
DB_NAME=laundry_management
```

### 2. Creating Database Structures
Execute these core operational data layouts sequentially in your MySQL Command Line prompt to construct the application layout:

```sql
CREATE DATABASE IF NOT EXISTS laundry_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE laundry_management;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('admin') NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  turnaround_hours INT NOT NULL DEFAULT 24,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  address VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  service_id INT NOT NULL,
  quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('Pending','Washing','Ready','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  notes VARCHAR(500) DEFAULT '',
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_date DATETIME DEFAULT NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_orders_service FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method ENUM('Cash','Card (Mock)','Bank Transfer (Mock)') NOT NULL DEFAULT 'Cash',
  status ENUM('Pending','Paid','Failed') NOT NULL DEFAULT 'Paid',
  reference_code VARCHAR(60) NOT NULL UNIQUE,
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

### 3. Creating the Administrator Profile
To build out your verified authentication credentials, execute the standalone creation script:
```bash
node scripts/create-admin.js
```
- **Username Gate:** `admin@ucj.com`
- **Password Gate:** `ucj123`
- **Assigned Administrator:** P.K.Daren

## Coursework Demonstration Guidelines

### Why Can't Orders Be Deleted from the UI?
This application contains data integrity restrictions. If a record has an active financial entry inside the `payments` table, the user interface will block deletion with a warning dialog (`Orders with payment records cannot be deleted.`) to prevent breaking Foreign Key constraints.

To forcefully delete a transactional order during development, clear the structural relations directly from your MySQL CLI terminal wrapper:
```sql
DELETE FROM payments WHERE order_id = <ORDER_ID>;
DELETE FROM orders WHERE id = <ORDER_ID>;
```

## Running the Application
```bash
npm start
```
The interface dashboard panel will launch live locally at: `http://localhost:3000`
