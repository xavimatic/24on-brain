-- CreateTable
CREATE TABLE "Libros" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "autor" TEXT,
    "estado_lectura" TEXT NOT NULL,
    "veces_leido" INTEGER NOT NULL DEFAULT 0,
    "url_pdf" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Libros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citas" (
    "id" SERIAL NOT NULL,
    "libro_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "pagina" INTEGER,
    "comentario" TEXT,

    CONSTRAINT "Citas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Citas" ADD CONSTRAINT "Citas_libro_id_fkey" FOREIGN KEY ("libro_id") REFERENCES "Libros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
