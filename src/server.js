import express from 'express';
import cors from 'cors';
import { getPool, sql } from './db.js';

const app = express();
const PORT = 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

function requireFields(body, fields) {
  return fields.filter((field) =>
    body[field] === undefined ||
    body[field] === null ||
    body[field] === ''
  );
}

async function addHistory(idTicket, oldState, newState, observation) {
  const pool = await getPool();

  await pool.request()
    .input('id_ticket', sql.Int, Number(idTicket))
    .input('estado_anterior', sql.VarChar(40), oldState)
    .input('estado_nuevo', sql.VarChar(40), newState)
    .input('observacion', sql.VarChar(500), observation || '')
    .query(`
      INSERT INTO HistorialTicket
      (id_ticket, estado_anterior, estado_nuevo, observacion)
      VALUES
      (@id_ticket, @estado_anterior, @estado_nuevo, @observacion)
    `);
}

app.get('/api/health', async (_req, res) => {
  try {
    await getPool();

    res.json({
      ok: true,
      message: 'Backend Service Desk conectado a SQL Server con autenticación de Windows'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: 'No se pudo conectar a SQL Server',
      error: error.message
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const missing = requireFields(req.body, ['correo', 'clave']);

    if (missing.length) {
      return res.status(400).json({
        message: 'Ingrese correo y contraseña.'
      });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('correo', sql.VarChar(100), req.body.correo)
      .input('clave', sql.VarChar(100), req.body.clave)
      .query(`
        SELECT
          u.id_usuario,
          u.nombre,
          u.correo,
          u.estado,
          r.nombre_rol AS rol
        FROM Usuarios u
        INNER JOIN Roles r ON r.id_rol = u.id_rol
        WHERE u.correo = @correo
        AND u.clave = @clave
      `);

    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({
        message: 'Credenciales incorrectas.'
      });
    }

    if (user.estado !== 'Activo') {
      return res.status(403).json({
        message: 'Usuario inactivo.'
      });
    }

    if (!user.rol) {
      return res.status(403).json({
        message: 'Usuario sin rol asignado.'
      });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo iniciar sesión.',
      error: error.message
    });
  }
});

app.get('/api/servicios', async (_req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('estado', sql.VarChar(20), 'Activo')
      .query(`
        SELECT *
        FROM Servicios
        WHERE estado = @estado
        ORDER BY nombre_servicio
      `);

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron cargar los servicios.',
      error: error.message
    });
  }
});

app.get('/api/conocimiento/:idServicio', async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('id_servicio', sql.Int, Number(req.params.idServicio))
      .input('estado', sql.VarChar(20), 'Activo')
      .query(`
        SELECT *
        FROM BaseConocimiento
        WHERE id_servicio = @id_servicio
        AND estado = @estado
        ORDER BY problema
      `);

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo cargar la base de conocimiento.',
      error: error.message
    });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const missing = requireFields(req.body, [
      'id_usuario',
      'id_servicio',
      'descripcion',
      'prioridad'
    ]);

    if (missing.length) {
      return res.status(400).json({
        message: 'Complete todos los campos obligatorios.'
      });
    }

    if (req.body.descripcion.trim().length < 10) {
      return res.status(400).json({
        message: 'La descripción debe explicar mejor el problema.'
      });
    }

    const pool = await getPool();
    const code = `TCK-${Date.now()}`;

    const created = await pool.request()
      .input('codigo', sql.VarChar(30), code)
      .input('id_usuario', sql.Int, Number(req.body.id_usuario))
      .input('id_servicio', sql.Int, Number(req.body.id_servicio))
      .input('descripcion', sql.VarChar(500), req.body.descripcion.trim())
      .input('prioridad', sql.VarChar(30), req.body.prioridad)
      .query(`
        INSERT INTO Tickets
        (codigo, id_usuario, id_servicio, descripcion, prioridad, estado)
        OUTPUT INSERTED.id_ticket
        VALUES
        (@codigo, @id_usuario, @id_servicio, @descripcion, @prioridad, 'Nuevo')
      `);

    const idTicket = created.recordset[0].id_ticket;

    await addHistory(
      idTicket,
      null,
      'Nuevo',
      'Ticket creado por el usuario solicitante.'
    );

    const technicianResult = await pool.request()
      .query(`
        SELECT TOP 1 *
        FROM Tecnicos
        WHERE nivel_soporte = 1
        AND disponibilidad = 'Disponible'
        ORDER BY id_tecnico
      `);

    const technician = technicianResult.recordset[0];

    if (technician) {
      await pool.request()
        .input('id_ticket', sql.Int, idTicket)
        .input('id_tecnico', sql.Int, technician.id_tecnico)
        .input('estado', sql.VarChar(30), 'Activa')
        .query(`
          INSERT INTO Asignaciones
          (id_ticket, id_tecnico, estado)
          VALUES
          (@id_ticket, @id_tecnico, @estado)
        `);

      await pool.request()
        .input('estado', sql.VarChar(40), 'Asignado')
        .input('id_ticket', sql.Int, idTicket)
        .query(`
          UPDATE Tickets
          SET estado = @estado
          WHERE id_ticket = @id_ticket
        `);

      await addHistory(
        idTicket,
        'Nuevo',
        'Asignado',
        'Ticket asignado automáticamente a técnico de Nivel 1.'
      );
    } else {
      await pool.request()
        .input('estado', sql.VarChar(40), 'Pendiente de asignación')
        .input('id_ticket', sql.Int, idTicket)
        .query(`
          UPDATE Tickets
          SET estado = @estado
          WHERE id_ticket = @id_ticket
        `);

      await addHistory(
        idTicket,
        'Nuevo',
        'Pendiente de asignación',
        'No existe técnico disponible.'
      );
    }

    const ticketResult = await pool.request()
      .input('id_ticket', sql.Int, idTicket)
      .query(`
        SELECT *
        FROM Tickets
        WHERE id_ticket = @id_ticket
      `);

    res.status(201).json(ticketResult.recordset[0]);
  } catch (error) {
    res.status(500).json({
      message: 'Error al guardar el ticket. La información ingresada se conserva.',
      error: error.message
    });
  }
});

