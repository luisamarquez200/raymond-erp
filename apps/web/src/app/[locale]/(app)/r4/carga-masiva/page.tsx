"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud, File, AlertCircle } from 'lucide-react';

export default function R4CargaMasivaPage() {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Carga Masiva (R4)</h1>
        <p className="text-muted-foreground">Importa registros de Flotilla, Clientes o Rentas mediante archivos Excel.</p>
      </div>

      <div className="bg-muted/30 p-4 rounded-lg border border-border">
        <label className="block text-sm font-medium mb-2">Selecciona el módulo a cargar:</label>
        <select className="w-full sm:w-64 p-2 rounded-md border bg-background">
          <option value="flotilla">Flotilla / Activos</option>
          <option value="clientes">Clientes</option>
          <option value="rentas">Rentas</option>
        </select>
        <p className="text-sm text-muted-foreground mt-2">
          Descarga la <a href="#" className="text-primary hover:underline">plantilla de Excel</a> para asegurarte de que el formato sea correcto.
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${file ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {!file ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-muted rounded-full">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">Arrastra y suelta tu archivo Excel aquí</p>
              <p className="text-sm text-muted-foreground mt-1">o haz clic para explorar archivos (Max 10MB)</p>
            </div>
            <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-medium">
              Seleccionar archivo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <File className="h-12 w-12 text-primary" />
            <p className="font-medium text-lg">{file.name}</p>
            <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
            <button 
              onClick={() => setFile(null)}
              className="text-destructive text-sm hover:underline"
            >
              Quitar archivo
            </button>
          </div>
        )}
      </div>

      {file && (
        <div className="flex justify-end gap-4 mt-6">
          <button className="px-4 py-2 rounded-md border font-medium">Cancelar</button>
          <button className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium">
            Validar e Importar
          </button>
        </div>
      )}
    </div>
  );
}
