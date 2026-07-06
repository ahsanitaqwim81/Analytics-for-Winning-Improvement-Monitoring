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
DROP TABLE IF EXISTS match_events;
DROP TABLE IF EXISTS match_players;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS teams;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- TABEL: teams
-- Menyimpan informasi tim (klub) yang terdaftar di aplikasi.
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
-- TABEL: players
-- Menyimpan profil pemain yang tergabung dalam suatu tim.
-- ============================================================
CREATE TABLE players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL COMMENT 'ID tim tempat pemain bernaung',
    jersey_number VARCHAR(3) NOT NULL COMMENT 'Nomor punggung pemain (1-3 digit)',
    name VARCHAR(100) NOT NULL COMMENT 'Nama lengkap pemain',
    position ENUM('GK', 'CB', 'LB', 'RB', 'LW', 'RW', 'PV') NOT NULL COMMENT 'Posisi pemain (GK=Goalkeeper, CB=Centerback, LB=Leftback, RB=Rightback, LW=Leftwing, RW=Rightwing, PV=Pivot)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Relasi ke tabel teams
    CONSTRAINT fk_players_team FOREIGN KEY (team_id) 
        REFERENCES teams(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Batasan: Nomor punggung harus unik dalam satu tim
    UNIQUE KEY uq_team_jersey (team_id, jersey_number)
) ENGINE=InnoDB COMMENT='Tabel profil pemain';

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
-- TABEL: match_players
-- Tabel pivot/penghubung untuk mencatat pemain yang berpartisipasi 
-- dalam suatu pertandingan beserta status line-up dan akumulasi stat.
-- ============================================================
CREATE TABLE match_players (
    match_id INT NOT NULL COMMENT 'ID pertandingan',
    player_id INT NOT NULL COMMENT 'ID pemain',
    team_id INT NOT NULL COMMENT 'ID tim pemain pada pertandingan ini',
    status ENUM('court', 'bench', 'suspended') DEFAULT 'bench' COMMENT 'Status pemain (lapangan, cadangan, dikeluarkan)',
    
    -- Akumulasi Statistik Individu dalam match ini
    goals INT DEFAULT 0 COMMENT 'Jumlah gol yang dicetak',
    misses INT DEFAULT 0 COMMENT 'Jumlah tembakan meleset',
    saves INT DEFAULT 0 COMMENT 'Jumlah penyelamatan (GK)',
    fouls INT DEFAULT 0 COMMENT 'Jumlah pelanggaran dilakukan',
    yellow_cards INT DEFAULT 0 COMMENT 'Jumlah kartu kuning didapat',
    two_minutes INT DEFAULT 0 COMMENT 'Jumlah penalti suspensi 2 menit',
    red_card BOOLEAN DEFAULT FALSE COMMENT 'Status kartu merah (dikeluarkan)',
    blue_card BOOLEAN DEFAULT FALSE COMMENT 'Status kartu biru (diskualifikasi tertulis)',
    
    PRIMARY KEY (match_id, player_id),
    
    -- Relasi
    CONSTRAINT fk_match_players_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_match_players_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT fk_match_players_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Tabel statistik & status line-up pemain per pertandingan';

-- ============================================================
-- TABEL: match_events
-- Menyimpan kronologi/log setiap kejadian (events) secara real-time.
-- ============================================================
CREATE TABLE match_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL COMMENT 'ID pertandingan',
    period INT NOT NULL COMMENT 'Babak kejadian (1, 2, 3)',
    time_elapsed VARCHAR(10) NOT NULL COMMENT 'Waktu kejadian (format MM:SS)',
    event_type ENUM('GOAL', 'MISS', 'SAVE', 'FOUL', 'TIMEOUT', 'SUB', 'PERIOD_START', 'PERIOD_END', 'MATCH_END') NOT NULL COMMENT 'Tipe kejadian',
    
    team_id INT DEFAULT NULL COMMENT 'ID tim yang melakukan aksi/kejadian',
    player_id INT DEFAULT NULL COMMENT 'ID pemain utama yang melakukan aksi (opsional)',
    
    subtype VARCHAR(50) DEFAULT NULL COMMENT 'Subtipe aksi (contoh: Shot 9m, Penalti, Kartu Kuning, 2 Menit)',
    attack_type VARCHAR(50) DEFAULT NULL COMMENT 'Tipe serangan (contoh: Fastbreak, Set Play, Counter, dll)',
    goal_zone VARCHAR(50) DEFAULT NULL COMMENT 'Zona target gawang (contoh: Atas Kiri, Bawah Tengah)',
    court_zone VARCHAR(10) DEFAULT NULL COMMENT 'Zona lokasi di lapangan saat melempar/pelanggaran (contoh: L1, R5)',
    
    -- Kolom khusus untuk event Substitusi (SUB)
    player_out_id INT DEFAULT NULL COMMENT 'ID pemain yang ditarik keluar (on-court ke bench)',
    player_in_id INT DEFAULT NULL COMMENT 'ID pemain yang masuk menggantikan (bench ke on-court)',
    
    -- Kolom khusus untuk mencatat snapshot skor saat event terjadi (e.g. MATCH_END)
    score_a INT DEFAULT NULL COMMENT 'Snapshot skor tim A',
    score_b INT DEFAULT NULL COMMENT 'Snapshot skor tim B',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Relasi
    CONSTRAINT fk_events_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT fk_events_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT fk_events_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
    CONSTRAINT fk_events_player_out FOREIGN KEY (player_out_id) REFERENCES players(id) ON DELETE SET NULL,
    CONSTRAINT fk_events_player_in FOREIGN KEY (player_in_id) REFERENCES players(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Tabel log kejadian pertandingan secara real-time';

-- ============================================================
-- INDEKS TAMBAHAN UNTUK OPTIMALISASI QUERY
-- ============================================================
CREATE INDEX idx_match_players_team ON match_players(match_id, team_id);
CREATE INDEX idx_match_events_timeline ON match_events(match_id, period, time_elapsed DESC);

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
-- VIEW 2: view_player_match_stats
-- Menghubungkan profil pemain untuk mempermudah pembacaan statistik.
-- ============================================================
CREATE OR REPLACE VIEW view_player_match_stats AS
SELECT 
    mp.match_id,
    t.name AS team_name,
    p.jersey_number,
    p.name AS player_name,
    p.position,
    mp.status AS current_status,
    mp.goals,
    mp.misses,
    mp.saves,
    mp.fouls,
    mp.yellow_cards,
    mp.two_minutes,
    mp.red_card,
    mp.blue_card
FROM match_players mp
JOIN players p ON mp.player_id = p.id
JOIN teams t ON mp.team_id = t.id;

-- ============================================================
-- DATA DUMMY / CONTOH PENGISIAN AWAL (OPSIONAL)
-- ============================================================
-- 1. Insert Tim Contoh
INSERT INTO teams (name, coach, color) VALUES 
('SURABAYA FALCONS', 'Coach Ahmad', '#e74c3c'),
('SIDOARJO EAGLES', 'Coach Budi', '#1abc9c');

-- 2. Insert Pemain Surabaya Falcons (Tim A, ID=1)
INSERT INTO players (team_id, jersey_number, name, position) VALUES
(1, '1', 'Hendra Wijaya', 'GK'),
(1, '7', 'Dimas Arya', 'CB'),
(1, '10', 'Rian Hidayat', 'LB'),
(1, '3', 'Fajar Pratama', 'RB'),
(1, '8', 'Eko Prasetyo', 'LW'),
(1, '9', 'Andi Wijaya', 'RW'),
(1, '11', 'Bagus Saputra', 'PV'),
(1, '12', 'Rudi Anto', 'GK'),
(1, '14', 'Guntur Wibowo', 'CB');

-- 3. Insert Pemain Sidoarjo Eagles (Tim B, ID=2)
INSERT INTO players (team_id, jersey_number, name, position) VALUES
(2, '16', 'Roni Setiawan', 'GK'),
(2, '2', 'Taufik Hidayat', 'CB'),
(2, '4', 'Bambang Pamungkas', 'LB'),
(2, '5', 'Aris Setiawan', 'RB'),
(2, '6', 'Dian Nugraha', 'LW'),
(2, '17', 'Lukman Hakim', 'RW'),
(2, '99', 'Zainal Abidin', 'PV'),
(2, '12', 'Adi Nugroho', 'GK'),
(2, '13', 'Yusuf Mahendra', 'LB');