app.get('/api/tickets', async (req, res) => {
  try {
    const { userId, rol } = req.query;
    const pool = await getPool();

    let query = `
      SELECT
        t.*,
        s.nombre_servicio,
        u.nombre AS usuario_solicitante
      FROM Tickets t
      INNER JOIN Servicios s ON s.id_servicio = t.id_servicio
      INNER JOIN Usuarios u ON u.id_usuario = t.id_usuario
    `;

    const request = pool.request();

    if (rol === 'Usuario') {
      query += `
        WHERE t.id_usuario = @userId
      `;

      request.input('userId', sql.Int, Number(userId));
    }

    query += `
      ORDER BY t.fecha_creacion DESC
    `;

    const result = await request.query(query);

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({
      message: 'No se pudieron cargar los tickets.',
      error: error.message
    });
  }
});

app.get('/api/tickets/:id', async (req, res) => {
  try {
    const pool = await getPool();

    const ticketResult = await pool.request()
      .input('id_ticket', sql.Int, Number(req.params.id))
      .query(`
        SELECT
          t.*,
          s.nombre_servicio,
          u.nombre AS usuario_solicitante
        FROM Tickets t
        INNER JOIN Servicios s ON s.id_servicio = t.id_servicio
        INNER JOIN Usuarios u ON u.id_usuario = t.id_usuario
        WHERE t.id_ticket = @id_ticket
      `);

    const ticket = ticketResult.recordset[0];

    if (!ticket) {
      return res.status(404).json({
        message: 'Ticket no encontrado.'
      });
    }

    const historyResult = await pool.request()
      .input('id_ticket', sql.Int, Number(req.params.id))
      .query(`
        SELECT *
        FROM HistorialTicket
        WHERE id_ticket = @id_ticket
        ORDER BY fecha DESC
      `);

    res.json({
      ...ticket,
      historial: historyResult.recordset
    });
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo cargar el ticket.',
      error: error.message
    });
  }
});

