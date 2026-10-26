CREATE DATABASE IF NOT EXISTS justificat
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE justificat;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS cuentas (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    cuenta VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    matricula VARCHAR(32) NULL,
    carrera VARCHAR(100) NULL,
    semestre TINYINT UNSIGNED NULL,
    grupo VARCHAR(4) NULL,
    rol ENUM('student', 'staff') NOT NULL DEFAULT 'student',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cuentas_cuenta (cuenta),
    UNIQUE KEY uq_cuentas_matricula (matricula)
) ENGINE=InnoDB;

ALTER TABLE cuentas MODIFY cuenta VARCHAR(254) NOT NULL;

INSERT INTO cuentas (cuenta, password_hash, nombre, matricula, carrera, semestre, grupo, rol)
VALUES
    ('alumno', '$2y$10$wvtWYf5lWh6.vIpnGRHr9uI1CXpGnqnxS8yeT7Fccl8FxJggo3gVq', 'Alumno de prueba', 'DEMO258', 'Programación', 1, 'A', 'student'),
    ('encargado', '$2y$10$nL8X7WDuL3rtGlIYrl.B1eAEuSm6En6P.zGfayHSvrWqB9etF24uK', 'Encargado de Orientación', NULL, NULL, NULL, NULL, 'staff')
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre),
    matricula = VALUES(matricula),
    carrera = VALUES(carrera),
    semestre = VALUES(semestre),
    grupo = VALUES(grupo),
    rol = VALUES(rol);
