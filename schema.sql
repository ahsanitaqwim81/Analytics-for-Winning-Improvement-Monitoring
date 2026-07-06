-- ============================================================
-- DATABASE SCHEMA: AWIM HANDBALL STATS
-- Deskripsi: Skema database MySQL untuk aplikasi statistik handball
-- Target DBMS: MySQL 8.0+ / MariaDB 10.3+
-- Author: Antigravity AI
-- ============================================================

-- 1. Pembuatan Database
CREATE DATABASE IF NOT EXISTS awim_handball_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE awim_handball_db;

-- 2. Penghapusan Tabel (jika sudah ada untuk keperluan reset/re-import)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS teams;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- TABEL: teams
-- Menyimpan informasi tim (klub) yang terdaftar di aplikasi.
-- Pemain diinput manual oleh pengguna dalam aplikasi.
-- ============================================================
CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT 'Nama tim/klub',
    coach VARCHAR(100) DEFAULT NULL COMMENT 'Nama pelatih tim',
    color VARCHAR(7) DEFAULT '#3498db' COMMENT 'Kode warna jersey tim (hex, contoh: #e74c3c)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Tabel data tim / klub';

-- ============================================================
-- Skema pemain tidak disimpan di database.
-- Pemain akan diinput manual oleh pengguna di aplikasi.
-- ============================================================

-- ============================================================
-- TABEL: matches
-- Menyimpan informasi utama suatu pertandingan/match.
-- ============================================================
CREATE TABLE matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    competition VARCHAR(150) DEFAULT NULL COMMENT 'Nama liga/kompetisi',
    venue VARCHAR(100) DEFAULT NULL COMMENT 'Tempat pertandingan berlangsung',
    match_date VARCHAR(50) DEFAULT NULL COMMENT 'Tanggal pertandingan (format teks atau tanggal)',
    referee VARCHAR(100) DEFAULT NULL COMMENT 'Nama wasit pertandingan',
    duration INT DEFAULT 30 COMMENT 'Durasi per babak (menit)',
    periods INT DEFAULT 2 COMMENT 'Jumlah babak pertandingan (biasanya 2 atau 3)',
    
    team_a_id INT NOT NULL COMMENT 'ID Tim Home (Tim A)',
    team_b_id INT NOT NULL COMMENT 'ID Tim Away (Tim B)',
    
    score_a INT DEFAULT 0 COMMENT 'Skor akhir Tim A',
    score_b INT DEFAULT 0 COMMENT 'Skor akhir Tim B',
    current_period INT DEFAULT 1 COMMENT 'Babak yang sedang berlangsung',
    time_left INT DEFAULT 1800 COMMENT 'Sisa waktu babak aktif (dalam detik)',
    
    timeouts_a INT DEFAULT 3 COMMENT 'Sisa timeout Tim A',
    timeouts_b INT DEFAULT 3 COMMENT 'Sisa timeout Tim B',
    
    status ENUM('setup', 'ongoing', 'finished') DEFAULT 'setup' COMMENT 'Status jalannya pertandingan',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Relasi ke tabel teams untuk Tim A dan Tim B
    CONSTRAINT fk_matches_team_a FOREIGN KEY (team_a_id) REFERENCES teams(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_matches_team_b FOREIGN KEY (team_b_id) REFERENCES teams(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Tabel informasi utama pertandingan';

-- ============================================================
-- Skema match_players dan match_events dihapus karena pemain tidak disimpan di database.
-- Hanya tabel teams dan matches yang digunakan untuk penyimpanan.
-- ============================================================

-- ============================================================
-- VIEW 1: view_match_summary
-- Menampilkan ringkasan pertandingan yang mudah dibaca.
-- ============================================================
CREATE OR REPLACE VIEW view_match_summary AS
SELECT 
    m.id AS match_id,
    m.competition,
    m.venue,
    m.match_date,
    t_a.name AS team_home,
    m.score_a AS score_home,
    t_b.name AS team_away,
    m.score_b AS score_away,
    m.status AS match_status,
    m.referee
FROM matches m
JOIN teams t_a ON m.team_a_id = t_a.id
JOIN teams t_b ON m.team_b_id = t_b.id;

-- ============================================================
-- DATA DUMMY / CONTOH PENGISIAN AWAL (OPSIONAL)
-- ============================================================
-- 1. Insert Tim Contoh
INSERT INTO teams (name, coach, color) VALUES 
('SURABAYA FALCONS', 'Coach Ahmad', '#e74c3c'),
('SIDOARJO EAGLES', 'Coach Budi', '#1abc9c');

-- ============================================================
-- DATA DUMMY / CONTOH PENGISIAN AWAL (OPSIONAL)
-- Hanya tim disimpan di database. Pemain akan diinput manual oleh pengguna.
-- ============================================================
