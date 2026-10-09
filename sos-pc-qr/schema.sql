-- Ejecutar en Supabase SQL Editor. Proyecto de demostración; revise políticas antes de producción.
create extension if not exists pgcrypto;
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, nombre text not null default '', rol text not null default 'tecnico' check (rol in ('admin','tecnico')), creado_en timestamptz default now());
create table if not exists public.ubicaciones (id uuid primary key default gen_random_uuid(), nombre text not null unique);
create table if not exists public.equipos (id uuid primary key default gen_random_uuid(), codigo text not null unique, nombre text not null, tipo text not null default 'PC', ubicacion_id uuid references public.ubicaciones(id), descripcion text, creado_en timestamptz default now());
create table if not exists public.tickets (id uuid primary key default gen_random_uuid(), numero bigint generated always as identity unique, consulta_token uuid not null default gen_random_uuid(), equipo_id uuid references public.equipos(id), codigo_equipo text, ubicacion text not null, solicitante text not null, contacto text, dispositivo text not null, categoria text not null, descripcion text not null, aparicion text, urgencia text not null check (urgencia in ('Alta','Media','Baja')), prioridad text not null default 'Media' check (prioridad in ('Alta','Media','Baja')), estado text not null default 'Pendiente' check (estado in ('Pendiente','Asignado','En diagnóstico','En atención','En espera','Solucionado','Derivado','Cerrado')), tecnico_id uuid references public.profiles(id), diagnostico text, pruebas text, solucion text, recomendaciones text, creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(), cerrado_en timestamptz);
create table if not exists public.ticket_historial (id bigint generated always as identity primary key, ticket_id uuid not null references public.tickets(id) on delete cascade, autor_id uuid references auth.users(id), estado text not null, nota text, creado_en timestamptz not null default now());
create index if not exists tickets_creado_idx on public.tickets(creado_en desc);
create index if not exists tickets_equipo_idx on public.tickets(equipo_id);
create index if not exists historial_ticket_idx on public.ticket_historial(ticket_id,creado_en);
create or replace function public.es_personal() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and rol in ('admin','tecnico')) $$;
create or replace function public.es_admin() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and rol = 'admin') $$;
alter table public.profiles enable row level security;
alter table public.ubicaciones enable row level security;
alter table public.equipos enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_historial enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (public.es_personal());
create policy ubicaciones_read on public.ubicaciones for select to anon, authenticated using (true);
create policy equipos_read on public.equipos for select to anon, authenticated using (true);
create policy ubicaciones_write on public.ubicaciones for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy equipos_write on public.equipos for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy tickets_read on public.tickets for select to authenticated using (public.es_personal());
create policy tickets_update on public.tickets for update to authenticated using (public.es_personal()) with check (public.es_personal());
create policy historial_read on public.ticket_historial for select to authenticated using (public.es_personal());
create policy historial_insert on public.ticket_historial for insert to authenticated with check (public.es_personal() and autor_id = (select auth.uid()));
-- El formulario público crea tickets mediante RPC sin permitir leer la tabla.
create or replace function public.reportar_incidencia(p_solicitante text,p_contacto text,p_equipo_id uuid,p_codigo_equipo text,p_ubicacion text,p_dispositivo text,p_categoria text,p_descripcion text,p_aparicion text,p_urgencia text)
returns table (numero bigint, token uuid) language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_num bigint; v_token uuid; v_codigo text; v_ubicacion text;
begin
 if length(trim(coalesce(p_solicitante,''))) not between 2 and 120 or length(trim(coalesce(p_descripcion,''))) not between 10 and 2000 or length(trim(coalesce(p_ubicacion,''))) > 200 or length(trim(coalesce(p_contacto,''))) > 150 or length(trim(coalesce(p_codigo_equipo,''))) > 100 or length(trim(coalesce(p_dispositivo,''))) not between 2 and 60 or length(trim(coalesce(p_categoria,''))) not between 2 and 60 or p_urgencia not in ('Alta','Media','Baja') then raise exception 'Datos inválidos'; end if;
 if p_equipo_id is not null then
   select e.codigo,u.nombre into v_codigo,v_ubicacion from public.equipos e left join public.ubicaciones u on u.id=e.ubicacion_id where e.id=p_equipo_id;
   if not found then raise exception 'Equipo no encontrado'; end if;
 else v_codigo := nullif(trim(p_codigo_equipo),''); end if;
 insert into public.tickets(equipo_id,codigo_equipo,ubicacion,solicitante,contacto,dispositivo,categoria,descripcion,aparicion,urgencia,prioridad)
 values(p_equipo_id,coalesce(v_codigo,nullif(trim(p_codigo_equipo),'')),coalesce(v_ubicacion,nullif(trim(p_ubicacion),''),'Sin ubicación'),trim(p_solicitante),nullif(trim(p_contacto),''),trim(p_dispositivo),trim(p_categoria),trim(p_descripcion),left(p_aparicion,100),p_urgencia,p_urgencia)
 returning id,tickets.numero,consulta_token into v_id,v_num,v_token;
 insert into public.ticket_historial(ticket_id,estado,nota) values(v_id,'Pendiente','Reporte recibido');
 return query select v_num,v_token;
end $$;
-- Token privado entregado al solicitante: nunca devolver contacto ni datos de terceros.
create or replace function public.consultar_ticket(p_numero bigint,p_token uuid)
returns table(numero bigint,estado text,prioridad text,categoria text,descripcion text,codigo_equipo text,ubicacion text,creado_en timestamptz,actualizado_en timestamptz,solucion text,recomendaciones text)
language sql stable security definer set search_path = '' as $$
 select t.numero,t.estado,t.prioridad,t.categoria,t.descripcion,t.codigo_equipo,t.ubicacion,t.creado_en,t.actualizado_en,t.solucion,t.recomendaciones from public.tickets t where t.numero=p_numero and t.consulta_token=p_token
$$;
revoke all on function public.reportar_incidencia(text,text,uuid,text,text,text,text,text,text,text) from public;
revoke all on function public.consultar_ticket(bigint,uuid) from public;
grant execute on function public.reportar_incidencia(text,text,uuid,text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.consultar_ticket(bigint,uuid) to anon,authenticated;
-- Registrar primer administrador manualmente tras crear su usuario en Authentication:
-- insert into public.profiles(id,nombre,rol) values ('UUID_DEL_USUARIO','Administrador','admin');
-- Para técnicos: insert into public.profiles(id,nombre,rol) values ('UUID_DEL_TECNICO','Técnico','tecnico');
