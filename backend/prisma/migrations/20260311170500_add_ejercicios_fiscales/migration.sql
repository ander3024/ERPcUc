-- CreateEnum
CREATE TYPE "EstadoEjercicio" AS ENUM ('ABIERTO', 'CERRADO', 'EN_CIERRE');

-- CreateTable
CREATE TABLE "ejercicios_fiscales" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoEjercicio" NOT NULL DEFAULT 'ABIERTO',
    "fechaCierre" TIMESTAMP(3),
    "usuarioCierreId" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejercicios_fiscales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ejercicios_fiscales_anio_key" ON "ejercicios_fiscales"("anio");

-- Add ejercicioId to all document tables
ALTER TABLE "presupuestos" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "pedidos_venta" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "albaranes_venta" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "facturas" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "cobros" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "pedidos_compra" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "albaranes_compra" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "facturas_compra" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "pagos" ADD COLUMN "ejercicioId" INTEGER;
ALTER TABLE "asientos_contables" ADD COLUMN "ejercicioId" INTEGER;

-- Add foreign keys
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pedidos_venta" ADD CONSTRAINT "pedidos_venta_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "albaranes_venta" ADD CONSTRAINT "albaranes_venta_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "albaranes_compra" ADD CONSTRAINT "albaranes_compra_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "facturas_compra" ADD CONSTRAINT "facturas_compra_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "ejercicios_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create default fiscal years (2023-2026)
INSERT INTO "ejercicios_fiscales" ("anio", "fechaInicio", "fechaFin", "estado", "updatedAt")
SELECT y, make_date(y, 1, 1), make_date(y, 12, 31) + interval '23 hours 59 minutes 59 seconds', 'ABIERTO', NOW()
FROM generate_series(2023, 2026) AS y
ON CONFLICT DO NOTHING;

-- Assign ejercicioId based on document date
UPDATE "presupuestos" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "presupuestos"."fecha") = ef."anio";
UPDATE "pedidos_venta" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "pedidos_venta"."fecha") = ef."anio";
UPDATE "albaranes_venta" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "albaranes_venta"."fecha") = ef."anio";
UPDATE "facturas" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "facturas"."fecha") = ef."anio";
UPDATE "cobros" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "cobros"."fecha") = ef."anio";
UPDATE "pedidos_compra" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "pedidos_compra"."fecha") = ef."anio";
UPDATE "albaranes_compra" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "albaranes_compra"."fecha") = ef."anio";
UPDATE "facturas_compra" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "facturas_compra"."fecha") = ef."anio";
UPDATE "pagos" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE EXTRACT(YEAR FROM "pagos"."fecha") = ef."anio";
UPDATE "asientos_contables" SET "ejercicioId" = ef.id FROM "ejercicios_fiscales" ef WHERE "asientos_contables"."ejercicio" = ef."anio";
