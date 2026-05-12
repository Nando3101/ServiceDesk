import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

/*
  IMPORTANTE:
  Antes tenías:
  const API = 'http://localhost:3001/api';

  Ahora se usa window.location.hostname para que funcione así:
  - En la misma PC: http://localhost:5173
  - En otro celular/computadora: http://IP-DE-TU-PC:5173

  El frontend tomará automáticamente la IP del host.
*/
const API = `http://${window.location.hostname}:3001/api`;

const priorities = ['Baja', 'Media', 'Alta', 'Urgente'];

const states = [
  'Nuevo',
  'Asignado',
  'En revisión',
  'Pendiente de usuario',
  'Pendiente de asignación',
  'Escalado',
  'Resuelto',
  'Cerrado',
  'Cancelado'
];

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Error en el sistema');
  }

  return data;
}

function App() {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem('sd_user') || 'null')
  );

  function handleLogin(userData) {
    localStorage.setItem('sd_user', JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('sd_user');
    setUser(null);
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <Header user={user} onLogout={logout} />
      <RolePanel user={user} />
    </div>
  );
}

/*
  Aquí está la corrección principal:
  El sistema ya no decide por "móvil" o "escritorio".
  Ahora decide por ROL.

  El diseño se adapta con CSS:
  - En computadora se ve amplio.
  - En celular se acomoda en una columna.
*/
function RolePanel({ user }) {
  if (user.rol === 'Usuario') {
    return <UserPanel user={user} />;
  }

  if (user.rol === 'Tecnico') {
    return <SupportPanel user={user} />;
  }

  if (user.rol === 'Administrador') {
    return <SupportPanel user={user} />;
  }

  return (
    <main className="content">
      <div className="alert error">
        El rol del usuario no está permitido.
      </div>
    </main>
  );
}

function Header({ user, onLogout }) {
  return (
    <header className="header">
      <div className="brand">
        <div className="shield">UTA</div>
        <div>
          <h1>Service Desk UTA</h1>
          <p>Sistema de soporte institucional · Sprint 1</p>
        </div>
      </div>

      <div className="user-box">
        <div>
          <span>{user.nombre}</span>
          <small>Rol: {user.rol}</small>
        </div>
        <button onClick={onLogout}>Salir</button>
      </div>
    </header>
  );
}

function Login({ onLogin }) {
  const [correo, setCorreo] = useState('usuario@uta.edu.ec');
  const [clave, setClave] = useState('123456');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const data = await request('/login', {
        method: 'POST',
        body: JSON.stringify({ correo, clave }),
      });

      onLogin(data.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="shield big">UTA</div>

        <h1>Service Desk</h1>
        <p>
          Sistema para registrar, atender y consultar tickets de soporte institucional.
        </p>

        <form onSubmit={submit}>
          <label>Correo institucional</label>
          <input
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="usuario@uta.edu.ec"
          />

          <label>Contraseña</label>
          <input
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            type="password"
            placeholder="Contraseña"
          />

          {message && <div className="alert error">{message}</div>}

          <button className="primary" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="demo-users">
          <strong>Usuarios de prueba</strong>
          <span>usuario@uta.edu.ec / 123456</span>
          <span>tecnico@uta.edu.ec / 123456</span>
          <span>admin@uta.edu.ec / 123456</span>
        </div>
      </section>
    </main>
  );
}

