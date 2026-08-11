-- CreateTable
CREATE TABLE "finanzas" (
    "id" SERIAL NOT NULL,
    "proyecto_id" INTEGER,
    "tipo" VARCHAR(50) NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado_pago" VARCHAR(50) DEFAULT 'pendiente',
    "saldo_pendiente" DECIMAL(15,2) DEFAULT 0.00,
    "fecha_vencimiento" TIMESTAMP(6),
    "fecha_transaccion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finanzas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "metadatos" JSONB,
    "fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "entidad_id" INTEGER,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entidades" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "metadatos" JSONB,

    CONSTRAINT "Entidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vinculos" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "origen_id" INTEGER NOT NULL,
    "destino_id" INTEGER NOT NULL,

    CONSTRAINT "Vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" SERIAL NOT NULL,
    "proyecto_id" INTEGER,
    "descripcion" TEXT NOT NULL,
    "estado" VARCHAR(50) DEFAULT 'pendiente',
    "prioridad" VARCHAR(20) DEFAULT 'media',
    "fecha_limite" TIMESTAMP(6),
    "fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enlaces" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" VARCHAR(50) NOT NULL,
    "etiquetas" TEXT[],
    "funciona" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proyecto_id" INTEGER,

    CONSTRAINT "enlaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_nombre_key" ON "proyectos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Entidades_nombre_key" ON "Entidades"("nombre");

-- AddForeignKey
ALTER TABLE "finanzas" ADD CONSTRAINT "finanzas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_entidad_id_fkey" FOREIGN KEY ("entidad_id") REFERENCES "Entidades"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Vinculos" ADD CONSTRAINT "Vinculos_origen_id_fkey" FOREIGN KEY ("origen_id") REFERENCES "Entidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculos" ADD CONSTRAINT "Vinculos_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "Entidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enlaces" ADD CONSTRAINT "enlaces_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
