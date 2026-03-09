#!/usr/bin/env node
/**
 * ============================================
 * MIGRACIÓN ENEBOO → ERP WEB
 * ============================================
 * 
 * USO:
 *   node migration/migrate-eneboo.js --db /ruta/a/eneboo.sqlite
 * 
 * Eneboo usa SQLite con tablas específicas de AbanQ/Eneboo.
 * Este script lee la BD de Eneboo y migra los datos al nuevo sistema.
 */

const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const dbPathArg = args.findIndex(a => a === '--db');
const DB_PATH = dbPathArg >= 0 ? args[dbPathArg + 1] : './eneboo.sqlite';

let db;

async function main() {
  console.log('🚀 Iniciando migración Eneboo → ERP Web');
  console.log(`📁 Base de datos Eneboo: ${DB_PATH}`);
  
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ No se encontró el archivo: ${DB_PATH}`);
    console.log('💡 Exporta tu BD de Eneboo desde: Herramientas → Exportar BD');
    process.exit(1);
  }

  db = new Database(DB_PATH, { readonly: true });
  console.log('✅ Conectado a Eneboo SQLite\n');

  // Obtener tablas disponibles
  const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const nombresTablas = tablas.map(t => t.name);
  console.log(`📊 Tablas encontradas en Eneboo: ${nombresTablas.join(', ')}\n`);

  const stats = {
    clientes: 0, proveedores: 0, articulos: 0,
    familias: 0, facturas: 0, lineasFactura: 0,
    errores: [],
  };

  // ============================================
  // 1. FORMAS DE PAGO
  // ============================================
  if (nombresTablas.includes('formaspago')) {
    console.log('💳 Migrando formas de pago...');
    try {
      const formas = db.prepare('SELECT * FROM formaspago').all();
      for (const f of formas) {
        await prisma.formaPago.upsert({
          where: { id: String(f.codpago || f.codigo || f.id) },
          update: {},
          create: {
            id: String(f.codpago || f.codigo || f.id),
            nombre: f.descripcion || f.nombre || 'Sin nombre',
            diasVto: parseInt(f.diasvencimiento || f.diasvto || 0),
            numVtos: parseInt(f.numvencimientos || 1),
            tipo: f.tipopago || 'CONTADO',
          },
        });
      }
      console.log(`  ✅ ${formas.length} formas de pago migradas`);
    } catch (e) {
      console.log(`  ⚠️  Error migrando formas de pago: ${e.message}`);
    }
  }

  // ============================================
  // 2. FAMILIAS DE ARTÍCULOS
  // ============================================
  const tablaFamilias = ['familias', 'familiasarticulos', 'co_familias'];
  for (const tabla of tablaFamilias) {
    if (nombresTablas.includes(tabla)) {
      console.log('📁 Migrando familias de artículos...');
      try {
        const familias = db.prepare(`SELECT * FROM ${tabla}`).all();
        for (const f of familias) {
          try {
            await prisma.familiaArticulo.upsert({
              where: { codigo: String(f.codfamilia || f.codigo || f.id) },
              update: { nombre: f.descripcion || f.nombre },
              create: {
                codigo: String(f.codfamilia || f.codigo || f.id),
                nombre: f.descripcion || f.nombre || 'Sin nombre',
              },
            });
            stats.familias++;
          } catch (e) { /* skip duplicados */ }
        }
        console.log(`  ✅ ${stats.familias} familias migradas`);
      } catch (e) {
        console.log(`  ⚠️  Error: ${e.message}`);
      }
      break;
    }
  }

  // ============================================
  // 3. ARTÍCULOS
  // ============================================
  const tablaArticulos = ['articulos', 'almacen'];
  for (const tabla of tablaArticulos) {
    if (nombresTablas.includes(tabla)) {
      console.log('📦 Migrando artículos...');
      try {
        const articulos = db.prepare(`SELECT * FROM ${tabla}`).all();
        let batch = [];
        
        for (const a of articulos) {
          try {
            const ref = String(a.referencia || a.codbarras || a.id || `ART${stats.articulos + 1}`).substring(0, 50);
            
            // Buscar familia
            let familiaId = null;
            if (a.codfamilia || a.familia) {
              const f = await prisma.familiaArticulo.findFirst({
                where: { codigo: String(a.codfamilia || a.familia) },
              });
              familiaId = f?.id || null;
            }

            await prisma.articulo.upsert({
              where: { referencia: ref },
              update: {
                nombre: String(a.descripcion || a.nombre || ref).substring(0, 250),
                precioVenta: parseFloat(a.pvp || a.precio || a.precioventa || 0) || 0,
                precioCoste: parseFloat(a.coste || a.preciocoste || 0) || 0,
                tipoIva: parseFloat(a.codiva === '1' ? 21 : a.codiva === '2' ? 10 : a.codiva === '3' ? 4 : a.iva || 21) || 21,
                stockActual: parseFloat(a.stockactual || a.stock || 0) || 0,
                stockMinimo: parseFloat(a.stockmin || a.stockminimo || 0) || 0,
              },
              create: {
                referencia: ref,
                codigoBarras: a.codbarras ? String(a.codbarras) : null,
                nombre: String(a.descripcion || a.nombre || ref).substring(0, 250),
                familiaId,
                precioVenta: parseFloat(a.pvp || a.precio || a.precioventa || 0) || 0,
                precioCoste: parseFloat(a.coste || a.preciocoste || 0) || 0,
                tipoIva: 21,
                stockActual: parseFloat(a.stockactual || a.stock || 0) || 0,
                stockMinimo: parseFloat(a.stockmin || a.stockminimo || 0) || 0,
                unidadMedida: a.codunidad || 'UND',
                activo: a.bloqueado !== 1 && a.activo !== false,
              },
            });
            stats.articulos++;
          } catch (e) {
            stats.errores.push(`Artículo ${a.referencia}: ${e.message}`);
          }
        }
        console.log(`  ✅ ${stats.articulos} artículos migrados`);
      } catch (e) {
        console.log(`  ⚠️  Error: ${e.message}`);
      }
      break;
    }
  }

  // ============================================
  // 4. CLIENTES
  // ============================================
  const tablaClientes = ['clientes', 'contactos'];
  for (const tabla of tablaClientes) {
    if (nombresTablas.includes(tabla)) {
      console.log('👥 Migrando clientes...');
      try {
        const clientes = db.prepare(`SELECT * FROM ${tabla}`).all();
        
        for (const c of clientes) {
          try {
            const codigo = String(c.codcliente || c.codigo || `C${stats.clientes + 1}`).substring(0, 20);
            
            let formaPagoId = null;
            if (c.codpago) {
              const fp = await prisma.formaPago.findUnique({ where: { id: String(c.codpago) } });
              formaPagoId = fp?.id || null;
            }

            await prisma.cliente.upsert({
              where: { codigo },
              update: {},
              create: {
                codigo,
                nombre: String(c.nombre || c.razonsocial || codigo).substring(0, 200),
                nombreComercial: c.nomcomercial ? String(c.nomcomercial).substring(0, 200) : null,
                cifNif: c.cifnif ? String(c.cifnif).substring(0, 20) : null,
                email: c.email ? String(c.email).substring(0, 100) : null,
                telefono: c.telefono1 || c.telefono ? String(c.telefono1 || c.telefono).substring(0, 20) : null,
                movil: c.telefono2 ? String(c.telefono2).substring(0, 20) : null,
                direccion: c.direccion ? String(c.direccion).substring(0, 300) : null,
                codigoPostal: c.codpostal ? String(c.codpostal).substring(0, 10) : null,
                ciudad: c.ciudad ? String(c.ciudad).substring(0, 100) : null,
                provincia: c.provincia ? String(c.provincia).substring(0, 100) : null,
                pais: c.codpais || 'ES',
                formaPagoId,
                tipoIva: 21,
                descuento: parseFloat(c.dtopporc || 0) || 0,
                limiteCredito: c.creditomax ? parseFloat(c.creditomax) : null,
                cuentaContable: c.codcuenta ? String(c.codcuenta) : null,
                activo: c.debaja !== 1 && c.activo !== false,
              },
            });
            stats.clientes++;
          } catch (e) {
            stats.errores.push(`Cliente ${c.codcliente}: ${e.message}`);
          }
        }
        console.log(`  ✅ ${stats.clientes} clientes migrados`);
      } catch (e) {
        console.log(`  ⚠️  Error: ${e.message}`);
      }
      break;
    }
  }

  // ============================================
  // 5. PROVEEDORES
  // ============================================
  if (nombresTablas.includes('proveedores')) {
    console.log('🏭 Migrando proveedores...');
    try {
      const proveedores = db.prepare('SELECT * FROM proveedores').all();
      for (const p of proveedores) {
        try {
          const codigo = String(p.codproveedor || p.codigo || `P${stats.proveedores + 1}`).substring(0, 20);
          await prisma.proveedor.upsert({
            where: { codigo },
            update: {},
            create: {
              codigo,
              nombre: String(p.nombre || p.razonsocial || codigo).substring(0, 200),
              cifNif: p.cifnif ? String(p.cifnif).substring(0, 20) : null,
              email: p.email ? String(p.email).substring(0, 100) : null,
              telefono: p.telefono1 ? String(p.telefono1).substring(0, 20) : null,
              contacto: p.contacto ? String(p.contacto).substring(0, 100) : null,
              direccion: p.direccion ? String(p.direccion).substring(0, 300) : null,
              codigoPostal: p.codpostal ? String(p.codpostal).substring(0, 10) : null,
              ciudad: p.ciudad ? String(p.ciudad).substring(0, 100) : null,
              provincia: p.provincia ? String(p.provincia).substring(0, 100) : null,
              activo: p.debaja !== 1,
            },
          });
          stats.proveedores++;
        } catch (e) {
          stats.errores.push(`Proveedor ${p.codproveedor}: ${e.message}`);
        }
      }
      console.log(`  ✅ ${stats.proveedores} proveedores migrados`);
    } catch (e) {
      console.log(`  ⚠️  Error migrando proveedores: ${e.message}`);
    }
  }

  // ============================================
  // 6. FACTURAS
  // ============================================
  const tablaFacturas = ['facturascli', 'facturasprov'];
  if (nombresTablas.includes('facturascli')) {
    console.log('🧾 Migrando facturas de clientes...');
    try {
      const facturas = db.prepare('SELECT * FROM facturascli ORDER BY fecha ASC').all();
      
      for (const f of facturas) {
        try {
          const cliente = await prisma.cliente.findFirst({
            where: { codigo: String(f.codcliente) },
          });
          if (!cliente) continue;

          const serie = String(f.codserie || 'A');
          const numero = parseInt(f.numero || 0);
          const año = f.fecha ? new Date(f.fecha).getFullYear() : new Date().getFullYear();
          const numeroCompleto = `${serie}/${año}/${String(numero).padStart(4, '0')}`;

          const facturaExiste = await prisma.factura.findUnique({ where: { numeroCompleto } });
          if (facturaExiste) continue;

          // Buscar líneas
          let lineas = [];
          if (nombresTablas.includes('lineasfacturascli')) {
            lineas = db.prepare(
              "SELECT * FROM lineasfacturascli WHERE idfactura = ? ORDER BY cantidad DESC"
            ).all(f.idfactura || f.id);
          }

          const baseImponible = parseFloat(f.neto || 0) || 0;
          const totalIva = parseFloat(f.totaliva || 0) || 0;
          const total = parseFloat(f.total || 0) || (baseImponible + totalIva);

          // Buscar admin para asignar como creador
          let creador = await prisma.usuario.findFirst({ where: { rol: 'SUPERADMIN' } });
          if (!creador) {
            creador = await prisma.usuario.findFirst();
          }
          if (!creador) continue;

          await prisma.factura.create({
            data: {
              serie,
              numero,
              numeroCompleto,
              clienteId: cliente.id,
              creadorId: creador.id,
              fecha: f.fecha ? new Date(f.fecha) : new Date(),
              fechaVencimiento: f.fechavencimiento ? new Date(f.fechavencimiento) : null,
              estado: f.pagada === 1 ? 'COBRADA' : 'EMITIDA',
              baseImponible,
              totalIva,
              total,
              totalPagado: f.pagada === 1 ? total : parseFloat(f.totalpagado || 0) || 0,
              observaciones: f.observaciones ? String(f.observaciones).substring(0, 500) : null,
              lineas: {
                create: lineas.slice(0, 50).map((l: any, i: number) => ({
                  orden: i + 1,
                  articuloId: null,
                  referencia: l.referencia ? String(l.referencia).substring(0, 50) : null,
                  descripcion: String(l.descripcion || 'Producto').substring(0, 250),
                  cantidad: parseFloat(l.cantidad || 1) || 1,
                  precioUnitario: parseFloat(l.pvpunitario || l.precio || 0) || 0,
                  descuento: parseFloat(l.dtopor || 0) || 0,
                  tipoIva: parseFloat(l.iva || 21) || 21,
                  baseLinea: parseFloat(l.pvptotal || 0) || 0,
                  ivaLinea: 0,
                  totalLinea: parseFloat(l.pvptotal || 0) || 0,
                })),
              },
            },
          });
          stats.facturas++;
          stats.lineasFactura += lineas.length;
        } catch (e) {
          stats.errores.push(`Factura ${f.numero}: ${e.message}`);
        }
      }
      console.log(`  ✅ ${stats.facturas} facturas migradas (${stats.lineasFactura} líneas)`);
    } catch (e) {
      console.log(`  ⚠️  Error migrando facturas: ${e.message}`);
    }
  }

  // ============================================
  // 7. USUARIO ADMIN POR DEFECTO
  // ============================================
  console.log('👤 Creando usuario administrador...');
  const adminExiste = await prisma.usuario.findFirst({ where: { rol: 'SUPERADMIN' } });
  if (!adminExiste) {
    const hash = await bcrypt.hash('Admin1234!', 12);
    await prisma.usuario.create({
      data: {
        email: 'admin@miempresa.com',
        password: hash,
        nombre: 'Administrador',
        apellidos: 'Sistema',
        rol: 'SUPERADMIN',
      },
    });
    console.log('  ✅ Usuario admin creado: admin@miempresa.com / Admin1234!');
    console.log('  ⚠️  CAMBIA LA CONTRASEÑA DESPUÉS DEL PRIMER ACCESO');
  }

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(50));
  console.log(`✅ Clientes:     ${stats.clientes}`);
  console.log(`✅ Proveedores:  ${stats.proveedores}`);
  console.log(`✅ Familias:     ${stats.familias}`);
  console.log(`✅ Artículos:    ${stats.articulos}`);
  console.log(`✅ Facturas:     ${stats.facturas}`);
  console.log(`✅ Líneas fact:  ${stats.lineasFactura}`);

  if (stats.errores.length > 0) {
    console.log(`\n⚠️  Errores (${stats.errores.length}):`);
    stats.errores.slice(0, 20).forEach(e => console.log(`   - ${e}`));
    if (stats.errores.length > 20) console.log(`   ... y ${stats.errores.length - 20} más`);
    // Guardar log de errores
    fs.writeFileSync('./migration-errors.log', stats.errores.join('\n'));
    console.log('\n📝 Log completo guardado en: migration-errors.log');
  }

  console.log('\n🎉 ¡Migración completada!');
  console.log('🌐 Accede al ERP en: http://tu-servidor');
}

main()
  .catch(e => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    if (db) db.close();
    await prisma.$disconnect();
  });