/* PANEL DEL USUARIO SOLICITANTE */
function UserPanel({ user }) {
  const [view, setView] = useState('home');
  const [services, setServices] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [articles, setArticles] = useState([]);
  const [message, setMessage] = useState('');

  async function loadServices() {
    const data = await request('/servicios');
    setServices(data);
  }

  async function loadTickets() {
    const data = await request(`/tickets?rol=Usuario&userId=${user.id_usuario}`);
    setTickets(data);
  }

  useEffect(() => {
    loadServices();
    loadTickets();
  }, []);

  async function chooseService(service) {
    setSelectedService(service);
    const data = await request(`/conocimiento/${service.id_servicio}`);
    setArticles(data);
    setView('knowledge');
  }

  return (
    <main className="content">
      <section className="panel-card">
        {view === 'home' && (
          <>
            <div className="panel-title">
              <div>
                <h2>Panel del usuario solicitante</h2>
                <p className="muted">
                  Puede crear tickets, revisar servicios y consultar el estado de sus solicitudes.
                </p>
              </div>
            </div>

            <div className="option-grid">
              <button className="option-card" onClick={() => setView('services')}>
                <strong>Crear ticket</strong>
                <span>Registrar una nueva solicitud de soporte.</span>
              </button>

              <button
                className="option-card"
                onClick={() => {
                  loadTickets();
                  setView('tickets');
                }}
              >
                <strong>Mis tickets</strong>
                <span>Consultar el estado de mis solicitudes.</span>
              </button>

              <button className="option-card" onClick={() => setView('services')}>
                <strong>Soluciones frecuentes</strong>
                <span>Revisar respuestas antes de crear un ticket.</span>
              </button>
            </div>
          </>
        )}

        {view === 'services' && (
          <>
            <Back onClick={() => setView('home')} />

            <h2>Catálogo de servicios</h2>
            <p className="muted">
              Elija el servicio relacionado con el problema que desea reportar.
            </p>

            <div className="list">
              {services.map((service) => (
                <button
                  className="service-item"
                  key={service.id_servicio}
                  onClick={() => chooseService(service)}
                >
                  <strong>{service.nombre_servicio}</strong>
                  <span>{service.descripcion}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {view === 'knowledge' && selectedService && (
          <>
            <Back onClick={() => setView('services')} />

            <h2>Soluciones frecuentes</h2>
            <p className="muted">
              Servicio seleccionado: {selectedService.nombre_servicio}
            </p>

            {articles.length === 0 ? (
              <div className="alert">
                No existen soluciones registradas para este servicio.
              </div>
            ) : (
              articles.map((item) => (
                <article className="knowledge" key={item.id_articulo}>
                  <strong>{item.problema}</strong>
                  <p>{item.solucion}</p>
                </article>
              ))
            )}

            <button className="primary" onClick={() => setView('create')}>
              No resolvió mi problema, crear ticket
            </button>
          </>
        )}

        {view === 'create' && selectedService && (
          <TicketForm
            user={user}
            service={selectedService}
            onBack={() => setView('knowledge')}
            onDone={async (text) => {
              setMessage(text);
              await loadTickets();
              setView('tickets');
            }}
          />
        )}

        {view === 'tickets' && (
          <>
            <Back onClick={() => setView('home')} />

            <h2>Mis tickets</h2>
            <p className="muted">
              Aquí puede revisar el estado de las solicitudes creadas por usted.
            </p>

            {message && <div className="alert success">{message}</div>}

            {tickets.length === 0 && (
              <div className="alert">
                Aún no tiene tickets creados.
              </div>
            )}

            <div className="list">
              {tickets.map((ticket) => (
                <TicketCard key={ticket.id_ticket} ticket={ticket} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function TicketForm({ user, service, onDone, onBack }) {
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState('Media');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function save(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await request('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          id_usuario: user.id_usuario,
          id_servicio: service.id_servicio,
          descripcion,
          prioridad,
        }),
      });

      onDone('Ticket creado correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="form-card">
      <Back onClick={onBack} />

      <h2>Crear ticket</h2>
      <p className="muted">
        Servicio seleccionado: {service.nombre_servicio}
      </p>

      <label>Descripción del problema</label>
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Explique qué sucede, dónde ocurre y desde cuándo presenta el problema."
      />

      <label>Prioridad</label>
      <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
        {priorities.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>

      {error && <div className="alert error">{error}</div>}

      <button className="primary" disabled={loading}>
        {loading ? 'Guardando...' : 'Enviar ticket'}
      </button>
    </form>
  );
}

/* PANEL DEL TÉCNICO Y ADMINISTRADOR */
function SupportPanel({ user }) {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');

  async function loadTickets() {
    const data = await request(`/tickets?rol=${user.rol}&userId=${user.id_usuario}`);
    setTickets(data);
  }

  async function loadTicket(id) {
    const data = await request(`/tickets/${id}`);
    setSelected(data);
  }

  useEffect(() => {
    loadTickets();
  }, []);

  return (
    <main className="desktop-layout">
      <aside className="sidebar">
        <strong>Panel {user.rol}</strong>

        <button>Tickets</button>
        <button>Servicios</button>
        <button>Escalamiento</button>
        <button>Base de conocimiento</button>

        {user.rol === 'Administrador' && (
          <>
            <button>Usuarios</button>
            <button>Técnicos</button>
          </>
        )}
      </aside>

      <section className="panel-card">
        <div className="panel-title">
          <div>
            <h2>
              {user.rol === 'Administrador'
                ? 'Panel del administrador'
                : 'Panel del técnico de soporte'}
            </h2>
            <p className="muted">
              Revise tickets, cambie estados, escale casos o registre soluciones.
            </p>
          </div>

          <button onClick={loadTickets}>Actualizar</button>
        </div>

        {message && <div className="alert success">{message}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Usuario</th>
                <th>Servicio</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id_ticket}>
                  <td>{ticket.codigo}</td>
                  <td>{ticket.usuario_solicitante}</td>
                  <td>{ticket.nombre_servicio}</td>
                  <td>{ticket.prioridad}</td>
                  <td>
                    <Badge state={ticket.estado} />
                  </td>
                  <td>
                    <button onClick={() => loadTicket(ticket.id_ticket)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}

              {tickets.length === 0 && (
                <tr>
                  <td colSpan="6">
                    No existen tickets registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <TicketDetail
          ticket={selected}
          onClose={() => setSelected(null)}
          onChanged={async (text) => {
            setMessage(text);
            await loadTickets();
            await loadTicket(selected.id_ticket);
          }}
        />
      )}
    </main>
  );
}

function TicketDetail({ ticket, onClose, onChanged }) {
  const [estado, setEstado] = useState(ticket.estado);
  const [observacion, setObservacion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [solucion, setSolucion] = useState(ticket.solucion || '');
  const [error, setError] = useState('');

  async function changeState() {
    setError('');

    try {
      await request(`/tickets/${ticket.id_ticket}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado, observacion }),
      });

      onChanged('Estado actualizado correctamente.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function escalate() {
    setError('');

    try {
      await request(`/tickets/${ticket.id_ticket}/escalar`, {
        method: 'POST',
        body: JSON.stringify({
          nivel_origen: 1,
          nivel_destino: 2,
          motivo,
        }),
      });

      onChanged('Ticket escalado correctamente.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeTicket() {
    setError('');

    try {
      await request(`/tickets/${ticket.id_ticket}/cerrar`, {
        method: 'POST',
        body: JSON.stringify({ solucion }),
      });

      onChanged('Ticket cerrado correctamente.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="modal">
      <div className="detail-card">
        <div className="panel-title">
          <div>
            <h2>Detalle del ticket</h2>
            <p className="muted">{ticket.codigo}</p>
          </div>

          <button onClick={onClose}>Cerrar ventana</button>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="detail-grid">
          <p>
            <strong>Usuario:</strong> {ticket.usuario_solicitante}
          </p>

          <p>
            <strong>Servicio:</strong> {ticket.nombre_servicio}
          </p>

          <p>
            <strong>Prioridad:</strong> {ticket.prioridad}
          </p>

          <p>
            <strong>Estado actual:</strong> <Badge state={ticket.estado} />
          </p>
        </div>

        <p>
          <strong>Descripción:</strong> {ticket.descripcion}
        </p>

        <div className="actions-grid">
          <div className="box">
            <h3>Cambiar estado</h3>

            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <input
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Observación opcional"
            />

            <button onClick={changeState}>Guardar estado</button>
          </div>

          <div className="box">
            <h3>Escalar ticket</h3>

            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo obligatorio para escalar"
            />

            <button onClick={escalate}>Escalar a Nivel 2</button>
          </div>

          <div className="box">
            <h3>Registrar solución y cerrar</h3>

            <textarea
              value={solucion}
              onChange={(e) => setSolucion(e.target.value)}
              placeholder="Solución aplicada"
            />

            <button className="primary" onClick={closeTicket}>
              Cerrar ticket
            </button>
          </div>
        </div>

        <h3>Historial</h3>

        <div className="history">
          {ticket.historial?.map((item) => (
            <div key={item.id_historial}>
              <strong>
                {item.estado_anterior || 'Inicio'} → {item.estado_nuevo}
              </strong>
              <span>{item.observacion}</span>
            </div>
          ))}

          {ticket.historial?.length === 0 && (
            <div>No existe historial registrado.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function TicketCard({ ticket }) {
  return (
    <article className="ticket-card">
      <div>
        <strong>{ticket.codigo}</strong>
        <span>{ticket.nombre_servicio}</span>
      </div>

      <Badge state={ticket.estado} />

      <p>{ticket.descripcion}</p>

      {ticket.solucion && (
        <p className="solution">
          <strong>Solución:</strong> {ticket.solucion}
        </p>
      )}
    </article>
  );
}

function Badge({ state }) {
  const className = state
    .toLowerCase()
    .replaceAll(' ', '-')
    .replaceAll('ó', 'o')
    .replaceAll('é', 'e')
    .replaceAll('í', 'i')
    .replaceAll('á', 'a');

  return <span className={`badge ${className}`}>{state}</span>;
}

function Back({ onClick }) {
  return (
    <button className="back" type="button" onClick={onClick}>
      ← Volver
    </button>
  );
}

createRoot(document.getElementById('root')).render(<App />);