<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_method('GET');
require_staff();

try {
    $query = database()->query(
        'SELECT cuenta, nombre, matricula, carrera, semestre, grupo, created_at
         FROM cuentas WHERE rol = "student"
         ORDER BY nombre ASC, cuenta ASC'
    );
    $students = $query->fetchAll();
} catch (PDOException $error) {
    report_database_error($error);
}

foreach ($students as &$student) {
    $student['account'] = $student['cuenta'];
    $student['fullName'] = $student['nombre'];
    $student['studentId'] = $student['matricula'];
    $student['career'] = $student['carrera'];
    $student['semester'] = $student['semestre'] !== null ? (string) $student['semestre'] : '';
    $student['group'] = $student['grupo'];
    unset(
        $student['cuenta'],
        $student['nombre'],
        $student['matricula'],
        $student['carrera'],
        $student['semestre'],
        $student['grupo']
    );
}
unset($student);

json_response(200, ['students' => $students]);
