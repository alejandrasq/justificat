<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'httponly' => true,
    'secure' => $isHttps,
    'samesite' => 'Lax',
]);
session_start();

function json_response(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        header('Allow: ' . $method);
        json_response(405, ['error' => 'Método no permitido.']);
    }
}

function request_body(): array
{
    try {
        $body = json_decode((string) file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        json_response(400, ['error' => 'La solicitud no contiene JSON válido.']);
    }

    if (!is_array($body)) {
        json_response(400, ['error' => 'La solicitud no tiene un formato válido.']);
    }
    return $body;
}

function database(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    try {
        $connection = new PDO(
            'mysql:host=127.0.0.1;dbname=justificat;charset=utf8mb4',
            'root',
            '',
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    } catch (PDOException $error) {
        error_log('JutificaT database connection failed: ' . $error->getMessage());
        json_response(503, ['error' => 'No se pudo conectar con justificat. Verifica que MySQL esté iniciado en XAMPP.']);
    }
    return $connection;
}

function require_staff(): void
{
    if (($_SESSION['role'] ?? null) !== 'staff') {
        json_response(401, ['error' => 'Inicia sesión como encargado para consultar esta lista.']);
    }
}

function report_database_error(PDOException $error): void
{
    error_log('JutificaT database query failed: ' . $error->getMessage());
    json_response(500, ['error' => 'No se pudo completar la operación en la base de datos.']);
}
