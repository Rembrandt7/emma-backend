-- =============================================
-- SISTEMA EMMA — Script COMPLETO para Supabase
-- PASO 1: Crea tablas  
-- PASO 2: Inserta datos iniciales
-- PASO 3: Índices y triggers
-- PASO 4: Políticas RLS de acceso
-- =============================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- PASO 1: CREAR TABLAS
-- =============================================

CREATE TABLE IF NOT EXISTS clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono        VARCHAR(20) UNIQUE NOT NULL,
  nombre          VARCHAR(100),
  email           VARCHAR(150),
  empresa         VARCHAR(150),
  tipo_cliente    VARCHAR(30) DEFAULT 'prospecto',
  notas           TEXT,
  fuente          VARCHAR(50) DEFAULT 'whatsapp',
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proyectos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID REFERENCES clientes(id) ON DELETE CASCADE,
  titulo           VARCHAR(200) NOT NULL,
  tipo_render      VARCHAR(50),
  cantidad_renders INT DEFAULT 1,
  precio_unitario  NUMERIC(10,2) DEFAULT 1500.00,
  subtotal         NUMERIC(10,2),
  iva              NUMERIC(10,2),
  total            NUMERIC(10,2),
  anticipo_pagado  NUMERIC(10,2) DEFAULT 0,
  saldo_pendiente  NUMERIC(10,2),
  estado           VARCHAR(30) DEFAULT 'cotizacion',
  fecha_inicio     DATE,
  fecha_entrega_estimada DATE,
  drive_folder_id  VARCHAR(200),
  notas_internas   TEXT,
  creado_en        TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID REFERENCES clientes(id) ON DELETE CASCADE,
  canal        VARCHAR(20) DEFAULT 'whatsapp',
  mensaje_id   VARCHAR(100),
  direccion    VARCHAR(10) NOT NULL,
  contenido    TEXT,
  tipo_mensaje VARCHAR(30) DEFAULT 'texto',
  media_url    TEXT,
  estado_emma  VARCHAR(50) DEFAULT 'saludo',
  tokens_usados INT DEFAULT 0,
  creado_en    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archivos_drive (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id      VARCHAR(200) UNIQUE NOT NULL,
  nombre        VARCHAR(300),
  categoria     VARCHAR(50),
  descripcion   TEXT,
  url_descarga  TEXT,
  url_publica   TEXT,
  thumbnail_url TEXT,
  mime_type     VARCHAR(100),
  tamano_bytes  BIGINT,
  enviado_count INT DEFAULT 0,
  activo        BOOLEAN DEFAULT TRUE,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS citas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        UUID REFERENCES clientes(id) ON DELETE CASCADE,
  proyecto_id       UUID REFERENCES proyectos(id),
  calendar_event_id VARCHAR(200),
  titulo            VARCHAR(200),
  fecha_hora        TIMESTAMPTZ,
  duracion_min      INT DEFAULT 60,
  tipo              VARCHAR(50) DEFAULT 'videollamada',
  estado            VARCHAR(30) DEFAULT 'pendiente',
  notas             TEXT,
  creado_en         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reportes_diarios (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha                    DATE UNIQUE,
  nuevos_leads             INT DEFAULT 0,
  conversaciones_activas   INT DEFAULT 0,
  cotizaciones_enviadas    INT DEFAULT 0,
  anticipos_recibidos      NUMERIC(10,2) DEFAULT 0,
  ventas_cerradas          INT DEFAULT 0,
  total_facturado          NUMERIC(10,2) DEFAULT 0,
  archivos_portafolio_enviados INT DEFAULT 0,
  reporte_json             JSONB,
  enviado_email            BOOLEAN DEFAULT FALSE,
  creado_en                TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reglas_emma (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave          VARCHAR(100) UNIQUE NOT NULL,
  valor          TEXT NOT NULL,
  tipo           VARCHAR(20) DEFAULT 'texto',
  descripcion    TEXT,
  categoria      VARCHAR(50) DEFAULT 'general',
  activo         BOOLEAN DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PASO 2: DATOS INICIALES
-- =============================================

INSERT INTO reglas_emma (clave, valor, tipo, descripcion, categoria) VALUES
  ('precio_base',           '1500',    'numero',  'Precio base por render en MXN (sin IVA)', 'precios'),
  ('precio_descuento',      '1200',    'numero',  'Precio con descuento pronto pago/interés', 'precios'),
  ('precio_volumen_min',    '950',     'numero',  'Precio mínimo paquete volumen >10 renders', 'precios'),
  ('precio_volumen_max',    '1000',    'numero',  'Precio máximo paquete volumen >10 renders', 'precios'),
  ('iva_porcentaje',        '16',      'numero',  'Porcentaje de IVA aplicable', 'precios'),
  ('anticipo_porcentaje',   '50',      'numero',  'Porcentaje de anticipo obligatorio', 'negocio'),
  ('volumen_minimo',        '10',      'numero',  'Cantidad mínima para precio de volumen', 'negocio'),
  ('tiempo_entrega',        '24-48',   'texto',   'Horas de entrega tras recibir anticipo', 'negocio'),
  ('nombre_agente',         'Emma',    'texto',   'Nombre de la agente IA', 'identidad'),
  ('cargo_agente',          'Directora de Cuentas', 'texto', 'Cargo de Emma', 'identidad'),
  ('empresa',               'Renders HDR', 'texto', 'Nombre de la empresa', 'identidad'),
  ('jefe_nombre',           'Arq. Rembrandt Blanco Arrambide', 'texto', 'Nombre del director', 'identidad'),
  ('whatsapp_numero',       '8119772135', 'texto', 'Número de WhatsApp Business', 'contacto'),
  ('email_reporte_1',       'rembrandtro@gmail.com', 'texto', 'Email 1 para reportes diarios', 'reportes'),
  ('email_reporte_2',       'rba_ross@hotmail.com',  'texto', 'Email 2 para reportes diarios', 'reportes'),
  ('hora_reporte_diario',   '08:00',   'texto',   'Hora de envío del reporte diario', 'reportes'),
  ('saludo_inicial', 'Hola! Soy Emma, Directora de Cuentas de Renders HDR. ¿En qué puedo ayudarte?', 'texto', 'Mensaje de bienvenida', 'mensajes')
ON CONFLICT (clave) DO NOTHING;

-- =============================================
-- PASO 3: ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_clientes_telefono       ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_conversaciones_cliente  ON conversaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_fecha    ON conversaciones(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente       ON proyectos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_estado        ON proyectos(estado);
CREATE INDEX IF NOT EXISTS idx_archivos_categoria      ON archivos_drive(categoria);
CREATE INDEX IF NOT EXISTS idx_reportes_fecha          ON reportes_diarios(fecha DESC);

-- =============================================
-- PASO 4: FUNCIÓN TIMESTAMP AUTO
-- =============================================

CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_clientes_updated
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE OR REPLACE TRIGGER tr_proyectos_updated
  BEFORE UPDATE ON proyectos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE OR REPLACE TRIGGER tr_archivos_updated
  BEFORE UPDATE ON archivos_drive
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- =============================================
-- PASO 5: VISTA DASHBOARD
-- =============================================

CREATE OR REPLACE VIEW vista_dashboard AS
SELECT
  (SELECT COUNT(*) FROM clientes) AS total_clientes,
  (SELECT COUNT(*) FROM clientes WHERE tipo_cliente = 'prospecto') AS prospectos,
  (SELECT COUNT(*) FROM clientes WHERE tipo_cliente = 'cliente') AS clientes_activos,
  (SELECT COUNT(*) FROM proyectos WHERE estado = 'en_produccion') AS proyectos_en_produccion,
  (SELECT COUNT(*) FROM proyectos WHERE estado = 'cotizacion') AS cotizaciones_pendientes,
  (SELECT COALESCE(SUM(total), 0) FROM proyectos WHERE estado = 'entregado') AS total_facturado,
  (SELECT COALESCE(SUM(anticipo_pagado), 0) FROM proyectos) AS anticipos_recibidos,
  (SELECT COUNT(*) FROM conversaciones WHERE creado_en >= CURRENT_DATE) AS mensajes_hoy;

-- =============================================
-- PASO 6: ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_drive    ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes_diarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas_emma       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_all" ON clientes         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "access_all" ON proyectos        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "access_all" ON conversaciones   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "access_all" ON archivos_drive   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "access_all" ON citas            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "access_all" ON reportes_diarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "access_all" ON reglas_emma      FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- ✅ FIN — Sistema Emma listo en Supabase
-- =============================================
