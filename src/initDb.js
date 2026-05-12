import { run, get } from './db.js';

export async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS roles (
    id_rol INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_rol TEXT NOT NULL UNIQUE,
    descripcion TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE,
    clave TEXT NOT NULL,
    id_rol INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Activo',
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS servicios (
    id_servicio INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_servicio TEXT NOT NULL,
    categoria TEXT NOT NULL,
    descripcion TEXT,
    estado TEXT NOT NULL DEFAULT 'Activo'
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tecnicos (
    id_tecnico INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    nivel_soporte INTEGER NOT NULL DEFAULT 1,
    disponibilidad TEXT NOT NULL DEFAULT 'Disponible',
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tickets (
    id_ticket INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    id_usuario INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    prioridad TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Nuevo',
    solucion TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS asignaciones (
    id_asignacion INTEGER PRIMARY KEY AUTOINCREMENT,
    id_ticket INTEGER NOT NULL,
    id_tecnico INTEGER NOT NULL,
    fecha_asignacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado TEXT NOT NULL DEFAULT 'Activa',
    FOREIGN KEY (id_ticket) REFERENCES tickets(id_ticket),
    FOREIGN KEY (id_tecnico) REFERENCES tecnicos(id_tecnico)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS escalamientos (
    id_escalamiento INTEGER PRIMARY KEY AUTOINCREMENT,
    id_ticket INTEGER NOT NULL,
    nivel_origen INTEGER NOT NULL,
    nivel_destino INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    fecha_escalamiento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_ticket) REFERENCES tickets(id_ticket)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS base_conocimiento (
    id_articulo INTEGER PRIMARY KEY AUTOINCREMENT,
    id_servicio INTEGER NOT NULL,
    problema TEXT NOT NULL,
    solucion TEXT NOT NULL,
    categoria TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Activo',
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS historial_ticket (
    id_historial INTEGER PRIMARY KEY AUTOINCREMENT,
    id_ticket INTEGER NOT NULL,
    estado_anterior TEXT,
    estado_nuevo TEXT NOT NULL,
    observacion TEXT,
    fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_ticket) REFERENCES tickets(id_ticket)
  )`);

  await seed();
}

async function seed() {
  const existing = await get('SELECT COUNT(*) AS total FROM roles');
  if (existing.total > 0) return;

  await run(`INSERT INTO roles(nombre_rol, descripcion) VALUES
    ('Usuario', 'Personal administrativo que crea y consulta tickets'),
    ('Tecnico', 'Personal de soporte que atiende tickets'),
    ('Administrador', 'Usuario que supervisa el sistema')`);

  await run(`INSERT INTO usuarios(nombre, correo, clave, id_rol, estado) VALUES
    ('María Administrativa', 'usuario@uta.edu.ec', '123456', 1, 'Activo'),
    ('Carlos Técnico', 'tecnico@uta.edu.ec', '123456', 2, 'Activo'),
    ('Ana Administradora', 'admin@uta.edu.ec', '123456', 3, 'Activo')`);

  await run(`INSERT INTO tecnicos(id_usuario, nivel_soporte, disponibilidad) VALUES
    (2, 1, 'Disponible')`);

  await run(`INSERT INTO servicios(nombre_servicio, categoria, descripcion) VALUES
    ('Internet institucional', 'Tecnología', 'Problemas de conexión a internet o red inalámbrica.'),
    ('Correo institucional', 'Tecnología', 'Problemas de ingreso, recuperación o configuración del correo.'),
    ('Plataforma académica', 'Académico', 'Problemas de acceso o uso de plataformas institucionales.'),
    ('Equipos de oficina', 'Soporte técnico', 'Fallas en computadoras, impresoras o periféricos.'),
    ('Claves y accesos', 'Seguridad', 'Restablecimiento de contraseñas y permisos básicos.')`);

  await run(`INSERT INTO base_conocimiento(id_servicio, problema, solucion, categoria) VALUES
    (1, 'No tengo internet', 'Revise que el equipo esté conectado a la red UTA y reinicie la conexión inalámbrica.', 'Red'),
    (2, 'No puedo ingresar al correo', 'Verifique que el correo esté escrito correctamente y pruebe recuperar la contraseña.', 'Correo'),
    (3, 'No carga la plataforma', 'Actualice el navegador y limpie la memoria caché antes de volver a ingresar.', 'Plataformas'),
    (4, 'La impresora no imprime', 'Revise que la impresora esté encendida, tenga papel y esté seleccionada como predeterminada.', 'Equipos'),
    (5, 'Olvidé mi clave', 'Use la opción de recuperación de contraseña o solicite el restablecimiento al soporte.', 'Accesos')`);
}
