-- Creates the lab database and fills it with sample rows.
-- Run from the server/ folder:  mysql -u root < schema.sql
-- Safe to re-run: it drops and recreates the students table each time.

CREATE DATABASE IF NOT EXISTS student_lab;
USE student_lab;

DROP TABLE IF EXISTS students;

CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  course VARCHAR(100)
);

INSERT INTO students (name, email, course) VALUES
  ('Amina Yusuf', 'amina@example.com', 'Computer Science'),
  ('John Otieno', 'john@example.com', 'Information Technology'),
  ('Grace Wanjiru', 'grace@example.com', 'Software Engineering');
