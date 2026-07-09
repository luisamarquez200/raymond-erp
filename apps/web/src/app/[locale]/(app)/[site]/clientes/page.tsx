'use client';

import { useState, useEffect } from 'react';
import { clientesApi, Cliente } from '@/services/taller-r1/clientes.service';
import { toast } from 'sonner';
import { Plus, Download, Search, Edit, Trash2, X, Building2, User, Mail, Phone, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClienteForm } from '@/components/taller-r1/clientes/ClienteForm';
import { ClienteDetailsPanel } from '@/components/taller-r1/clientes/ClienteDetailsPanel';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AlertCircle } from 'lucide-react';
import { useAuthTallerStore } from '@/store/auth-taller.store';

export default function ClientesPage() {
  const { user: currentTallerUser } = useAuthTallerStore();
  const isVisitante = currentTallerUser?.role === 'Visitante';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    filterClientes();
  }, [clientes, searchTerm]);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const data = await clientesApi.getAll();
      setClientes(data);
    } catch (error) {
      toast.error('Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  const filterClientes = () => {
    let filtered = [...clientes];
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.rfc?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredClientes(filtered);
  };

  const handleCreateClient = async (data: any) => {
    try {
      setIsSubmitting(true);
      await clientesApi.create(data);
      toast.success('Cliente creado correctamente');
      setIsCreateOpen(false);
      loadClientes();
    } catch (error) {
      toast.error('Error al crear el cliente');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    try {
      const exportData = filteredClientes.map(c => ({
        'Nombre Comercial': c.nombre_cliente,
        'Razón Social': c.razon_social,
        'RFC': c.rfc,
        'Persona de Contacto': c.persona_contacto,
        'Teléfono': c.telefono,
        'Ciudad': c.ciudad,
        'Estado': 'Activo',
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
      XLSX.writeFile(workbook, `clientes_taller_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Padrón exportado correctamente');
    } catch (error) {
      toast.error('Error al exportar');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tighter">Cartera de Clientes</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Gestión del Padrón de Clientes de Taller R1
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl shadow-sm hover:bg-gray-50 transition-colors font-brand font-black tracking-tighter">
            <Download className="w-5 h-5" />
            Exportar
          </button>
          {!isVisitante && (
            <button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors font-brand font-black tracking-tighter">
              <Plus className="w-5 h-5" />
              Nuevo Cliente
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente por nombre comercial o RFC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-400 outline-none transition-all font-medium text-sm"
          />
        </div>
      </div>

      {/* Content Display */}
      <div className="pb-6">
        <div className="w-full">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-lg border border-dashed border-gray-300">
              <Building2 className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No hay clientes</p>
              <p className="text-sm text-gray-400">No se encontraron registros que coincidan con la búsqueda.</p>
            </div>
          ) : (
            <>
              {/* Responsive Card Grid View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClientes.map((client) => (
                  <div
                    key={client.id_cliente}
                    onClick={() => setSelectedClientId(client.id_cliente)}
                    className="cursor-pointer bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 hover:border-red-100 hover:shadow-md transition-all flex flex-col relative h-full"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-12 h-12 shrink-0 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 shadow-inner">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-gray-900 tracking-tighter text-lg truncate" title={client.nombre_cliente}>
                            {client.nombre_cliente}
                          </h3>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest truncate" title={client.razon_social || ''}>
                            {client.razon_social || 'Sin Razón Social'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 mt-auto">
                      <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2 text-gray-400 font-medium truncate">
                          <User className="w-4 h-4 shrink-0" />
                          <span className="truncate">{client.persona_contacto || '-'}</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2 text-gray-400 font-medium truncate">
                          <Phone className="w-4 h-4 shrink-0" />
                          <span className="truncate">{client.telefono || '-'}</span>
                        </span>
                        {client.rfc && (
                          <span className="font-bold text-gray-900 text-[10px] uppercase tracking-wider">{client.rfc}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {/* Counter Footer */}
        {!loading && filteredClientes.length > 0 && (
          <div className="mt-4 text-center">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
              Mostrando {filteredClientes.length} Clientes En Padrón
            </span>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl bg-white focus:outline-none text-slate-900">
          <VisuallyHidden>
            <DialogTitle>Nuevo Cliente Comercial</DialogTitle>
          </VisuallyHidden>
          <div className="px-8 py-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Nuevo Cliente Comercial</h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Ingresa los datos del nuevo cliente para el Taller R1.</p>
          </div>
          <div className="p-8">
            <ClienteForm
              onSubmit={handleCreateClient}
              isLoading={isSubmitting}
              onCancel={() => setShowConfirmCancel(true)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Details Dialog */}
      <Dialog open={!!selectedClientId} onOpenChange={(open) => !open && setSelectedClientId(null)}>
        <DialogContent
          className="sm:max-w-[600px] md:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl bg-white focus:outline-none"
        >
          <VisuallyHidden>
            <DialogTitle>Detalles del Cliente</DialogTitle>
          </VisuallyHidden>
          {selectedClientId && (
            <ClienteDetailsPanel
              clientId={selectedClientId}
              onClose={() => setSelectedClientId(null)}
              onUpdateSuccess={loadClientes}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Modal de Confirmación de Cierre */}
      <Dialog open={showConfirmCancel} onOpenChange={setShowConfirmCancel}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl rounded-[2rem] z-[60]">
          <div className="p-8 space-y-6">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">¿Descartar cambios?</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 font-medium">
                Tienes datos que no han sido guardados. Si cancelas ahora, perderás estos cambios definitivamente.
              </DialogDescription>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Continuar
              </button>
              <button
                onClick={() => {
                  setShowConfirmCancel(false);
                  setIsCreateOpen(false);
                }}
                className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-200 transition-all"
              >
                Descartar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
