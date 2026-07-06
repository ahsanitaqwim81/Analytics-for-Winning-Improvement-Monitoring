<?php
/**
 * AWIM Handball Stats - API Backend PHP
 * Menangani penyimpanan dan pengambilan data tim dari database MySQL
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
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid action"]);
        }
        break;

    case 'POST':
        if ($action === 'save_team') {
            saveTeam($pdo);
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Invalid action"]);
        }
        break;

    case 'DELETE':
        if ($action === 'delete_team') {
            deleteTeam($pdo);
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
            $key = strtoupper(trim($team['name']));
            $result[$key] = [
                "name"    => $team['name'],
                "coach"   => $team['coach'] ?? '',
                "color"   => $team['color'] ?? '#3498db',
                "players" => []
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
        echo json_encode([
            "id" => $team['id'],
            "name" => $team['name'],
            "coach" => $team['coach'],
            "color" => $team['color']
        ]);
    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}

/**
 * Fungsi untuk menyimpan tim baru atau memperbarui tim yang sudah ada.
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

        $pdo->commit();
        echo json_encode(["status" => "success", "message" => "Team '$name' saved successfully."]);

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

        // Hapus tim dari database
        $stmtDelTeam = $pdo->prepare("DELETE FROM teams WHERE id = ?");
        $stmtDelTeam->execute([$teamId]);

        echo json_encode(["status" => "success", "message" => "Team '$name' deleted successfully."]);

    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}
?>
