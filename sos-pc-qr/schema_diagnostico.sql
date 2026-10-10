-- ============================================================
-- SOS PC QR — Migración: Módulo Diagnóstico del Sistema
-- Archivo: schema_diagnostico.sql
-- Ejecutar en: Supabase SQL Editor
-- ⚠️  NO elimina tablas existentes. Solo agrega lo necesario.
-- ============================================================

-- ── 1. Tabla principal de diagnósticos ───────────────────────
create table if not exists public.diagnosticos (
  id               uuid primary key default gen_random_uuid(),
  equipo_id        uuid not null references public.equipos(id) on delete cascade,
  tecnico_id       uuid references public.profiles(id),
  ticket_id        uuid references public.tickets(id),
  fecha_diagnostico timestamptz not null,
  datos_json       jsonb not null,
  observaciones    text,
  creado_en        timestamptz not null default now()
);

-- ── 2. Índices para consultas rápidas ─────────────────────────
create index if not exists diagnosticos_equipo_idx
  on public.diagnosticos(equipo_id, fecha_diagnostico desc);

create index if not exists diagnosticos_tecnico_idx
  on public.diagnosticos(tecnico_id);

create index if not exists diagnosticos_ticket_idx
  on public.diagnosticos(ticket_id)
  where ticket_id is not null;

-- ── 3. Row Level Security ─────────────────────────────────────
alter table public.diagnosticos enable row level security;

-- Solo personal autenticado (admin o técnico) puede leer
drop policy if exists diagnosticos_read on public.diagnosticos;
create policy diagnosticos_read
  on public.diagnosticos
  for select
  to authenticated
  using (public.es_personal());

-- Solo personal autenticado puede insertar diagnósticos propios
drop policy if exists diagnosticos_insert on public.diagnosticos;
create policy diagnosticos_insert
  on public.diagnosticos
  for insert
  to authenticated
  with check (
    public.es_personal()
    and tecnico_id = (select auth.uid())
  );

-- Solo el técnico que lo creó o un admin puede actualizar
drop policy if exists diagnosticos_update on public.diagnosticos;
create policy diagnosticos_update
  on public.diagnosticos
  for update
  to authenticated
  using (
    public.es_admin()
    or tecnico_id = (select auth.uid())
  )
  with check (
    public.es_admin()
    or tecnico_id = (select auth.uid())
  );

-- Solo admin puede borrar
drop policy if exists diagnosticos_delete on public.diagnosticos;
create policy diagnosticos_delete
  on public.diagnosticos
  for delete
  to authenticated
  using (public.es_admin());

-- ── 4. Función de consulta pública para técnicos ──────────────
-- Retorna los diagnósticos de un equipo con datos resumidos del técnico
create or replace function public.listar_diagnosticos_equipo(p_equipo_id uuid)
returns table (
  id               uuid,
  fecha_diagnostico timestamptz,
  tecnico_nombre   text,
  ticket_numero    bigint,
  observaciones    text,
  datos_json       jsonb
)
language sql stable security definer set search_path = ''
as $$
  select
    d.id,
    d.fecha_diagnostico,
    pr.nombre,
    t.numero,
    d.observaciones,
    d.datos_json
  from public.diagnosticos d
  left join public.profiles pr on pr.id = d.tecnico_id
  left join public.tickets t   on t.id  = d.ticket_id
  where d.equipo_id = p_equipo_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and rol in ('admin','tecnico')
    )
  order by d.fecha_diagnostico desc
  limit 50;
$$;

-- Revocar acceso público y otorgar solo a autenticados
revoke all on function public.listar_diagnosticos_equipo(uuid) from public;
grant execute on function public.listar_diagnosticos_equipo(uuid) to authenticated;

-- ── Fin de migración ──────────────────────────────────────────
-- Verifica que las tablas se crearon correctamente:
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name = 'diagnosticos';

-- ── 5. Configuración de Storage para la herramienta ───────────
-- Requiere privilegios de superusuario o ejecución desde el panel de Supabase
insert into storage.buckets (id, name, public) 
values ('herramientas', 'herramientas', true)
on conflict (id) do nothing;

drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" 
  on storage.objects for select 
  using ( bucket_id = 'herramientas' );

drop policy if exists "Admin Upload" on storage.objects;
create policy "Admin Upload" 
  on storage.objects for insert 
  to authenticated
  with check (
    bucket_id = 'herramientas' and public.es_admin()
  );

drop policy if exists "Admin Update" on storage.objects;
create policy "Admin Update" 
  on storage.objects for update 
  to authenticated
  using ( bucket_id = 'herramientas' and public.es_admin() )
  with check ( bucket_id = 'herramientas' and public.es_admin() );

drop policy if exists "Admin Delete" on storage.objects;
create policy "Admin Delete" 
  on storage.objects for delete 
  to authenticated
  using ( bucket_id = 'herramientas' and public.es_admin() );

