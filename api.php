<?php
/**
 * AWIM Handball Stats - API Backend PHP
 * Menangani penyimpanan dan pengambilan data tim/pemain dari database MySQL
 */

// Set header CORS agar dapat dipanggil dari mana saja (misal file://)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Tangani Preflight Request untuk CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Konfigurasi Database
$host     = '127.0.0.1';
$db       = 'awim_handball_db';
$user     = 'root';
$password = '';
$charset  = 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    // Coba buat database jika belum ada
    $pdo = new PDO("mysql:host=$host;charset=$charset", $user, $password, $options);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$db`");
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS teams (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            coach VARCHAR(100) DEFAULT NULL,
            color VARCHAR(7) DEFAULT '#3498db',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS players (
            id INT AUTO_INCREMENT PRIMARY KEY,
            team_id INT NOT NULL,
            jersey_number VARCHAR(3) NOT NULL,
            name VARCHAR(100) NOT NULL,
            position ENUM('GK','CB','LB','RB','LW','RW','PV') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_team_jersey (team_id, jersey_number),
            CONSTRAINT fk_players_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database initialization failed: " . $e->getMessage()
    ]);
    exit();
}

// Routing Aksi
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        if ($action === 'health') {
            echo json_encode(["status" => "ok", "message" => "API is healthy and database is connected"]);
        } elseif ($action === 'get_teams') {
            getTeams($pdo);
        } elseif ($action === 'get_team') {
            getTeam($pdo);
        } elseif ($action === 'get_players') {
            getPlayers($pdo);
        } elseif ($action === 'get_player') {
            getPlayer($pdo);
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid action"]);
        }
        break;

    case 'POST':
        if ($action === 'save_team') {
            saveTeam($pdo);
        } elseif ($action === 'save_player') {
            savePlayer($pdo);
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid action"]);
        }
        break;

    case 'DELETE':
        if ($action === 'delete_team') {
            deleteTeam($pdo);
        } elseif ($action === 'delete_player') {
            deletePlayer($pdo);
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid action"]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["status" => "error", "message" => "Method not allowed"]);
        break;
}

/**
 * Fungsi untuk mengambil semua data tim dan pemain dari database.
 * Output akan diformat sesuai kebutuhan savedTeams di index.html.
 */
function getTeams($pdo) {
    try {
        // Ambil semua tim
        $stmt = $pdo->query("SELECT * FROM teams");
        $teams = $stmt->fetchAll();
        
        $result = [];
        
        foreach ($teams as $team) {
            // Ambil semua pemain untuk tim ini
            $stmtPlayers = $pdo->prepare("SELECT jersey_number, name, position FROM players WHERE team_id = ?");
            $stmtPlayers->execute([$team['id']]);
            $dbPlayers = $stmtPlayers->fetchAll();
            
            // Format data pemain ke format JS (nomor, nama, posisi)
            $players = [];
            foreach ($dbPlayers as $p) {
                $players[] = [
                    "nomor"  => $p['jersey_number'],
                    "nama"   => $p['name'],
                    "posisi" => $p['position']
                ];
            }
            
            // Simpan dengan key Nama Tim Huruf Kapital (sesuai format index.html)
            $key = strtoupper(trim($team['name']));
            $result[$key] = [
                "name"    => $team['name'],
                "coach"   => $team['coach'] ?? '',
                "color"   => $team['color'] ?? '#3498db',
                "players" => $players
            ];
        }
        
        echo json_encode($result);
    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}

function getTeam($pdo) {
    try {
        $name = isset($_GET['name']) ? trim($_GET['name']) : '';
        if (empty($name)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Parameter 'name' is required."]);
            return;
        }
        $stmt = $pdo->prepare("SELECT * FROM teams WHERE name = ?");
        $stmt->execute([$name]);
        $team = $stmt->fetch();
        if (!$team) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Team not found."]);
            return;
        }
        $playersStmt = $pdo->prepare("SELECT id, jersey_number, name, position FROM players WHERE team_id = ? ORDER BY jersey_number ASC");
        $playersStmt->execute([$team['id']]);
        $players = $playersStmt->fetchAll();
        echo json_encode([
            "id" => $team['id'],
            "name" => $team['name'],
            "coach" => $team['coach'],
            "color" => $team['color'],
            "players" => $players
        ]);
    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}

function getPlayers($pdo) {
    try {
        $teamName = isset($_GET['team_name']) ? trim($_GET['team_name']) : '';
        if (!empty($teamName)) {
            $stmtTeam = $pdo->prepare("SELECT id FROM teams WHERE name = ?");
            $stmtTeam->execute([$teamName]);
            $teamId = $stmtTeam->fetchColumn();
            if (!$teamId) {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Team not found."]);
                return;
            }
            $stmt = $pdo->prepare("SELECT id, jersey_number, name, position FROM players WHERE team_id = ? ORDER BY jersey_number ASC");
            $stmt->execute([$teamId]);
        } else {
            $stmt = $pdo->query("SELECT p.id, p.jersey_number, p.name, p.position, t.name AS team_name FROM players p JOIN teams t ON p.team_id = t.id ORDER BY t.name, p.jersey_number ASC");
        }
        $players = $stmt->fetchAll();
        echo json_encode($players);
    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}

function getPlayer($pdo) {
    try {
        $playerId = isset($_GET['player_id']) ? trim($_GET['player_id']) : '';
        $teamName = isset($_GET['team_name']) ? trim($_GET['team_name']) : '';
        $jerseyNumber = isset($_GET['jersey_number']) ? trim($_GET['jersey_number']) : '';

        if ($playerId) {
            $stmt = $pdo->prepare("SELECT p.id, p.jersey_number, p.name, p.position, t.name AS team_name FROM players p JOIN teams t ON p.team_id = t.id WHERE p.id = ?");
            $stmt->execute([$playerId]);
        } elseif ($teamName && $jerseyNumber) {
            $stmt = $pdo->prepare("SELECT p.id, p.jersey_number, p.name, p.position, t.name AS team_name FROM players p JOIN teams t ON p.team_id = t.id WHERE t.name = ? AND p.jersey_number = ?");
            $stmt->execute([$teamName, $jerseyNumber]);
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Parameter 'player_id' or ('team_name' and 'jersey_number') is required."]);
            return;
        }
        $player = $stmt->fetch();
        if (!$player) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Player not found."]);
            return;
        }
        echo json_encode($player);
    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}

function savePlayer($pdo) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['team_name']) || empty($input['nomor']) || empty($input['nama']) || empty($input['posisi'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid payload, 'team_name', 'nomor', 'nama', and 'posisi' are required."]);
            return;
        }

        $teamName = trim($input['team_name']);
        $jersey = trim($input['nomor']);
        $name = trim($input['nama']);
        $position = trim($input['posisi']);
        $playerId = isset($input['player_id']) ? trim($input['player_id']) : null;

        $stmtTeam = $pdo->prepare("SELECT id FROM teams WHERE name = ?");
        $stmtTeam->execute([$teamName]);
        $teamId = $stmtTeam->fetchColumn();
        if (!$teamId) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Team not found."]);
            return;
        }

        if ($playerId) {
            $stmtUpdate = $pdo->prepare("UPDATE players SET jersey_number = :jersey_number, name = :name, position = :position WHERE id = :id AND team_id = :team_id");
            $stmtUpdate->execute([
                ':jersey_number' => $jersey,
                ':name' => $name,
                ':position' => $position,
                ':id' => $playerId,
                ':team_id' => $teamId
            ]);
            echo json_encode(["status" => "success", "message" => "Player updated successfully."]);
            return;
        }

        $stmtInsert = $pdo->prepare("INSERT INTO players (team_id, jersey_number, name, position) VALUES (:team_id, :jersey_number, :name, :position)");
        $stmtInsert->execute([
            ':team_id' => $teamId,
            ':jersey_number' => $jersey,
            ':name' => $name,
            ':position' => $position
        ]);
        echo json_encode(["status" => "success", "message" => "Player saved successfully."]);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(["status" => "error", "message" => "Player jersey number already exists for this team."]);
            return;
        }
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}

function deletePlayer($pdo) {
    try {
        $playerId = isset($_GET['player_id']) ? trim($_GET['player_id']) : '';
        $teamName = isset($_GET['team_name']) ? trim($_GET['team_name']) : '';
        $jerseyNumber = isset($_GET['jersey_number']) ? trim($_GET['jersey_number']) : '';

        if ($playerId) {
            $stmt = $pdo->prepare("DELETE FROM players WHERE id = ?");
            $stmt->execute([$playerId]);
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Player not found."]);
                return;
            }
            echo json_encode(["status" => "success", "message" => "Player deleted successfully."]);
            return;
        }

        if ($teamName && $jerseyNumber) {
            $stmtTeam = $pdo->prepare("SELECT id FROM teams WHERE name = ?");
            $stmtTeam->execute([$teamName]);
            $teamId = $stmtTeam->fetchColumn();
            if (!$teamId) {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Team not found."]);
                return;
            }
            $stmt = $pdo->prepare("DELETE FROM players WHERE team_id = ? AND jersey_number = ?");
            $stmt->execute([$teamId, $jerseyNumber]);
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Player not found."]);
                return;
            }
            echo json_encode(["status" => "success", "message" => "Player deleted successfully."]);
            return;
        }

        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Parameter 'player_id' or ('team_name' and 'jersey_number') is required."]);
    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}

/**
 * Fungsi untuk menyimpan tim baru atau memperbarui tim yang sudah ada beserta pemainnya.
 */
function saveTeam($pdo) {
    try {
        // Ambil data JSON dari body request
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || empty($input['name'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid payload, 'name' is required."]);
            return;
        }

        $name = trim($input['name']);
        $coach = isset($input['coach']) ? trim($input['coach']) : '';
        $color = isset($input['color']) ? trim($input['color']) : '#3498db';
        $players = isset($input['players']) ? $input['players'] : [];

        // Jalankan transaksi agar konsisten
        $pdo->beginTransaction();

        // 1. Simpan atau perbarui tim (ON DUPLICATE KEY UPDATE)
        $stmtTeam = $pdo->prepare("
            INSERT INTO teams (name, coach, color) 
            VALUES (:name, :coach, :color) 
            ON DUPLICATE KEY UPDATE 
                coach = VALUES(coach), 
                color = VALUES(color)
        ");
        $stmtTeam->execute([
            ':name'  => $name,
            ':coach' => $coach,
            ':color' => $color
        ]);

        // Dapatkan ID Tim (baik baru maupun yang lama)
        $stmtGetId = $pdo->prepare("SELECT id FROM teams WHERE name = ?");
        $stmtGetId->execute([$name]);
        $teamId = $stmtGetId->fetchColumn();

        if (!$teamId) {
            throw new \Exception("Failed to retrieve team ID.");
        }

        // 2. Hapus semua pemain lama tim ini terlebih dahulu agar tersinkronisasi
        $stmtDelPlayers = $pdo->prepare("DELETE FROM players WHERE team_id = ?");
        $stmtDelPlayers->execute([$teamId]);

        // 3. Masukkan daftar pemain yang baru
        if (!empty($players) && is_array($players)) {
            $stmtInsertPlayer = $pdo->prepare("
                INSERT INTO players (team_id, jersey_number, name, position) 
                VALUES (:team_id, :jersey_number, :name, :position)
            ");
            foreach ($players as $player) {
                if (empty($player['nomor']) || empty($player['nama']) || empty($player['posisi'])) {
                    continue; // Skip data tidak valid
                }
                $stmtInsertPlayer->execute([
                    ':team_id'       => $teamId,
                    ':jersey_number' => trim($player['nomor']),
                    ':name'          => trim($player['nama']),
                    ':position'      => trim($player['posisi'])
                ]);
            }
        }

        $pdo->commit();
        echo json_encode(["status" => "success", "message" => "Team '$name' and its players saved successfully."]);

    } catch (\Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}

/**
 * Fungsi untuk menghapus tim berdasarkan nama tim (key).
 */
function deleteTeam($pdo) {
    try {
        $name = isset($_GET['name']) ? trim($_GET['name']) : '';
        
        if (empty($name)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Parameter 'name' is required."]);
            return;
        }

        // Cari ID Tim terlebih dahulu
        $stmtGetId = $pdo->prepare("SELECT id FROM teams WHERE name = ?");
        $stmtGetId->execute([$name]);
        $teamId = $stmtGetId->fetchColumn();

        if (!$teamId) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Team not found."]);
            return;
        }

        // Hapus tim (tabel players terhapus otomatis karena foreign key CASCADE)
        $stmtDelTeam = $pdo->prepare("DELETE FROM teams WHERE id = ?");
        $stmtDelTeam->execute([$teamId]);

        echo json_encode(["status" => "success", "message" => "Team '$name' deleted successfully."]);

    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}
?>
