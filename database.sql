-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS c237_003_team2;
USE c237_003_team2;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(40) NOT NULL, -- SHA1 hash is 40 characters
    address TEXT NOT NULL,
    contact VARCHAR(20) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create movies table
CREATE TABLE IF NOT EXISTS movies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    rating DECIMAL(3,1) NOT NULL,
    image VARCHAR(255),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default admin user (password: admin123)
INSERT INTO users (username, email, password, address, contact, role)
VALUES (
    'Admin User',
    'admin@example.com',
    SHA1('admin123'),
    'Admin Address',
    '1234567890',
    'admin'
) ON DUPLICATE KEY UPDATE id=id;

-- Insert some sample movies
INSERT INTO movies (title, genre, year, rating, review) VALUES
('The Shawshank Redemption', 'Drama', 1994, 9.3, 'A tale of hope and friendship'),
('The Godfather', 'Crime', 1972, 9.2, 'A masterpiece of cinema'),
('The Dark Knight', 'Action', 2008, 9.0, 'Revolutionary superhero film'),
('Inception', 'Sci-Fi', 2010, 8.8, 'Mind-bending thriller')
ON DUPLICATE KEY UPDATE id=id;
