<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('POST');
require_staff();

$body = request_body();
$account = strtolower(trim((string) ($body['account'] ?? '')));

if ($account === '' || strlen($account) > 254) {
    json_response(422, ['error' => 'La cuenta del alumno no es válida.']);
}

$deletedCount = 0;
try {
    $delete = database()->prepare(
        'DELETE FROM cuentas WHERE cuenta = :cuenta AND rol = "student"'
    );
    $delete->execute(['cuenta' => $account]);
    $deletedCount = $delete->rowCount();
} catch (PDOException $error) {
    report_database_error($error);
}

if ($deletedCount === 0) {
    json_response(404, ['error' => 'No se encontró la cuenta del alumno.']);
}

json_response(200, ['message' => 'Cuenta del alumno eliminada correctamente.']);
