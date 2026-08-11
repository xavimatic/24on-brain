import pkg from '@next/env';
const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando seed de ecosistema de entidades y vínculos...');

  // Limpieza previa para evitar duplicados
  await prisma.vinculos.deleteMany({});
  await prisma.proyectos.updateMany({ data: { entidad_id: null } });
  await prisma.entidades.deleteMany({});

  // 1. Creación de Entidades (Personas y Empresas)
  const xavier = await prisma.entidades.create({
    data: { nombre: 'Xavier Reyes', tipo: 'PERSONA', metadatos: { alias: ['yo', 'propietario', 'xavier'] } }
  });
  const dario = await prisma.entidades.create({
    data: { nombre: 'Dario Ovelar', tipo: 'PERSONA', metadatos: { alias: ['tio dario', 'dario', 'tio'] } }
  });
  const fabio = await prisma.entidades.create({
    data: { nombre: 'Fabio Cino', tipo: 'PERSONA', metadatos: { alias: ['fabio', 'cino'] } }
  });

  const agency24on = await prisma.entidades.create({
    data: { nombre: '24on', tipo: 'EMPRESA', metadatos: { alias: ['agencia', '24on.com.py', '24on system'] } }
  });
  const jordan = await prisma.entidades.create({
    data: { nombre: 'Jordan Laboratorio Common Rail', tipo: 'EMPRESA', metadatos: { alias: ['jordan', 'taller jordan', 'laboratorio jordan', 'jordan.com.py', 'jordan.24on.com.py'] } }
  });
  const bauel = await prisma.entidades.create({
    data: { nombre: 'Bauel Top', tipo: 'EMPRESA', metadatos: { alias: ['bauel', 'baueltop.com.py'] } }
  });
  const hygsa = await prisma.entidades.create({
    data: { nombre: 'HyG S.A.', tipo: 'EMPRESA', metadatos: { alias: ['hygsa', 'hygsa.com.py', 'hyg'] } }
  });
  const batical = await prisma.entidades.create({
    data: { nombre: 'Batical', tipo: 'EMPRESA', metadatos: { alias: ['batical.com.py', 'batical'] } }
  });

  const nix = await prisma.entidades.create({
    data: { nombre: 'Nix Cronicas', tipo: 'EMPRESA', metadatos: { alias: ['nix', 'nixmatic', 'nix chronicles', 'canal de youtube', 'youtube'] } }
  });
  const ventasPy = await prisma.entidades.create({
    data: { nombre: 'Ventas de Paraguay', tipo: 'EMPRESA', metadatos: { alias: ['ventasdeparaguay.com', 'ventas de paraguay', 'amazon paraguay'] } }
  });

  // 2. Creación de Vínculos y Relaciones del Holding
  const relaciones = [
    { orig: xavier.id, dest: agency24on.id, tipo: 'PROPIETARIO_DE' },
    { orig: xavier.id, dest: nix.id, tipo: 'PROPIETARIO_DE' },
    { orig: xavier.id, dest: ventasPy.id, tipo: 'PROPIETARIO_DE' },
    { orig: dario.id, dest: xavier.id, tipo: 'TIO_DE' },
    { orig: dario.id, dest: jordan.id, tipo: 'PROPIETARIO_DE' },
    { orig: fabio.id, dest: bauel.id, tipo: 'PROPIETARIO_DE' },
    { orig: fabio.id, dest: hygsa.id, tipo: 'PROPIETARIO_DE' },
    { orig: fabio.id, dest: batical.id, tipo: 'PROPIETARIO_DE' },
    { orig: agency24on.id, dest: jordan.id, tipo: 'PROVEEDOR_DE' },
    { orig: agency24on.id, dest: bauel.id, tipo: 'PROVEEDOR_DE' },
    { orig: agency24on.id, dest: hygsa.id, tipo: 'PROVEEDOR_DE' },
  ];

  for (const rel of relaciones) {
    await prisma.vinculos.create({
      data: { origen_id: rel.orig, destino_id: rel.dest, tipo: rel.tipo }
    });
  }

  // 3. Sincronizar Proyectos para retrocompatibilidad


  await prisma.proyectos.upsert({
    where: { nombre: 'NIX CRÓNICAS' },
    update: { entidad_id: xavier.id, metadatos: { alias: ['nix', 'nixmatic', 'nix chronicles', 'canal de youtube'] } },
    create: { nombre: 'NIX CRÓNICAS', descripcion: 'Nix Crónicas', entidad_id: xavier.id, metadatos: { alias: ['nix', 'nixmatic', 'nix chronicles', 'canal de youtube'] } },
  });

  await prisma.proyectos.upsert({
    where: { nombre: 'VENTAS DE PARAGUAY' },
    update: { entidad_id: xavier.id, metadatos: { alias: ['ventas de paraguay'] } },
    create: { nombre: 'VENTAS DE PARAGUAY', descripcion: 'Ventas de Paraguay', entidad_id: xavier.id, metadatos: { alias: ['ventas de paraguay'] } },
  });

  await prisma.proyectos.upsert({
    where: { nombre: 'JORDAN' },
    update: { entidad_id: dario.id, metadatos: { alias: ['jordan', 'taller jordan', 'laboratorio jordan', 'jordan.com.py'] } },
    create: { nombre: 'JORDAN', descripcion: 'Jordan Laboratorio Common Rail', entidad_id: dario.id, metadatos: { alias: ['jordan', 'taller jordan', 'laboratorio jordan', 'jordan.com.py'] } },
  });

  await prisma.proyectos.upsert({
    where: { nombre: 'BAUEL TOP' },
    update: { entidad_id: fabio.id, metadatos: { alias: ['bauel', 'baueltop.com.py'] } },
    create: { nombre: 'BAUEL TOP', descripcion: 'Bauel Top', entidad_id: fabio.id, metadatos: { alias: ['bauel', 'baueltop.com.py'] } },
  });

  await prisma.proyectos.upsert({
    where: { nombre: 'HYG S.A.' },
    update: { entidad_id: fabio.id, metadatos: { alias: ['hygsa', 'hygsa.com.py', 'hyg'] } },
    create: { nombre: 'HYG S.A.', descripcion: 'HyG S.A.', entidad_id: fabio.id, metadatos: { alias: ['hygsa', 'hygsa.com.py', 'hyg'] } },
  });

  // Re-sembrar los 13 cobros de Jordan para que la UI vuelva a funcionar
  const jordanProj = await prisma.proyectos.findUnique({ where: { nombre: 'JORDAN' } });
  if (jordanProj) {
    console.log('Sembrando cobros de Jordan...');
    await prisma.finanzas.deleteMany({ where: { proyecto_id: jordanProj.id } });
    await prisma.finanzas.createMany({
      data: [
        { descripcion: 'Servicio Taller Mecánico - Common Rail', monto: 1200000, tipo: 'vencimiento_cliente', proyecto_id: jordanProj.id, estado_pago: 'pendiente', fecha_vencimiento: new Date('2026-06-12') },
        { descripcion: 'Repuesto Inyector Diesel - Jordan Taller', monto: 850000, tipo: 'vencimiento_cliente', proyecto_id: jordanProj.id, estado_pago: 'pendiente', fecha_vencimiento: new Date('2026-06-15') },
        { descripcion: 'Mantenimiento Preventivo Bomba de Inyección', monto: 950000, tipo: 'vencimiento_cliente', proyecto_id: jordanProj.id, estado_pago: 'pendiente', fecha_vencimiento: new Date('2026-06-20') },
        { descripcion: 'Diagnóstico Computarizado Camión Scania', monto: 450000, tipo: 'vencimiento_cliente', proyecto_id: jordanProj.id, estado_pago: 'pendiente', fecha_vencimiento: new Date('2026-06-25') },
        { descripcion: 'Venta de Filtros de Combustible originales', monto: 350000, tipo: 'vencimiento_cliente', proyecto_id: jordanProj.id, estado_pago: 'pendiente', fecha_vencimiento: null },
      ]
    });
  }

  console.log('Seed de ecosistema completado con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
