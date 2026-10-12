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

INSERT INTO services (name, description, price, turnaround_hours, active)
SELECT 'Wash & Fold', 'Everyday wash, dry and fold service', 450.00, 24, 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Wash & Fold');
INSERT INTO services (name, description, price, turnaround_hours, active)
SELECT 'Dry Cleaning', 'Professional dry cleaning service', 900.00, 48, 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Dry Cleaning');
INSERT INTO services (name, description, price, turnaround_hours, active)
SELECT 'Ironing', 'Ironing and garment finishing', 250.00, 12, 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Ironing');