app.patch('/api/tickets/:id/estado', async (req, res) => {
  try {
    const missing = requireFields(req.body, ['estado']);

    if (missing.length) {
      return res.status(400).json({
        message: 'Seleccione el nuevo estado.'
      });
    }

    const pool = await getPool();

    const ticketResult = await pool.request()
      .input('id_ticket', sql.Int, Number(req.params.id))
      .query(`
        SELECT *
        FROM Tickets
        WHERE id_ticket = @id_ticket
      `);

    const ticket = ticketResult.recordset[0];

    if (!ticket) {
      return res.status(404).json({
        message: 'Ticket no encontrado.'
      });
    }

    await pool.request()
      .input('estado', sql.VarChar(40), req.body.estado)
      .input('id_ticket', sql.Int, Number(req.params.id))
      .query(`
        UPDATE Tickets
        SET estado = @estado
        WHERE id_ticket = @id_ticket
      `);

    await addHistory(
      Number(req.params.id),
      ticket.estado,
      req.body.estado,
      req.body.observacion || 'Cambio de estado del ticket.'
    );

    res.json({
      message: 'Estado actualizado correctamente.'
    });
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo cambiar el estado.',
      error: error.message
    });
  }
});

app.post('/api/tickets/:id/escalar', async (req, res) => {
  try {
    const missing = requireFields(req.body, [
      'nivel_origen',
      'nivel_destino',
      'motivo'
    ]);

    if (missing.length) {
      return res.status(400).json({
        message: 'Debe ingresar nivel de origen, nivel de destino y motivo.'
      });
    }

    if (req.body.motivo.trim().length < 5) {
      return res.status(400).json({
        message: 'Ingrese un motivo de escalamiento más claro.'
      });
    }

    const pool = await getPool();

    const ticketResult = await pool.request()
      .input('id_ticket', sql.Int, Number(req.params.id))
      .query(`
        SELECT *
        FROM Tickets
        WHERE id_ticket = @id_ticket
      `);

    const ticket = ticketResult.recordset[0];

    if (!ticket) {
      return res.status(404).json({
        message: 'Ticket no encontrado.'
      });
    }

    await pool.request()
      .input('id_ticket', sql.Int, Number(req.params.id))
      .input('nivel_origen', sql.Int, Number(req.body.nivel_origen))
      .input('nivel_destino', sql.Int, Number(req.body.nivel_destino))
      .input('motivo', sql.VarChar(500), req.body.motivo.trim())
      .query(`
        INSERT INTO Escalamientos
        (id_ticket, nivel_origen, nivel_destino, motivo)
        VALUES
        (@id_ticket, @nivel_origen, @nivel_destino, @motivo)
      `);

    await pool.request()
      .input('estado', sql.VarChar(40), 'Escalado')
      .input('id_ticket', sql.Int, Number(req.params.id))
      .query(`
        UPDATE Tickets
        SET estado = @estado
        WHERE id_ticket = @id_ticket
      `);

    await addHistory(
      Number(req.params.id),
      ticket.estado,
      'Escalado',
      `Escalado por: ${req.body.motivo.trim()}`
    );

    res.json({
      message: 'Ticket escalado correctamente.'
    });
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo escalar el ticket.',
      error: error.message
    });
  }
});

app.post('/api/tickets/:id/cerrar', async (req, res) => {
  try {
    const missing = requireFields(req.body, ['solucion']);

    if (missing.length) {
      return res.status(400).json({
        message: 'No se puede cerrar el ticket sin registrar una solución.'
      });
    }

    if (req.body.solucion.trim().length < 5) {
      return res.status(400).json({
        message: 'La solución debe ser más clara.'
      });
    }

    const pool = await getPool();

    const ticketResult = await pool.request()
      .input('id_ticket', sql.Int, Number(req.params.id))
      .query(`
        SELECT *
        FROM Tickets
        WHERE id_ticket = @id_ticket
      `);

    const ticket = ticketResult.recordset[0];

    if (!ticket) {
      return res.status(404).json({
        message: 'Ticket no encontrado.'
      });
    }

    await pool.request()
      .input('estado', sql.VarChar(40), 'Cerrado')
      .input('solucion', sql.VarChar(500), req.body.solucion.trim())
      .input('id_ticket', sql.Int, Number(req.params.id))
      .query(`
        UPDATE Tickets
        SET estado = @estado,
            solucion = @solucion
        WHERE id_ticket = @id_ticket
      `);

    await addHistory(
      Number(req.params.id),
      ticket.estado,
      'Cerrado',
      `Solución registrada: ${req.body.solucion.trim()}`
    );

    res.json({
      message: 'Ticket cerrado correctamente.'
    });
  } catch (error) {
    res.status(500).json({
      message: 'No se pudo cerrar el ticket.',
      error: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Backend listo en http://0.0.0.0:${PORT}`);

  try {
    await getPool();
  } catch (error) {
    console.log('Revise la conexión a SQL Server.');
  }
});