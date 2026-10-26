<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('POST');

$body = request_body();
$account = strtolower(trim((string) ($body['account'] ?? '')));
$password = (string) ($body['password'] ?? '');

if ($account === '' || $password === '') {
    json_response(400, ['error' => 'Escribe la cuenta y la contraseña.']);
}

try {
    $query = database()->prepare(
        'SELECT cuenta, password_hash, nombre, matricula, carrera, semestre, grupo, rol
         FROM cuentas WHERE cuenta = :cuenta LIMIT 1'
    );
    $query->execute(['cuenta' => $account]);
    $row = $query->fetch();
} catch (PDOException $error) {
    report_database_error($error);
}

if (!$row || !password_verify($password, $row['password_hash'])) {
    json_response(401, ['error' => 'La cuenta o la contraseña no son correctas.']);
}

session_regenerate_id(true);
$_SESSION['account'] = $row['cuenta'];
$_SESSION['role'] = $row['rol'];

json_response(200, [
    'user' => [
        'account' => $row['cuenta'],
        'fullName' => $row['nombre'],
        'studentId' => $row['matricula'] ?? '',
        'career' => $row['carrera'] ?? '',
        'semester' => $row['semestre'] !== null ? (string) $row['semestre'] : '',
        'group' => $row['grupo'] ?? '',
        'role' => $row['rol'],
    ],
]);
