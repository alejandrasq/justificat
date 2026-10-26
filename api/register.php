<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('POST');

$body = request_body();
$account = strtolower(trim((string) ($body['account'] ?? '')));
$password = (string) ($body['password'] ?? '');
$fullName = trim((string) ($body['fullName'] ?? ''));
$studentId = trim((string) ($body['studentId'] ?? ''));
$career = trim((string) ($body['career'] ?? ''));
$semester = (int) ($body['semester'] ?? 0);
$group = strtoupper(trim((string) ($body['group'] ?? '')));

if (strlen($account) > 254 || filter_var($account, FILTER_VALIDATE_EMAIL) === false) {
    json_response(422, ['error' => 'Escribe un correo institucional válido.']);
}
if (strlen($password) < 8) {
    json_response(422, ['error' => 'La contraseña debe tener al menos 8 caracteres.']);
}
if (
    $fullName === '' || strlen($fullName) > 150
    || $studentId === '' || strlen($studentId) > 32
    || $career === '' || strlen($career) > 100
    || $group === '' || strlen($group) > 4
    || $semester < 1 || $semester > 6
) {
    json_response(422, ['error' => 'Revisa los datos escolares: completa todos los campos y verifica que no excedan el límite indicado.']);
}

try {
    $insert = database()->prepare(
        'INSERT INTO cuentas (cuenta, password_hash, nombre, matricula, carrera, semestre, grupo, rol)
         VALUES (:cuenta, :password_hash, :nombre, :matricula, :carrera, :semestre, :grupo, "student")'
    );
    $insert->execute([
        'cuenta' => $account,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'nombre' => $fullName,
        'matricula' => $studentId,
        'carrera' => $career,
        'semestre' => $semester,
        'grupo' => $group,
    ]);
} catch (PDOException $error) {
    if ($error->getCode() === '23000') {
        $constraint = (string) ($error->errorInfo[2] ?? '');
        $message = str_contains($constraint, 'uq_cuentas_cuenta')
            ? 'Ese correo institucional ya está registrado.'
            : (str_contains($constraint, 'uq_cuentas_matricula')
                ? 'Esa matrícula ya está registrada.'
                : 'El correo institucional o la matrícula ya están registrados.');
        json_response(409, ['error' => $message]);
    }
    report_database_error($error);
}

json_response(201, ['message' => 'Cuenta creada correctamente.']);
