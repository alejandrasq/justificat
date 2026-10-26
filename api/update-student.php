<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('POST');
require_staff();

$body = request_body();
$originalAccount = strtolower(trim((string) ($body['originalAccount'] ?? '')));
$account = strtolower(trim((string) ($body['account'] ?? '')));
$fullName = trim((string) ($body['fullName'] ?? ''));
$studentId = trim((string) ($body['studentId'] ?? ''));
$career = trim((string) ($body['career'] ?? ''));
$semester = filter_var($body['semester'] ?? null, FILTER_VALIDATE_INT);
$group = strtoupper(trim((string) ($body['group'] ?? '')));

if ($originalAccount === '' || strlen($originalAccount) > 254) {
    json_response(422, ['error' => 'La cuenta original no es válida.']);
}
if (
    strlen($account) > 254
    || ($account !== $originalAccount && filter_var($account, FILTER_VALIDATE_EMAIL) === false)
) {
    json_response(422, ['error' => 'Escribe un correo institucional válido.']);
}
if (
    $fullName === '' || strlen($fullName) > 150
    || $studentId === '' || strlen($studentId) > 32
    || $career === '' || strlen($career) > 100
    || $group === '' || strlen($group) > 4
    || $semester === false || $semester < 1 || $semester > 6
) {
    json_response(422, ['error' => 'Revisa los datos del alumno; todos son obligatorios y deben tener un formato válido.']);
}

try {
    $query = database()->prepare(
        'UPDATE cuentas
         SET cuenta = :cuenta, nombre = :nombre, matricula = :matricula,
             carrera = :carrera, semestre = :semestre, grupo = :grupo
         WHERE cuenta = :original_cuenta AND rol = "student"'
    );
    $query->execute([
        'cuenta' => $account,
        'nombre' => $fullName,
        'matricula' => $studentId,
        'carrera' => $career,
        'semestre' => $semester,
        'grupo' => $group,
        'original_cuenta' => $originalAccount,
    ]);

    if ($query->rowCount() === 0) {
        $exists = database()->prepare(
            'SELECT 1 FROM cuentas WHERE cuenta = :cuenta AND rol = "student" LIMIT 1'
        );
        $exists->execute(['cuenta' => $account]);
        if (!$exists->fetchColumn()) {
            json_response(404, ['error' => 'No se encontró la cuenta del alumno.']);
        }
    }
} catch (PDOException $error) {
    if ($error->getCode() === '23000') {
        json_response(409, ['error' => 'El correo o la matrícula ya pertenecen a otra cuenta.']);
    }
    report_database_error($error);
}

json_response(200, ['message' => 'Datos del alumno actualizados correctamente.']);
